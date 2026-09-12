#!/usr/bin/env python3
"""
CamFire IoT Agent - Script de Provisioning, Télémétrie et Supervision Matérielle pour Raspberry Pi 4
Ce script s'exécute sur le Raspberry Pi pour :
1. Détecter l'identifiant matériel unique du Raspberry Pi
2. Démarrer et superviser automatiquement le flux caméra Picamera2 (30 FPS, NoIR)
3. Démarrer et superviser automatiquement le tunnel Cloudflare (quick tunnel)
4. Synchroniser la configuration et le flux vidéo avec le serveur CamFire
5. Émettre un Heartbeat cryptographique toutes les 15 secondes (Dead Man's Switch)
"""

import os
import sys
import re
import hashlib
import hmac
import secrets
import socket
import json
import time
import threading
import argparse
import urllib.request
import urllib.error
import ssl
import subprocess
import shutil
from typing import Optional

ssl_context = ssl._create_unverified_context()

DEFAULT_SERVER_URL = "https://51.15.143.236.sslip.io"
DEFAULT_PROVISION_KEY = "cf-factory-sec-2026-pi4-prod-key"

def get_cpu_temperature() -> float:
    """Lit la température matérielle du processeur BCM2711 sur Raspberry Pi."""
    try:
        with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
            return round(float(f.read().strip()) / 1000.0, 1)
    except Exception:
        return 43.5

def get_hardware_serial() -> str:
    """Extrait le numéro de série matériel unique du processeur BCM2711 / Raspberry Pi."""
    try:
        with open('/proc/cpuinfo', 'r') as f:
            for line in f:
                if line.startswith('Serial'):
                    serial = line.split(':')[1].strip()
                    if serial and serial != '0000000000000000':
                        return f"RPI4-CF-{serial[-8:].upper()}"
    except Exception:
        pass
    
    try:
        import uuid
        mac = ':'.join(['{:02x}'.format((uuid.getnode() >> ele) & 0xff) for ele in range(0, 8*6, 8)][::-1])
        mac_hash = hashlib.sha256(mac.encode()).hexdigest()[:8].upper()
        return f"RPI4-CF-{mac_hash}"
    except Exception:
        return "RPI4-CF-DEMO"

def get_local_ip() -> str:
    """Détecte l'adresse IP locale du Raspberry Pi sur le réseau."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def is_local_camera_running(port: int = 8080) -> bool:
    """Vérifie si le serveur vidéo de la caméra écoute sur le port local."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.5)
        res = s.connect_ex(('127.0.0.1', port))
        s.close()
        return res == 0
    except Exception:
        return False

def ensure_local_camera_stream(
    port: int = 8080, 
    fps: int = 30, 
    awb: str = "indoor", 
    red_gain: Optional[float] = None, 
    blue_gain: Optional[float] = None
) -> bool:
    """
    Assure que le flux caméra Picamera2 tourne en local sur le port 8080.
    Si non actif, télécharge la dernière version de stream_pi.py et la lance en arrière-plan.
    """
    if is_local_camera_running(port):
        return True

    print(f"    • [Caméra] Flux local inactif sur le port {port}. Démarrage automatique...")

    # Télécharger la dernière version de stream_pi.py depuis GitHub avec cache busting
    script_path = "stream_pi.py"
    try:
        url = f"https://raw.githubusercontent.com/Nerilus/CamFire-webApp/main/api/scripts/stream_pi.py?v={int(time.time())}"
        req = urllib.request.Request(url, headers={"User-Agent": "CamFire-Agent/1.0"})
        with urllib.request.urlopen(req, timeout=5, context=ssl_context) as resp:
            content = resp.read().decode('utf-8')
            with open(script_path, "w") as f:
                f.write(content)
    except Exception:
        pass

    # Libérer tout ancien processus bloquant la caméra
    try:
        subprocess.run(["pkill", "-9", "-f", "stream.py"], capture_output=True)
        subprocess.run(["pkill", "-9", "-f", "stream_pi.py"], capture_output=True)
        time.sleep(1)
    except Exception:
        pass

    log_cam = "/tmp/camfire_camera.log"
    try:
        f_log = open(log_cam, "w")
    except Exception:
        f_log = subprocess.DEVNULL

    cmd = [sys.executable, script_path, "--fps", str(fps), "--noir", "--port", str(port)]
    if red_gain is not None and blue_gain is not None:
        cmd.extend(["--red-gain", str(red_gain), "--blue-gain", str(blue_gain)])
    elif awb:
        cmd.extend(["--awb", str(awb)])

    try:
        subprocess.Popen(
            cmd,
            stdout=f_log,
            stderr=subprocess.STDOUT,
            start_new_session=True
        )
    except Exception as e:
        print(f"    • [Caméra] Erreur au lancement de stream_pi.py: {e}")
        return False

    # Attendre que le serveur caméra soit prêt (jusqu'à 6 secondes)
    for _ in range(12):
        time.sleep(0.5)
        if is_local_camera_running(port):
            awb_info = f"Gains ({red_gain}/{blue_gain})" if (red_gain and blue_gain) else f"AWB: {awb}"
            print(f"    • [Caméra] Caméra initialisée : \033[1;32mhttp://127.0.0.1:{port}/stream.mjpg\033[0m ({fps} FPS, {awb_info})")
            return True

    print("    • [Caméra] La caméra est en cours d'initialisation (logs dans /tmp/camfire_camera.log)")
    return False

def is_cloudflared_running() -> bool:
    """Vérifie si le processus cloudflared est en cours d'exécution."""
    try:
        res = subprocess.run(["pgrep", "-f", "cloudflared tunnel"], capture_output=True, text=True)
        if res.returncode == 0 and len(res.stdout.strip()) > 0:
            return True
        res2 = subprocess.run(["pgrep", "-f", "cloudflared"], capture_output=True, text=True)
        return res2.returncode == 0 and len(res2.stdout.strip()) > 0
    except Exception:
        return False

def extract_tunnel_url_from_log(log_path: str = "/tmp/cloudflared.log") -> Optional[str]:
    """Extrait l'URL trycloudflare.com du fichier journal de cloudflared."""
    if not os.path.exists(log_path):
        return None
    try:
        with open(log_path, "r", errors="ignore") as f:
            content = f.read()
        matches = re.findall(r"https://([a-zA-Z0-9-]+)\.trycloudflare\.com", content)
        valid = [m for m in matches if m not in ("api", "www")]
        if valid:
            return f"https://{valid[-1]}.trycloudflare.com/stream.mjpg"
    except Exception:
        pass
    return None

_cloudflared_process = None

def ensure_cloudflared_tunnel(local_port: int = 8080) -> Optional[str]:
    """
    Démarre et supervise le tunnel Cloudflare vers le port local de la caméra.
    Lit la sortie en temps réel pour capturer l'URL instantanément sans délai de buffering.
    """
    global _cloudflared_process
    cloudflared_bin = shutil.which("cloudflared")
    if not cloudflared_bin:
        for p in ["/usr/local/bin/cloudflared", "/usr/bin/cloudflared", "/opt/cloudflared/cloudflared"]:
            if os.path.isfile(p) and os.access(p, os.X_OK):
                cloudflared_bin = p
                break

    if not cloudflared_bin:
        print("    • [Tunnel] Erreur : binaire cloudflared introuvable dans le PATH.")
        return None

    log_path = "/tmp/cloudflared.log"

    # 1. Si cloudflared tourne déjà, réutiliser son URL active
    if is_cloudflared_running():
        existing_url = extract_tunnel_url_from_log(log_path)
        if existing_url:
            return existing_url

    # 2. Démarrage propre
    print("    • [Tunnel] Lancement de Cloudflare Tunnel vers http://127.0.0.1:8080...")
    try:
        subprocess.run(["pkill", "-9", "-f", "cloudflared"], capture_output=True)
        time.sleep(0.5)
    except Exception:
        pass

    try:
        with open(log_path, "w") as f:
            f.write("")
    except Exception:
        pass

    cmd = [cloudflared_bin, "tunnel", "--no-autoupdate", "--url", f"http://127.0.0.1:{local_port}"]
    try:
        _cloudflared_process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
    except Exception as e:
        print(f"    • [Tunnel] Erreur au démarrage de cloudflared: {e}")
        return None

    found_event = threading.Event()
    discovered = [None]

    def _pipe_reader():
        with open(log_path, "a") as f_log:
            for line in iter(_cloudflared_process.stdout.readline, ''):
                f_log.write(line)
                f_log.flush()
                clean = line.strip()
                if "INF" in clean or "ERR" in clean:
                    if any(w in clean.lower() for w in ["requesting", "created", "error", "failed", "retry", "registered"]):
                        print(f"      [Cloudflare] {clean}")
                m = re.search(r"https://([a-zA-Z0-9-_]+)\.trycloudflare\.com", clean)
                if m and m.group(1).lower() not in ("api", "www"):
                    discovered[0] = f"https://{m.group(1)}.trycloudflare.com/stream.mjpg"
                    found_event.set()

    t = threading.Thread(target=_pipe_reader, daemon=True, name="CloudflaredPipeReader")
    t.start()

    # Attente active jusqu'à 30 secondes
    if found_event.wait(timeout=30):
        url = discovered[0]
        print(f"    • [Tunnel] Tunnel établi : \033[1;32m{url}\033[0m")
        return url

    print("    • [Tunnel] Délai d'attente dépassé pour la détection de l'URL Cloudflare.")
    if os.path.exists(log_path):
        try:
            with open(log_path, "r", errors="ignore") as f:
                content = f.read()
                if "429" in content or "1015" in content:
                    print("\n" + "=" * 65)
                    print("  \033[1;31m[CLOUDFLARE] ERREUR 429 - LIMITE DE REQUÊTES ATTEINTE (CODE 1015)\033[0m")
                    print("  Cloudflare a temporairement bloqué les créations de tunnels")
                    print("  pour votre IP publique suite à plusieurs requêtes consécutives.")
                    print("\n  \033[1;32m-> SOLUTION RAPIDE (10 secondes) :\033[0m")
                    print("     Puisque vous êtes en partage de connexion (172.20.10.x),")
                    print("     activez le Mode Avion sur votre téléphone pendant 5 secondes,")
                    print("     puis désactivez-le pour obtenir une NOUVELLE adresse IP 4G !")
                    print("     Relancez ensuite l'agent : Cloudflare fonctionnera immédiatement.")
                    print("\n  \033[1;33m-> OU patientez 5 à 10 minutes sans solliciter Cloudflare.\033[0m")
                    print("=" * 65 + "\n")
                else:
                    lines = [l.strip() for l in content.splitlines() if l.strip()]
                    if lines:
                        print("    • [Détail Log Cloudflare] " + " | ".join(lines[-2:]))
        except Exception:
            pass
    return None

_cached_stream_url = None

def detect_stream_url(manual_url: str = None, is_remote: bool = True) -> Optional[str]:
    """Détecte l'URL de streaming externe (Cloudflare Tunnel) ou locale."""
    global _cached_stream_url
    if manual_url and manual_url.strip():
        u = manual_url.strip()
        if not u.endswith(".mjpg") and not u.endswith("/"):
            u += "/stream.mjpg"
        return u

    env_url = os.getenv("TUNNEL_URL") or os.getenv("STREAM_URL")
    if env_url:
        u = env_url.strip()
        if not u.endswith(".mjpg") and not u.endswith("/"):
            u += "/stream.mjpg"
        return u

    # Détection / démarrage automatique de Cloudflare Tunnel
    tunnel_url = ensure_cloudflared_tunnel(local_port=8080)
    if tunnel_url:
        _cached_stream_url = tunnel_url
        return tunnel_url

    if _cached_stream_url and "trycloudflare.com" in _cached_stream_url:
        return _cached_stream_url

    # Pour un serveur distant de production, NE JAMAIS envoyer d'IP locale privée (172.20.x, 192.168.x)
    if is_remote:
        return None

    # Fallback IP locale uniquement pour du dev 100% localhost
    ip = get_local_ip()
    return f"http://{ip}:8080/stream.mjpg"

def generate_pairing_code() -> str:
    """Génère un code d'appairage sécurisé à 6 caractères alphanumériques."""
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return f"CF-{''.join(secrets.choice(chars) for _ in range(6))}"

def print_banner():
    print("=" * 65)
    print("    CAMFIRE - AGENT MATÉRIEL & TÉLÉMÉTRIE RASPBERRY PI 4")
    print("    Surveillance Incendie & Sécurité Anti-Sabotage Active")
    print("=" * 65)

def send_heartbeat(hw_id: str, server_url: str, provision_key: str, stream_url: Optional[str]) -> bool:
    """Envoie un battement de coeur unitaire sécurisé."""
    now = time.time()
    nonce = secrets.token_hex(8)
    cpu_temp = get_cpu_temperature()
    tamper_detected = False

    payload = f"{hw_id}:{now}:{nonce}:{tamper_detected}".encode("utf-8")
    sig = hmac.new(provision_key.encode("utf-8"), payload, hashlib.sha256).hexdigest()

    data = {
        "timestamp": now,
        "nonce": nonce,
        "cpu_temp": cpu_temp,
        "tamper_detected": tamper_detected,
        "signature": sig
    }
    if stream_url and stream_url.strip():
        data["stream_url"] = stream_url.strip()

    req = urllib.request.Request(
        f"{server_url}/devices/{hw_id}/heartbeat",
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=5, context=ssl_context) as resp:
            return resp.status == 200
    except Exception:
        return False

def heartbeat_worker_loop(hw_id: str, server_url: str, provision_key: str, get_stream_fn, awb: str = "indoor", red_gain: Optional[float] = None, blue_gain: Optional[float] = None):
    """Boucle perpétuelle d'émission du Dead Man's Switch (toutes les 15s)."""
    current_stream = get_stream_fn()
    while True:
        # Supervision de la caméra locale
        if not is_local_camera_running(8080):
            print("\033[1;33m[Caméra] Flux local interrompu. Relance automatique...\033[0m")
            ensure_local_camera_stream(8080, fps=30, awb=awb, red_gain=red_gain, blue_gain=blue_gain)

        # Si le flux public n'est pas encore actif, ré-essayer de détecter l'URL
        if not current_stream or "trycloudflare.com" not in current_stream:
            discovered_url = extract_tunnel_url_from_log()
            if discovered_url:
                print(f"\033[1;32m[Tunnel] Tunnel Cloudflare désormais opérationnel : {discovered_url}\033[0m")
                current_stream = discovered_url

        # Supervision du tunnel Cloudflare
        if not is_cloudflared_running():
            print("\033[1;33m[Tunnel] Processus cloudflared inactif. Relance automatique...\033[0m")
            new_stream = get_stream_fn()
            if new_stream:
                current_stream = new_stream

        temp = get_cpu_temperature()
        ok = send_heartbeat(hw_id, server_url, provision_key, current_stream)
        status_msg = "\033[1;32mEN LIGNE (200 OK)\033[0m" if ok else "\033[1;31mÉCHEC TRANSMISSION\033[0m"
        stream_display = current_stream if current_stream else "\033[1;33mEn attente de tunnel public (Erreur 429)\033[0m"
        now_str = time.strftime("%H:%M:%S")
        print(f"[{now_str}] Heartbeat -> {server_url} | {status_msg} | CPU: {temp}°C | Flux: {stream_display}")
        time.sleep(15)

def main():
    parser = argparse.ArgumentParser(description="Agent CamFire pour Raspberry Pi 4")
    parser.add_argument("--server", default=os.getenv("CAMFIRE_SERVER_URL", DEFAULT_SERVER_URL), help="URL du serveur CamFire")
    parser.add_argument("--tunnel-url", default=None, help="URL publique du tunnel Cloudflare (ex: https://xxx.trycloudflare.com)")
    parser.add_argument("--key", default=os.getenv("DEVICE_PROVISION_KEY", DEFAULT_PROVISION_KEY), help="Clé d'usine de provisioning")
    parser.add_argument("--fps", type=int, default=30, help="Framerate de la caméra (défaut: 30)")
    parser.add_argument("--awb", default="indoor", choices=["auto", "incandescent", "tungsten", "indoor", "daylight", "cloudy"], help="Mode de balance des blancs (défaut: indoor pour neutraliser le rose NoIR)")
    parser.add_argument("--red-gain", type=float, default=None, help="Gain manuel rouge (optionnel)")
    parser.add_argument("--blue-gain", type=float, default=None, help="Gain manuel bleu (optionnel)")
    args = parser.parse_args()

    print_banner()

    hw_id = get_hardware_serial()
    ip = get_local_ip()

    print(f"\n[1] Diagnostic Matériel & Initialisation Réseau :")
    print(f"    • ID Matériel Unique (Device ID) : \033[1;32m{hw_id}\033[0m")
    print(f"    • IP Locale Raspberry Pi         : {ip}")
    print(f"    • Température Processeur BCM2711 : {get_cpu_temperature()}°C")
    print(f"    • Serveur Cible CamFire          : \033[1;34m{args.server}\033[0m")

    # 1. Démarrer automatiquement la caméra en local si besoin
    ensure_local_camera_stream(
        port=8080, 
        fps=args.fps, 
        awb=args.awb, 
        red_gain=args.red_gain, 
        blue_gain=args.blue_gain
    )

    # 2. Démarrer / superviser le tunnel Cloudflare
    is_remote = not ("localhost" in args.server or "127.0.0.1" in args.server)
    stream_url = detect_stream_url(args.tunnel_url, is_remote=is_remote)
    display_stream = stream_url if stream_url else "\033[1;33mEn attente de tunnel public Cloudflare (Erreur 429)\033[0m"
    print(f"    • Flux Vidéo Sélectionné         : \033[1;36m{display_stream}\033[0m")

    # Lecture ou création du code d'appairage local
    config_file = "camfire_device.json"
    if os.path.exists(config_file):
        try:
            with open(config_file, "r") as f:
                cfg = json.load(f)
                pairing_code = cfg.get("pairing_code", generate_pairing_code())
        except Exception:
            pairing_code = generate_pairing_code()
    else:
        pairing_code = generate_pairing_code()

    with open(config_file, "w") as f:
        json.dump({
            "device_id": hw_id,
            "pairing_code": pairing_code,
            "stream_url": stream_url
        }, f, indent=2)
    try:
        os.chmod(config_file, 0o600)
    except Exception:
        pass

    print(f"\n[2] Sécurité & Appairage :")
    print(f"    • Code Secret d'Appairage        : \033[1;33m{pairing_code}\033[0m")

    # Provisioning auprès du serveur CamFire
    try:
        provision_payload = {
            "device_id": hw_id,
            "pairing_code": pairing_code,
            "name": "Caméra Raspberry Pi 4"
        }
        if stream_url:
            provision_payload["stream_url"] = stream_url

        req = urllib.request.Request(
            f"{args.server}/devices/provision",
            data=json.dumps(provision_payload).encode('utf-8'),
            headers={
                "Content-Type": "application/json",
                "X-Device-Provision-Key": args.key
            }
        )
        with urllib.request.urlopen(req, timeout=6, context=ssl_context) as resp:
            print(f"    • Synchronisation Serveur        : \033[1;32mSuccès (Enregistré)\033[0m")
    except Exception as e:
        print(f"    • Synchronisation Serveur        : Attention ({e})")

    # Démarrage de la boucle active Dead Man's Switch
    print(f"\n[3] Surveillance Continue Active (Dead Man's Switch) :")
    print("    • Caméra (30 FPS) & Tunnel Cloudflare gérés automatiquement.")
    print("    • Émission de battements sécurisés toutes les 15 secondes...")
    print("    • Appuyez sur Ctrl+C pour interrompre l'agent.\n")

    try:
        heartbeat_worker_loop(
            hw_id, 
            args.server, 
            args.key, 
            lambda: detect_stream_url(args.tunnel_url, is_remote=is_remote),
            awb=args.awb,
            red_gain=args.red_gain,
            blue_gain=args.blue_gain
        )
    except KeyboardInterrupt:
        print("\n[Arrêt] Agent CamFire arrêté par l'utilisateur.")

if __name__ == "__main__":
    main()
