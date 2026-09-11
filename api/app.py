import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from db.database import engine, Base
from routers import auth, contacts, scan, weather, alerts, devices, sites, captures
from services.discord import send_discord_alert_sync

import threading
import time
from datetime import datetime, timedelta
from sqlalchemy import text

# Génère les tables si elles n'existent pas encore
Base.metadata.create_all(bind=engine)

# Migration automatique pour les colonnes de sécurité & Dead Man's Switch
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE user_devices ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'owner';"))
        conn.execute(text("ALTER TABLE devices ADD COLUMN IF NOT EXISTS code_expires_at TIMESTAMP;"))
        conn.execute(text("ALTER TABLE devices ADD COLUMN IF NOT EXISTS tamper_status VARCHAR DEFAULT 'normal';"))
        conn.execute(text("ALTER TABLE devices ADD COLUMN IF NOT EXISTS cpu_temp FLOAT;"))
        conn.execute(text("ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_tamper_alert_at TIMESTAMP;"))
        # Colonnes 2FA pour la table users
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_2fa_enabled BOOLEAN DEFAULT TRUE;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code_hash VARCHAR;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_attempts INTEGER DEFAULT 0;"))
        conn.commit()
    print("[MIGRATION] Tables et colonnes 2FA vérifiées avec succès.")
except Exception as e:
    print(f"[MIGRATION WARNING] {e}")

# Daemon Dead Man's Switch : Surveillance active des coupures brutales (Anti-Pyromane / Sabotage)
def _dead_man_switch_loop():
    time.sleep(10) # Attente initialisation complète
    while True:
        try:
            time.sleep(15)
            from db.database import SessionLocal
            from db.models import Device, Alert
            db = SessionLocal()
            try:
                now = datetime.utcnow()
                paired_devices = db.query(Device).filter(Device.is_paired == True).all()
                for dev in paired_devices:
                    if dev.last_seen_at is None:
                        continue
                    silence_duration = (now - dev.last_seen_at).total_seconds()
                    # Si aucun signal reçu depuis > 45 secondes
                    if silence_duration > 45:
                        cooldown = (now - dev.last_tamper_alert_at).total_seconds() if dev.last_tamper_alert_at else 9999
                        if cooldown > 900: # 15 minutes entre chaque alerte pour éviter le spam
                            dev.tamper_status = "signal_lost"
                            dev.last_tamper_alert_at = now
                            alert = Alert(
                                status="warn",
                                location=f"{dev.name} — COUPURE DE SIGNAL (Dead Man's Switch)",
                                coords=f"{dev.lat}°N {dev.lng}°E",
                                confidence=95.0,
                                detection_type="tamper",
                                date=now
                            )
                            db.add(alert)
                            db.commit()
                            print(f"[DEAD MAN'S SWITCH] Alerte securite : {dev.name} ({dev.device_id}) silencieux depuis {int(silence_duration)}s")
                            send_discord_alert_sync("tamper", f"{dev.name} (Coupe)", 95.0)
            except Exception as err:
                print(f"[DEAD MAN'S SWITCH DB ERROR] {err}")
            finally:
                db.close()
        except Exception as ge:
            print(f"[DEAD MAN'S SWITCH WORKER ERROR] {ge}")

threading.Thread(target=_dead_man_switch_loop, daemon=True, name="DeadManSwitch_Worker").start()



# Création du dossier statique pour les captures de photos
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
CAPTURES_DIR = os.path.join(STATIC_DIR, "captures")
os.makedirs(CAPTURES_DIR, exist_ok=True)

app = FastAPI(
    title="CamFire API",
    description="API modulaire et sécurisée pour la PWA de détection de feux",
    version="1.0.0"
)

# Montage du répertoire statique pour servir les photos de captures
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Configuration CORS pour autoriser le frontend (localhost, 127.0.0.1, et réseau local pour la PWA)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusion des routes du module d'authentification et gestion sécurisée des équipements
app.include_router(auth.router)
app.include_router(devices.router)
app.include_router(sites.router)
app.include_router(captures.router)
app.include_router(contacts.router)
app.include_router(scan.router)
app.include_router(weather.router)
app.include_router(alerts.router)

@app.get("/")
def read_root():
    return {"status": "healthy", "message": "CamFire API est opérationnelle"}