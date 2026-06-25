from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db.database import engine, Base
from routers import auth, contacts, scan

# Génère les tables si elles n'existent pas encore dans app.db
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CamFire API",
    description="API modulaire et sécurisée pour la PWA de détection de feux",
    version="1.0.0"
)

# Configuration CORS pour autoriser le conteneur Frontend (Vite roule sur le port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusion des routes du module d'authentification
app.include_router(auth.router)
app.include_router(contacts.router)
app.include_router(scan.router)

@app.get("/")
def read_root():
    return {"status": "healthy", "message": "CamFire API est opérationnelle"}