import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from db.database import engine, Base
from routers import auth, contacts, scan, weather, alerts, devices, sites, captures

from sqlalchemy import text

# Génère les tables si elles n'existent pas encore
Base.metadata.create_all(bind=engine)

# Migration automatique pour les colonnes de sécurité
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE user_devices ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'owner';"))
        conn.execute(text("ALTER TABLE devices ADD COLUMN IF NOT EXISTS code_expires_at TIMESTAMP;"))
        conn.commit()
except Exception as e:
    print(f"[MIGRATION WARNING] {e}")


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