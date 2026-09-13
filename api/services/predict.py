import builtins
def print(*args, **kwargs):
    kwargs['flush'] = True
    builtins.print(*args, **kwargs)

import os
import io
import base64
import numpy as np
import cv2
import torch
from PIL import Image
from typing import Optional
from ultralytics import YOLO
from ultralytics.nn.tasks import DetectionModel
from services.discord import send_discord_alert_sync

# Contournement de sécurité PyTorch 2.6+ pour charger le modèle YOLO local
try:
    torch.serialization.add_safe_globals([DetectionModel])
except Exception:
    pass

MODEL_DIR = os.path.dirname(__file__)
# Le modèle best.pt doit être placé dans le dossier 'api'
MODEL_PATH = os.path.join(MODEL_DIR, "..", "best.pt")

_model = None
_person_model = None

def init_model():
    global _model, _person_model
    if _model is not None and _person_model is not None:
        return
    
    print(f"Chargement du modèle YOLO depuis {MODEL_PATH}...")
    if not os.path.exists(MODEL_PATH):
        print(f"ATTENTION: Fichier {MODEL_PATH} introuvable.")
        return
        
    try:
        import torch
        original_load = torch.load
        def custom_load(*args, **kwargs):
            kwargs['weights_only'] = False
            return original_load(*args, **kwargs)
        torch.load = custom_load
        
        _model = YOLO(MODEL_PATH)
        _person_model = YOLO('yolo11n.pt')
        
        torch.load = original_load
        print("Modèles YOLO chargés avec succès.")
    except Exception as e:
        print(f"Erreur lors du chargement du modèle YOLO: {e}")

def process_image(image_bytes: bytes):
    if _model is None or _person_model is None:
        raise Exception("Les modèles YOLO n'ont pas pu être chargés. Assurez-vous d'avoir best.pt dans le dossier api.")

    # Lire l'image envoyée (OpenCV)
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    img = correct_noir_colors(img)
    
    print("Analyse de l'image en cours par les modèles YOLO IA...")
    # Lancer la prédiction avec un seuil de confiance calibré (0.35)
    results_fire = _model.predict(source=img, conf=0.35, verbose=False)
    results_person = _person_model.predict(source=img, classes=[0], conf=0.35, verbose=False)
    
    # Image pour annotations
    res_plotted = img.copy()
    h, w = img.shape[:2]
    
    # Extraire les métadonnées de détection
    detections = []
    
    is_fire = False
    max_fire_conf = 0.0
    
    # Détections du modèle Feu/Fumée
    if results_fire[0].boxes is not None:
        for box in results_fire[0].boxes:
            x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            crop = img[y1:y2, x1:x2]

            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            class_name = _model.names[cls_id] if _model and hasattr(_model, 'names') else str(cls_id)
            
            # Filtre anti-faux-positifs sur blanc
            if not validate_fire_or_smoke(crop, class_name, conf):
                continue

            is_fire = True
            if conf > max_fire_conf:
                max_fire_conf = conf

            color = (0, 69, 255) if class_name == "wildfire" else (0, 140, 255)
            label = "Feu" if class_name == "wildfire" else "Fumee"
            cv2.rectangle(res_plotted, (x1, y1), (x2, y2), color, 2)
            cv2.putText(res_plotted, f"{label} {int(conf * 100)}%", (x1, max(15, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                
            detections.append({
                "bbox": [round(float(x1), 2), round(float(y1), 2), round(float(x2), 2), round(float(y2), 2)],
                "confidence": round(conf, 4),
                "class": class_name
            })
            
    # Détections du modèle Personnes
    if results_person[0].boxes is not None:
        for box in results_person[0].boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            class_name = _person_model.names[cls_id] if _person_model and hasattr(_person_model, 'names') else "person"
            
            # Dessiner la boîte pour la personne sur l'image (en bleu)
            cv2.rectangle(res_plotted, (int(x1), int(y1)), (int(x2), int(y2)), (255, 0, 0), 2)
            label = f"{class_name} {conf:.2f}"
            cv2.putText(res_plotted, label, (int(x1), int(y1) - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)
            
            detections.append({
                "bbox": [round(x1, 2), round(y1, 2), round(x2, 2), round(y2, 2)],
                "confidence": round(conf, 4),
                "class": class_name
            })
            
    has_person = len(results_person[0].boxes) > 0 if results_person[0].boxes is not None else False
    if has_person:
        max_p_conf = max([float(b.conf[0]) for b in results_person[0].boxes])
        save_capture_async("person", "warn", round(max_p_conf * 100, 1), "Scan Manuel", res_plotted)
    elif is_fire:
        confidence_percent = round(max_fire_conf * 100, 1)
        print(f"[ALERTE FUMÉE] Détection de fumée (Analyse Image | Confiance max : {confidence_percent}%)")
        save_capture_async("smoke", "fire", confidence_percent, "Scan Manuel (Fumée)", res_plotted)
    else:
        print(f"[SURVEILLANCE] Surveillance normale (Aucune détection)")
    
    # Encoder l'image en JPEG
    success, encoded_img = cv2.imencode('.jpg', res_plotted)
    if not success:
        raise Exception("Erreur d'encodage de l'image")
    
    # Convertir l'image en Base64
    img_b64 = base64.b64encode(encoded_img.tobytes()).decode('utf-8')
    
    # Renvoyer le JSON avec les détections et l'image
    return {
        "detections": detections,
        "image_base64": img_b64
    }

import httpx
import time
import threading
from datetime import datetime

STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")
CAPTURES_DIR = os.path.join(STATIC_DIR, "captures")
os.makedirs(CAPTURES_DIR, exist_ok=True)

def save_alert_async(status: str, location: str, confidence: float, coords: str, image_url: str = None, detection_type: str = "fire"):
    def _save():
        from db.database import SessionLocal
        from db.models import Alert
        db = SessionLocal()
        try:
            db.add(Alert(
                status=status,
                location=location,
                confidence=confidence,
                coords=coords,
                image_url=image_url,
                detection_type=detection_type,
                date=datetime.utcnow()
            ))
            db.commit()
        except Exception as e:
            print(f"Erreur DB (Background Alert): {e}")
        finally:
            db.close()
    threading.Thread(target=_save, daemon=True).start()

def save_capture_async(detection_type: str, status: str, confidence: float, location: str, image_np, user_id: int = None, device_id: int = None):
    """
    Sauvegarde asynchrone sur disque de la photo prise lors d'une détection (personne ou feu)
    et enregistrement dans la table captures et alerts.
    """
    def _save_task():
        try:
            now_dt = datetime.utcnow()
            timestamp_str = now_dt.strftime('%Y%m%d_%H%M%S_%f')[:19]
            filename = f"{detection_type}_{timestamp_str}.jpg"
            filepath = os.path.join(CAPTURES_DIR, filename)

            # Écriture de l'image JPEG sur le disque
            success = cv2.imwrite(filepath, image_np)
            if not success:
                print(f"Erreur écriture fichier snapshot {filepath}")
                return

            image_url = f"/static/captures/{filename}"

            from db.database import SessionLocal
            from db.models import Capture, Alert
            db = SessionLocal()
            try:
                capture = Capture(
                    user_id=user_id,
                    device_id=device_id,
                    detection_type=detection_type,
                    status=status,
                    confidence=confidence,
                    location=location,
                    image_url=image_url,
                    created_at=now_dt
                )
                db.add(capture)

                # Vérification du Mode Travaux (désactivation temporaire pour travaux/fumées de bricolage)
                from db.models import Device
                dev_obj = None
                if device_id:
                    dev_obj = db.query(Device).filter(Device.id == device_id).first()
                if not dev_obj and location:
                    dev_obj = db.query(Device).filter(Device.name == location).first()

                if dev_obj and getattr(dev_obj, "is_maintenance_mode", False):
                    # Vérification d'expiration automatique
                    if dev_obj.maintenance_until and now_dt > dev_obj.maintenance_until:
                        dev_obj.is_maintenance_mode = False
                        dev_obj.maintenance_until = None
                        db.commit()
                    else:
                        print(f"[MODE TRAVAUX ACTIF] Détection {status.upper()} ignorée pour {location} — Alertes et emails suspendus.")
                        return

                alert = Alert(
                    status=status,
                    location=location,
                    confidence=confidence,
                    coords="46.2276°N 2.2137°E",
                    image_url=image_url,
                    detection_type=detection_type,
                    date=now_dt
                )
                db.add(alert)
                db.commit()
                print(f"[CAPTURE] Snapshot enregistrée: {filename} -> Type: {detection_type.upper()} ({confidence}%) à {location}")
                
                # Notification Discord
                alert_type_mapped = "fire" if status == "fire" else ("warn" if status == "warn" else "unknown")
                send_discord_alert_sync(alert_type_mapped, location, confidence, image_url)

                # Notification E-mail d'Urgence Incendie (avec photo snapshot jointe)
                if status == "fire":
                    try:
                        from services.email import send_fire_emergency_alert_email
                        from db.models import User, UserDevice
                        target_users = []
                        if user_id:
                            u = db.query(User).filter(User.id == user_id).first()
                            if u:
                                target_users.append(u)
                        if device_id:
                            uds = db.query(UserDevice).filter(UserDevice.device_id == device_id).all()
                            for ud in uds:
                                if ud.user and ud.user not in target_users:
                                    target_users.append(ud.user)

                        notified_emails = set()
                        for u in target_users:
                            if getattr(u, "emergency_alerts_enabled", True) and getattr(u, "emergency_alert_email", None):
                                raw_emails = u.emergency_alert_email or ""
                                list_emails = [e.strip() for e in raw_emails.replace(";", ",").split(",") if e.strip()]
                                for em in list_emails:
                                    if em and em not in notified_emails:
                                        notified_emails.add(em)
                                        send_fire_emergency_alert_email(
                                            recipient=em,
                                            device_name=location,
                                            location=location,
                                            confidence=confidence,
                                            image_path=filepath
                                        )
                    except Exception as email_err:
                        print(f"Erreur envoi alerte email urgence incendie: {email_err}")
            except Exception as dbe:
                print(f"Erreur DB Capture: {dbe}")
            finally:
                db.close()
        except Exception as e:
            print(f"Erreur globale save_capture_async: {e}")

    threading.Thread(target=_save_task, daemon=True).start()

# Variable globale pour stocker le dernier état de détection
latest_detection = {
    "fire": False,
    "person": False,
    "confidence": 0.0,
    "timestamp": 0.0
}

# État partagé pour le découplage Vidéo (30 FPS) / IA asynchrone (~2 FPS)
_ai_lock = threading.Lock()
_current_raw_frame = None
_current_boxes = []
_ai_thread_started = False

def correct_noir_colors(img: np.ndarray) -> np.ndarray:
    """
    Correction physique NoIR et balance des blancs adaptative (Gray World).
    - Neutralise la contamination infrarouge (NIR) qui transforme les vêtements noirs en violet/mauve.
    - Restaure le noir profond sur les t-shirts, tissus et objets noirs.
    - Conserve le teint de peau naturel humain (tons chauds, zéro teinte verte ou violette).
    - Maintient les plafonds et murs en blanc pur.
    - Préserve intégralement les flammes et le feu (100% insensible au filtre NIR).
    """
    if img is None or img.size == 0:
        return img
    try:
        img_f = img.astype(np.float32)
        b, g, r = img_f[:, :, 0], img_f[:, :, 1], img_f[:, :, 2]

        # 1. Élimination physique de la contamination proche infrarouge (NIR)
        # Sur capteur NoIR (OV5647), les colorants noirs absorbent le visible mais réfléchissent le NIR.
        # Le capteur enregistre alors un excès de Rouge et de Bleu symétrique (R >> G et B >> G).
        # Dans un vrai feu/flamme, le Rouge est intense mais le Bleu est faible (B << R),
        # donc min(r - g*0.9, b - g*0.8) est nul -> flammes et alertes 100% préservées !
        nir_excess = np.maximum(0.0, np.minimum(r - g * 0.9, b - g * 0.8))

        r_depurpled = np.clip(r - 1.35 * nir_excess, 0, 255)
        b_depurpled = np.clip(b - 1.35 * nir_excess, 0, 255)
        g_depurpled = np.clip(g - 0.35 * nir_excess, 0, 255)

        # 2. Balance des blancs adaptative (Gray World)
        mean_b = float(np.mean(b_depurpled))
        mean_g = float(np.mean(g_depurpled))
        mean_r = float(np.mean(r_depurpled))

        if mean_b > 5 and mean_g > 5 and mean_r > 5:
            target = (mean_b + mean_g + mean_r) / 3.0
            gain_b = float(np.clip(target / mean_b, 0.80, 1.25))
            gain_g = float(np.clip(target / mean_g, 0.85, 1.20))
            gain_r = float(np.clip(target / mean_r, 0.80, 1.25))

            b_out = np.clip(b_depurpled * gain_b, 0, 255).astype(np.uint8)
            g_out = np.clip(g_depurpled * gain_g, 0, 255).astype(np.uint8)
            r_out = np.clip(r_depurpled * gain_r, 0, 255).astype(np.uint8)
        else:
            b_out = b_depurpled.astype(np.uint8)
            g_out = g_depurpled.astype(np.uint8)
            r_out = r_depurpled.astype(np.uint8)

        return cv2.merge([b_out, g_out, r_out])
    except Exception:
        return img

def validate_fire_or_smoke(crop, class_name: str, conf: float, person_boxes=None, fire_box=None) -> bool:
    """
    Filtre anti-faux-positifs calibré :
    - Élimine les reflets blancs et les sources de lumière blanche.
    - Élimine les teintes roses / infrarouges (caméras Raspberry Pi NoIR).
    - Élimine les fausses détections de feu sur le visage ou le corps d'une personne.
    """
    if crop is None or crop.size == 0 or crop.shape[0] < 8 or crop.shape[1] < 8:
        return False

    try:
        # Rejet si la boîte de feu chevauche une personne (visage, peau, vêtement)
        if person_boxes and fire_box:
            fx1, fy1, fx2, fy2 = fire_box
            f_area = max(1, (fx2 - fx1) * (fy2 - fy1))
            for px1, py1, px2, py2 in person_boxes:
                ix1 = max(fx1, px1)
                iy1 = max(fy1, py1)
                ix2 = min(fx2, px2)
                iy2 = min(fy2, py2)
                if ix2 > ix1 and iy2 > iy1:
                    inter_area = (ix2 - ix1) * (iy2 - iy1)
                    if (inter_area / f_area) > 0.35:
                        return False

        hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
        mean_hue = float(np.mean(hsv[:, :, 0])) # 0-180 en OpenCV
        mean_sat = float(np.mean(hsv[:, :, 1]))
        mean_val = float(np.mean(hsv[:, :, 2]))

        mean_b = float(np.mean(crop[:, :, 0]))
        mean_g = float(np.mean(crop[:, :, 1]))
        mean_r = float(np.mean(crop[:, :, 2]))

        # Cas 1 : "wildfire" (flamme / feu)
        if class_name == "wildfire":
            # Seuil de confiance plus strict pour éviter les faux positifs d'intérieur
            if conf < 0.68:
                return False

            # Filtre anti-infrarouge NoIR / teintes violettes ou roses :
            # Une vraie flamme a R > G et R >> B (jaune/orange/rouge).
            # Le rose/magenta des caméras NoIR a beaucoup de bleu (B >= G ou B > R - 30).
            if mean_b >= mean_g or mean_b > (mean_r - 25):
                return False

            # Dans l'espace HSV, la flamme doit être rouge/orange/jaune (Hue <= 26 ou Hue >= 170)
            if 26 < mean_hue < 170:
                return False

            # La flamme a une luminosité et une saturation réelles
            if mean_sat < 50 or mean_val < 100:
                return False

        # Cas 2 : "smoke" (fumée)
        if class_name == "smoke":
            if conf < 0.55:
                return False
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            texture_std = float(np.std(gray))
            if mean_val > 175 and mean_sat < 35 and texture_std < 18 and conf < 0.70:
                return False

        return True
    except Exception:
        return True

def _ai_worker_loop():
    global _current_raw_frame, _current_boxes, latest_detection
    last_ras_log = 0.0
    while True:
        frame_to_process = None
        with _ai_lock:
            if _current_raw_frame is not None:
                frame_to_process = _current_raw_frame.copy()
        
        if frame_to_process is None or _model is None or _person_model is None:
            time.sleep(0.05)
            continue
            
        try:
            # 1. Inférence Personne en priorité
            results_person = _person_model.predict(source=frame_to_process, classes=[0], conf=0.35, verbose=False)
            person_boxes_raw = []
            person_detected = False
            max_person_conf = 0.0

            new_boxes = []
            if len(results_person) > 0 and len(results_person[0].boxes) > 0:
                for box in results_person[0].boxes:
                    px1, py1, px2, py2 = [int(v) for v in box.xyxy[0].tolist()]
                    conf = float(box.conf[0])
                    if conf > max_person_conf:
                        max_person_conf = conf
                    person_detected = True
                    person_boxes_raw.append((px1, py1, px2, py2))
                    new_boxes.append((px1, py1, px2, py2, f"Personne {int(conf * 100)}%", (255, 0, 0)))

            # 2. Inférence Feu
            results_fire = _model.predict(source=frame_to_process, conf=0.45, verbose=False)
            fire_detected = False
            max_fire_conf = 0.0
            h, w = frame_to_process.shape[:2]

            if len(results_fire) > 0 and len(results_fire[0].boxes) > 0:
                for box in results_fire[0].boxes:
                    x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
                    x1, y1 = max(0, x1), max(0, y1)
                    x2, y2 = min(w, x2), min(h, y2)
                    crop = frame_to_process[y1:y2, x1:x2]

                    conf = float(box.conf[0])
                    cls_id = int(box.cls[0])
                    class_name = _model.names[cls_id] if hasattr(_model, 'names') else "feu"

                    # Filtre anti-faux-positifs avec rejet de chevauchement sur personne
                    if not validate_fire_or_smoke(crop, class_name, conf, person_boxes=person_boxes_raw, fire_box=(x1, y1, x2, y2)):
                        continue

                    fire_detected = True
                    if conf > max_fire_conf:
                        max_fire_conf = conf

                    label_text = "Feu" if class_name == "wildfire" else "Fumee"
                    color = (0, 69, 255) if class_name == "wildfire" else (0, 140, 255)
                    new_boxes.append((x1, y1, x2, y2, f"{label_text} {int(conf * 100)}%", color))

            with _ai_lock:
                _current_boxes = new_boxes

            now = time.time()

            # Alertes & Captures photo automatiques sur détection de Feu
            if fire_detected:
                confidence = round(max_fire_conf * 100, 1)
                # Cooldown photo : 1 photo toutes les 4 secondes tant que le feu est visible
                if now - latest_detection.get("fire_snap_ts", 0) > 4.0:
                    latest_detection["fire_snap_ts"] = now
                    snap_frame = frame_to_process.copy()
                    for (bx1, by1, bx2, by2, blabel, bcolor) in new_boxes:
                        cv2.rectangle(snap_frame, (bx1, by1), (bx2, by2), bcolor, 2)
                        cv2.putText(snap_frame, blabel, (bx1, max(20, by1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, bcolor, 2)
                    save_capture_async("smoke", "fire", confidence, "Raspberry 4 (Fumée)", snap_frame)

                latest_detection["fire"] = True
                latest_detection["fire_ts"] = now
                print(f"[VIDEO] ALERTE : Fumée confirmée ! (Confiance max : {confidence}%)")
            else:
                if now - latest_detection.get("fire_ts", 0) > 4.0:
                    latest_detection["fire"] = False

            # Alertes & Captures photo automatiques sur détection de Personne
            if person_detected:
                confidence = round(max_person_conf * 100, 1)
                # Cooldown photo : 1 photo toutes les 4 secondes tant qu'une personne est présente
                if now - latest_detection.get("person_snap_ts", 0) > 4.0:
                    latest_detection["person_snap_ts"] = now
                    snap_frame = frame_to_process.copy()
                    for box in results_person[0].boxes:
                        bx1, by1, bx2, by2 = [int(v) for v in box.xyxy[0].tolist()]
                        bconf = float(box.conf[0])
                        cv2.rectangle(snap_frame, (bx1, by1), (bx2, by2), (255, 0, 0), 2)
                        cv2.putText(snap_frame, f"Personne {int(bconf * 100)}%", (bx1, max(20, by1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 0), 2)
                    save_capture_async("person", "warn", confidence, "Raspberry 4 (Personne)", snap_frame)

                latest_detection["person"] = True
                latest_detection["person_ts"] = now
                print(f"[VIDEO] INTRUSION : Personne détectée ! (Confiance max : {confidence}%)")
            else:
                if now - latest_detection.get("person_ts", 0) > 4.0:
                    latest_detection["person"] = False

            if not fire_detected and not person_detected:
                if now - last_ras_log > 8.0:
                    print("[SURVEILLANCE] Surveillance active en arrière-plan")
                    last_ras_log = now

            time.sleep(0.08)
        except Exception as e:
            print(f"Erreur Worker IA: {e}")
            time.sleep(0.1)

def _ensure_ai_worker():
    global _ai_thread_started
    if not _ai_thread_started:
        t = threading.Thread(target=_ai_worker_loop, daemon=True, name="YOLO_Inference_Worker")
        t.start()
        _ai_thread_started = True

def ensure_dns_resolvable(url: str):
    """
    Auto-guérison DNS pour les tunnels Cloudflare (*.trycloudflare.com).
    Si le résolveur DNS de l'hôte/Docker échoue (ex: Scaleway internal DNS ou propagation en cours),
    cette fonction interroge directement le DNS over HTTPS de Cloudflare (https://1.1.1.1/dns-query)
    et injecte l'IP dans /etc/hosts pour débloquer OpenCV et FFmpeg instantanément.
    """
    if not url:
        return
    try:
        parsed = urllib.parse.urlparse(url)
        hostname = (parsed.hostname or "").lower()
        if not hostname or hostname in ("localhost", "127.0.0.1") or hostname.replace(".", "").isdigit():
            return

        try:
            socket.gethostbyname(hostname)
            return
        except Exception:
            pass

        import ssl
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        req = urllib.request.Request(
            f"https://1.1.1.1/dns-query?name={hostname}&type=A",
            headers={"Accept": "application/dns-json", "User-Agent": "CamFire-DNS/1.0"}
        )
        with urllib.request.urlopen(req, timeout=3, context=ctx) as resp:
            data = json.loads(resp.read().decode())
            answers = data.get("Answer", [])
            ips = [a["data"] for a in answers if a.get("type") == 1]
            if ips:
                ip = ips[0]
                try:
                    with open("/etc/hosts", "r") as f:
                        content = f.read()
                    if hostname not in content:
                        with open("/etc/hosts", "a") as f:
                            f.write(f"\n{ip} {hostname}\n")
                        print(f"[DNS Auto-Healing] Résolu {hostname} -> {ip} via 1.1.1.1 (injecté dans /etc/hosts)")
                except Exception as fe:
                    print(f"[DNS Auto-Healing] Note /etc/hosts: {fe}")
    except Exception:
        pass

def apply_privacy_masks(img_frame, masks_json: Optional[str] = None):
    """Applique des masques opaques de confidentialité RGPD sur les zones privées définies."""
    if not masks_json or img_frame is None:
        return img_frame
    try:
        import json
        masks = json.loads(masks_json) if isinstance(masks_json, str) else masks_json
        if not isinstance(masks, list):
            return img_frame
        h, w = img_frame.shape[:2]
        for m in masks:
            if len(m) >= 4:
                x1, y1, x2, y2 = m[:4]
                # Coordonnées normalisées (0.0 - 1.0) ou absolues en pixels
                if x1 <= 1.0 and x2 <= 1.0 and y1 <= 1.0 and y2 <= 1.0:
                    px1, py1 = int(x1 * w), int(y1 * h)
                    px2, py2 = int(x2 * w), int(y2 * h)
                else:
                    px1, py1 = int(x1), int(y1)
                    px2, py2 = int(x2), int(y2)
                px1, py1 = max(0, px1), max(0, py1)
                px2, py2 = min(w, px2), min(h, py2)
                # Dessiner un bloc opaque discret avec libellé
                cv2.rectangle(img_frame, (px1, py1), (px2, py2), (18, 18, 24), -1)
                cv2.putText(img_frame, "ZONE PRIVEE (RGPD)", (px1 + 8, min(h - 5, py1 + 22)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (120, 120, 135), 1)
    except Exception as e:
        print(f"[RGPD] Erreur application masques: {e}")
    return img_frame

def generate_video_stream(camera_url: str, device_id: Optional[str] = None):
    global _current_raw_frame
    if _model is None:
        print("Modèle non chargé, impossible de traiter la vidéo.")
        return

    _ensure_ai_worker()

    dev_privacy_masks = None
    if device_id:
        try:
            from db.database import SessionLocal
            from db.models import Device
            with SessionLocal() as db_session:
                dev = db_session.query(Device).filter(Device.device_id == device_id.strip()).first()
                if dev and dev.privacy_masks:
                    dev_privacy_masks = dev.privacy_masks
        except Exception:
            pass

    while True:
        # Normalisation du protocole pour OpenCV / FFmpeg (ex: syntaxe VLC tcp/h264:// -> tcp://)
        current_url = camera_url
        if current_url and current_url.startswith("tcp/h264://"):
            current_url = "tcp://" + current_url[len("tcp/h264://"):]

        # Si l'URL HTTP pointe vers la racine d'un serveur caméra ou d'un tunnel Cloudflare, basculer vers /stream.mjpg
        if current_url and (current_url.startswith("http://") or current_url.startswith("https://")):
            clean_url = current_url.rstrip("/")
            if clean_url.endswith(":8080") or ("trycloudflare.com" in clean_url and not clean_url.endswith(".mjpg")):
                current_url = clean_url + "/stream.mjpg"

        # Résolution DNS prompte & auto-guérison anti-NXDOMAIN pour Cloudflare
        ensure_dns_resolvable(current_url)

        cap = None
        try:
            print(f"Tentative de connexion au flux {current_url} avec OpenCV...")
            cap = cv2.VideoCapture(current_url)
            if not cap.isOpened() and (current_url.startswith("http://") or current_url.startswith("https://")) and not current_url.endswith(".mjpg"):
                alt_url = current_url.rstrip("/") + "/stream.mjpg"
                cap = cv2.VideoCapture(alt_url)
                if cap.isOpened():
                    current_url = alt_url
            if not cap.isOpened():
                raise Exception("Flux indisponible (connexion impossible)")

            try:
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            except Exception:
                pass

            print("Connexion établie. Diffusion fluide du flux vidéo...")
            while True:
                ret, frame = cap.read()
                if not ret:
                    raise Exception("Perte du flux video ou fin du stream")

                # Formatage standard
                if frame.shape[0] != 480 or frame.shape[1] != 640:
                    frame = cv2.resize(frame, (640, 480))

                # Restauration automatique des couleurs NoIR (végétation verte, sol naturel, anti-rose)
                frame = correct_noir_colors(frame)

                # Application des masques de confidentialité RGPD à la source
                if dev_privacy_masks:
                    frame = apply_privacy_masks(frame, dev_privacy_masks)

                # Transmettre la frame au thread IA et récupérer les dernières boîtes
                with _ai_lock:
                    _current_raw_frame = frame
                    boxes = list(_current_boxes)

                # Dessiner les boîtes de détection sur l'image en temps réel (instantané, < 0.1ms)
                for (x1, y1, x2, y2, label, color) in boxes:
                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                    cv2.putText(frame, label, (x1, max(15, y1 - 8)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

                # Encodage JPEG rapide et envoi immédiat (fluide à 25-30 FPS réels)
                ret_enc, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                if ret_enc:
                    frame_bytes = buffer.tobytes()
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n'
                           b'Content-Length: ' + str(len(frame_bytes)).encode() + b'\r\n\r\n' + 
                           frame_bytes + b'\r\n')

        except Exception as e:
            if device_id:
                try:
                    from db.database import SessionLocal
                    from db.models import Device
                    with SessionLocal() as db_session:
                        dev = db_session.query(Device).filter(Device.device_id == device_id.strip()).first()
                        if dev and dev.stream_url and dev.stream_url != camera_url:
                            print(f"[Stream] Rafraîchissement automatique de l'URL pour {device_id}: {dev.stream_url}")
                            camera_url = dev.stream_url
                except Exception:
                    pass

            error_img = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(error_img, "CAMFIRE - EN ATTENTE DU FLUX", (40, 180), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.85, (0, 165, 255), 2, cv2.LINE_AA)
            display_url = (camera_url[:48] + "...") if len(str(camera_url)) > 48 else str(camera_url)
            cv2.putText(error_img, f"Cible: {display_url}", (40, 230), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1, cv2.LINE_AA)
            cv2.putText(error_img, "En attente du demarrage du stream sur le Pi...", (40, 270), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, (120, 220, 120), 1, cv2.LINE_AA)
            cv2.putText(error_img, f"Statut: {str(e)[:48]}", (40, 320), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (100, 100, 255), 1, cv2.LINE_AA)
            ret, buffer = cv2.imencode('.jpg', error_img)
            if ret:
                frame_bytes = buffer.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n'
                       b'Content-Length: ' + str(len(frame_bytes)).encode() + b'\r\n\r\n' + 
                       frame_bytes + b'\r\n')
            time.sleep(2)
        finally:
            if cap is not None:
                cap.release()

# Initialisation du modèle dès le chargement du fichier (au démarrage du serveur)
print("--- DÉMARRAGE DU SERVICE IA (YOLO) ---")
init_model()
