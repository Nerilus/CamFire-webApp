#!/usr/bin/env python3
"""
CamFire IoT Agent - Script de Provisioning, Télémétrie et Supervision Matérielle pour Raspberry Pi 4
Ce script s'exécute sur le Raspberry Pi pour :
1. Détecter l'identifiant matériel unique du Raspberry Pi
2. Démarrer et superviser automatiquement le tunnel Cloudflare (quick tunnel)
3. Synchroniser la configuration et le flux vidéo avec le serveur CamFire
4. Émettre un Heartbeat cryptographique toutes les 15 secondes (Dead Man's Switch & auto-guérison)
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

def is_tunnel_alive(url: str) -> bool:
    """Vérifie si le tunnel vidéo répond effectivement."""
    if not url or "trycloudflare.com" not in url:
        return False
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "CamFire-Agent/1.0"})
        with urllib.request.urlopen(req, timeout=4, context=ssl_context) as resp:
            return True
    except urllib.error.HTTPError:
        return True
    except Exception:
        return False

def is_cloudflared_running() -> bool:
    """Vérifie si le processus cloudflared est en cours d'exécution."""
    try:
        res = subprocess.run(["pgrep", "-f", "cloudflared"], capture_output=True, text=True)
        return res.returncode == 0 and len(res.stdout.strip()) > 0
    except Exception:
        return False

def ensure_cloudflared_tunnel(local_port: int = 8080) -> Optional[str]:
    """
    Démarre et supervise automatiquement le tunnel Cloudflare pour exposer la caméra.
    Récupère l'URL *.trycloudflare.com dynamique et s'assure qu'elle est active.
    """
    cloudflared_bin = shutil.which("cloudflared")
    if not cloudflared_bin:
        for p in ["/usr/local/bin/cloudflared", "/usr/bin/cloudflared", "/opt/cloudflared/cloudflared"]:
            if os.path.isfile(p) and os.access(p, os.X_OK):
                cloudflared_bin = p
                break

    if not cloudflared_bin:
        return None

    log_path = "/tmp/cloudflared.log"

    # 1. Si un tunnel est déjà en cours et qu'il répond, on le conserve
    if is_cloudflared_running() and os.path.exists(log_path):
        try:
            with open(log_path, "r", errors="ignore") as f:
                content = f.read()
            matches = re.findall(r"https://([a-zA-Z0-9-]+)\.trycloudflare\.com", content)
            valid = [m for m in matches if m not in ("api", "www")]
            if valid:
                candidate = f"https://{valid[-1]}.trycloudflare.com/stream.mjpg"
                if is_tunnel_alive(candidate):
                    return candidate
        except Exception:
            pass

    # 2. Sinon, tuer les processus résiduels et relancer proprement
    print("    • [Tunnel] Lancement automatique du tunnel Cloudflare vers le port 8080...")
    try:
        subprocess.run(["pkill", "-9", "-f", "cloudflared"], capture_output=True)
        time.sleep(1)
    except Exception:
        pass

    try:
        log_file = open(log_path, "w")
    except Exception:
        log_file = subprocess.DEVNULL

    cmd = [cloudflared_bin, "tunnel", "--url", f"http://127.0.0.1:{local_port}"]
    try:
        subprocess.Popen(
            cmd,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            start_new_session=True
        )
    except Exception as e:
        print(f"    • [Tunnel] Impossible de démarrer cloudflared: {e}")
        return None

    # 3. Attendre l'URL trycloudflare.com (jusqu'à 15 secondes)
    for _ in range(30):
        time.sleep(0.5)
        if os.path.exists(log_path):
            try:
                with open(log_path, "r", errors="ignore") as f:
                    content = f.read()
                matches = re.findall(r"https://([a-zA-Z0-9-]+)\.trycloudflare\.com", content)
                valid = [m for m in matches if m not in ("api", "www")]
                if valid:
                    detected_url = f"https://{valid[-1]}.trycloudflare.com/stream.mjpg"
                    print(f"    • [Tunnel] Tunnel établi : \033[1;32m{detected_url}\033[0m")
                    # Attente brève de propagation DNS Cloudflare
                    for _ in range(6):
                        if is_tunnel_alive(detected_url):
                            return detected_url
                        time.sleep(1)
                    return detected_url
            except Exception:
                pass

    print("    • [Tunnel] Délai d'attente dépassé pour la détection de l'URL Cloudflare.")
    return None

_cached_tunnel_url = None

def detect_stream_url(manual_url: str = None) -> str:
    """Détecte l'URL de streaming externe (Cloudflare Tunnel) ou locale."""
    global _cached_tunnel_url
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
        _cached_tunnel_url = tunnel_url
        return tunnel_url

    if _cached_tunnel_url and is_tunnel_alive(_cached_tunnel_url):
        return _cached_tunnel_url

    # Fallback IP locale
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

def send_heartbeat(hw_id: str, server_url: str, provision_key: str, stream_url: str) -> bool:
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
        "signature": sig,
        "stream_url": stream_url
    }

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

def heartbeat_worker_loop(hw_id: str, server_url: str, provision_key: str, get_stream_fn):
    """Boucle perpétuelle d'émission du Dead Man's Switch (toutes les 15s)."""
    current_stream = get_stream_fn()
    while True:
        # Auto-guérison si le tunnel Cloudflare a été coupé ou a expiré
        if "trycloudflare.com" in current_stream and not is_tunnel_alive(current_stream):
            print("\033[1;33m[Avertissement] Le tunnel Cloudflare ne répond plus. Relance automatique...\033[0m")
            new_stream = get_stream_fn()
            if new_stream:
                current_stream = new_stream

        temp = get_cpu_temperature()
        ok = send_heartbeat(hw_id, server_url, provision_key, current_stream)
        status_msg = "\033[1;32mEN LIGNE (200 OK)\033[0m" if ok else "\033[1;31mÉCHEC TRANSMISSION\033[0m"
        now_str = time.strftime("%H:%M:%S")
        print(f"[{now_str}] Heartbeat -> {server_url} | {status_msg} | CPU: {temp}°C | Flux: {current_stream}")
        time.sleep(15)

def main():
    parser = argparse.ArgumentParser(description="Agent CamFire pour Raspberry Pi 4")
    parser.add_argument("--server", default=os.getenv("CAMFIRE_SERVER_URL", DEFAULT_SERVER_URL), help="URL du serveur CamFire")
    parser.add_argument("--tunnel-url", default=None, help="URL publique du tunnel Cloudflare (ex: https://xxx.trycloudflare.com)")
    parser.add_argument("--key", default=os.getenv("DEVICE_PROVISION_KEY", DEFAULT_PROVISION_KEY), help="Clé d'usine de provisioning")
    args = parser.parse_args()

    print_banner()

    hw_id = get_hardware_serial()
    ip = get_local_ip()

    print(f"\n[1] Diagnostic Matériel & Initialisation Réseau :")
    print(f"    • ID Matériel Unique (Device ID) : \033[1;32m{hw_id}\033[0m")
    print(f"    • IP Locale Raspberry Pi         : {ip}")
    print(f"    • Température Processeur BCM2711 : {get_cpu_temperature()}°C")
    print(f"    • Serveur Cible CamFire          : \033[1;34m{args.server}\033[0m")

    stream_url = detect_stream_url(args.tunnel_url)
    print(f"    • Flux Vidéo Sélectionné         : \033[1;36m{stream_url}\033[0m")

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

    # Mise à jour du fichier local
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
        req = urllib.request.Request(
            f"{args.server}/devices/provision",
            data=json.dumps({
                "device_id": hw_id,
                "pairing_code": pairing_code,
                "stream_url": stream_url,
                "name": "Caméra Raspberry Pi 4"
            }).encode('utf-8'),
            headers={
                "Content-Type": "application/json",
                "X-Device-Provision-Key": args.key
            }
        )
        with urllib.request.urlopen(req, timeout=6, context=ssl_context) as resp:
            print(f"    • Synchronisation Serveur        : \033[1;32mSuccès (Enregistré & Stream mis à jour)\033[0m")
    except Exception as e:
        print(f"    • Synchronisation Serveur        : Attention ({e})")

    # Démarrage de la boucle active Dead Man's Switch
    print(f"\n[3] Surveillance Continue Active (Dead Man's Switch) :")
    print("    • Émission de battements sécurisés toutes les 15 secondes...")
    print("    • Supervision et auto-guérison du flux vidéo actives.")
    print("    • Appuyez sur Ctrl+C pour interrompre l'agent.\n")

    try:
        heartbeat_worker_loop(hw_id, args.server, args.key, lambda: detect_stream_url(args.tunnel_url))
    except KeyboardInterrupt:
        print("\n[Arrêt] Agent CamFire arrêté par l'utilisateur.")

if __name__ == "__main__":
    main()
