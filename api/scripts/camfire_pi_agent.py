#!/usr/bin/env python3
"""
CamFire IoT Agent - Script de Provisioning et de Supervision Matérielle pour Raspberry Pi 4
Ce script s'exécute sur le Raspberry Pi pour extraire son identifiant matériel unique,
générer ou afficher le code secret d'appairage, et tester la connectivité au serveur CamFire.
"""

import os
import sys
import hashlib
import secrets
import socket
import json
import urllib.request
import urllib.error

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
    
    # Fallback si testé sur macOS ou machine de dev (utilise l'adresse MAC)
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

def generate_pairing_code() -> str:
    """Génère un code d'appairage sécurisé à 6 chiffres/caractères."""
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return f"CF-{''.join(secrets.choice(chars) for _ in range(6))}"

def print_banner():
    print("=" * 60)
    print("🔥  CAMFIRE - AGENT MATÉRIEL RASPBERRY PI 4")
    print("    Système Intelligent de Télésurveillance Incendie")
    print("=" * 60)

def main():
    print_banner()
    
    hw_id = get_hardware_serial()
    ip = get_local_ip()
    stream_url = f"http://{ip}:8080/"

    print(f"\n[1] Informations Matérielles Détectées :")
    print(f"    • Modèle           : Raspberry Pi 4 Model B")
    print(f"    • Identifiant Matériel (Device ID) : \033[1;32m{hw_id}\033[0m")
    print(f"    • Adresse IP Locale                : {ip}")
    print(f"    • Flux Vidéo Local                 : {stream_url}")

    # Vérification fichier de configuration local
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

    print(f"\n[2] Clé d'Appairage Cryptographique (TTL 24h) :")
    print(f"    • Code Secret d'Appairage : \033[1;33m{pairing_code}\033[0m")

    # Tentative d'enregistrement automatique authentifiée auprès du serveur CamFire
    server_url = os.getenv("CAMFIRE_SERVER_URL", "http://172.20.10.1:8000")
    provision_key = os.getenv("DEVICE_PROVISION_KEY", "cf-factory-sec-2026-pi4-prod-key")
    try:
        req = urllib.request.Request(
            f"{server_url}/devices/provision",
            data=json.dumps({
                "device_id": hw_id,
                "pairing_code": pairing_code,
                "stream_url": stream_url,
                "name": "Raspberry 4"
            }).encode('utf-8'),
            headers={
                "Content-Type": "application/json",
                "X-Device-Provision-Key": provision_key
            }
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            print(f"    • Serveur CamFire          : \033[1;32mConnecté & Provisionné de manière sécurisée\033[0m")
    except Exception as e:
        print(f"    • Serveur CamFire          : Non joignable à {server_url} ({e})")

    print("\n" + "-" * 60)
    print("ℹ️  INSTRUCTIONS D'ASSOCIATION À VOTRE COMPTE :")
    print("   1. Rendez-vous sur l'application Web CamFire.")
    print("   2. Dans l'interface (ou Inscription -> Lier un appareil) :")
    print(f"      - Device ID   : {hw_id}")
    print(f"      - Code Secret : {pairing_code}")
    print("-" * 60 + "\n")

if __name__ == "__main__":
    main()
