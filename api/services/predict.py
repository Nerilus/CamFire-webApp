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
from ultralytics import YOLO
from ultralytics.nn.tasks import DetectionModel

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
    
    print("Analyse de l'image en cours par les modèles YOLO IA...")
    # Lancer la prédiction avec un seuil de confiance plus bas (0.15) pour le feu
    results_fire = _model.predict(source=img, conf=0.15, verbose=False)
    
    # Lancer la prédiction pour les personnes (classe 0 dans COCO)
    results_person = _person_model.predict(source=img, classes=[0], conf=0.30, verbose=False)
    
    # Récupérer l'image avec les boîtes dessinées dessus (Feu/Fumée)
    res_plotted = results_fire[0].plot()
    
    # Extraire les métadonnées de détection
    detections = []
    
    is_fire = False
    max_fire_conf = 0.0
    
    # Détections du modèle Feu/Fumée
    if results_fire[0].boxes is not None:
        for box in results_fire[0].boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            class_name = _model.names[cls_id] if _model and hasattr(_model, 'names') else str(cls_id)
            
            is_fire = True
            if conf > max_fire_conf:
                max_fire_conf = conf
                
            detections.append({
                "bbox": [round(x1, 2), round(y1, 2), round(x2, 2), round(y2, 2)],
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
            
    if is_fire:
        confidence_percent = round(max_fire_conf * 100, 1)
        print(f"🔥 ALERTE : Il y a le feu ! (Analyse Image | Confiance max : {confidence_percent}%)")
        
        # Enregistrer l'alerte en base de données en arrière-plan
        save_alert_async("fire", "Scan Manuel", confidence_percent, "Non spécifié")
    else:
        print(f"🟢 RAS - Surveillance normale (Aucune détection de feu)")
    
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

def save_alert_async(status: str, location: str, confidence: float, coords: str):
    def _save():
        from db.database import SessionLocal
        from db.models import Alert
        db = SessionLocal()
        try:
            db.add(Alert(status=status, location=location, confidence=confidence, coords=coords))
            db.commit()
        except Exception as e:
            print(f"Erreur DB (Background): {e}")
        finally:
            db.close()
    threading.Thread(target=_save, daemon=True).start()

# Variable globale pour stocker le dernier état de détection
latest_detection = {
    "fire": False,
    "person": False,
    "confidence": 0.0,
    "timestamp": 0.0
}

def generate_video_stream(camera_url: str):
    global latest_detection
    if _model is None:
        print("Modèle non chargé, impossible de traiter la vidéo.")
        return

    print(f"Tentative de connexion au flux {camera_url} avec OpenCV...")
    
    try:
        # cv2.VideoCapture est beaucoup plus fiable pour parser l'authentification Digest et le MJPEG des caméras Axis
        cap = cv2.VideoCapture(camera_url)
        if not cap.isOpened():
            raise Exception("Impossible d'ouvrir le flux vidéo avec OpenCV")
            
        frame_count = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                raise Exception("Perte du flux vidéo ou fin du stream")
                
            frame_count += 1
            if frame_count % 10 != 0:
                continue
                
            # Optimisation: Baisser la résolution pour alléger l'encodage et le traitement
            frame = cv2.resize(frame, (640, 480))
            
            # Inférence YOLO (Feu & Personne)
            results_fire = _model.predict(source=frame, conf=0.25, verbose=False)
            results_person = _person_model.predict(source=frame, classes=[0], conf=0.30, verbose=False)
            
            annotated_frame = results_fire[0].plot()
            
            # Gestion Personnes
            person_detected = False
            max_person_conf = 0.0
            if len(results_person) > 0 and len(results_person[0].boxes) > 0:
                person_detected = True
                for box in results_person[0].boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    conf = float(box.conf[0])
                    if conf > max_person_conf:
                        max_person_conf = conf
                    cls_id = int(box.cls[0])
                    class_name = _person_model.names[cls_id] if hasattr(_person_model, 'names') else "person"
                    cv2.rectangle(annotated_frame, (int(x1), int(y1)), (int(x2), int(y2)), (255, 0, 0), 2)
                    label = f"{class_name} {conf:.2f}"
                    cv2.putText(annotated_frame, label, (int(x1), int(y1) - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)
            
            # Gestion Indépendante : Feu
            fire_detected = False
            max_fire_conf = 0.0
            if len(results_fire) > 0 and len(results_fire[0].boxes) > 0:
                fire_detected = True
                max_fire_conf = max([float(box.conf) for box in results_fire[0].boxes])
                
            if fire_detected:
                confidence = round(max_fire_conf * 100, 1)
                if not latest_detection.get("fire", False):
                    save_alert_async("fire", "AXIS M1065-L (Locale)", confidence, "46.2276°N 2.2137°E")
                latest_detection["fire"] = True
                latest_detection["fire_ts"] = time.time()
                print(f"[VIDEO] 🔥 ALERTE : Feu/Fumée détectée ! (Confiance max : {confidence}%)")
            else:
                if time.time() - latest_detection.get("fire_ts", 0) > 5.0:
                    latest_detection["fire"] = False

            # Gestion Indépendante : Personne
            if person_detected:
                confidence = round(max_person_conf * 100, 1)
                if not latest_detection.get("person", False):
                    save_alert_async("warn", "AXIS M1065-L (Personne)", confidence, "46.2276°N 2.2137°E")
                latest_detection["person"] = True
                latest_detection["person_ts"] = time.time()
                print(f"[VIDEO] 👤 INTRUSION : Personne détectée ! (Confiance max : {confidence}%)")
            else:
                if time.time() - latest_detection.get("person_ts", 0) > 5.0:
                    latest_detection["person"] = False
                    
            if not fire_detected and not person_detected:
                if frame_count % 30 == 0:
                    print("[VIDEO] 🟢 RAS - Surveillance vidéo normale")
                
            # Encodage en JPEG
            ret, buffer = cv2.imencode('.jpg', annotated_frame)
            if ret:
                frame_bytes = buffer.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n'
                       b'Content-Length: ' + str(len(frame_bytes)).encode() + b'\r\n\r\n' + 
                       frame_bytes + b'\r\n')
    except Exception as e:
        print(f"Erreur/Perte du flux vidéo: {e}")
        error_img = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(error_img, "ERREUR: CAMERA", (50, 200), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 3, cv2.LINE_AA)
        cv2.putText(error_img, str(e)[:60], (50, 260), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)
        ret, buffer = cv2.imencode('.jpg', error_img)
        if ret:
            # Yield several times so the browser doesn't close the stream immediately and shows the error
            for _ in range(10):
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
                time.sleep(0.5)

# Initialisation du modèle dès le chargement du fichier (au démarrage du serveur)
print("--- DÉMARRAGE DU SERVICE IA (YOLO) ---")
init_model()
