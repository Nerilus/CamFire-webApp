import os

SECRET_KEY = os.getenv("SECRET_KEY", "VOTRE_CLE_SECRETE_SUPER_SECURISEE_A_CHANGER")
ALGORITHM = "HS256"
# Durée de validité du jeton de session (par défaut 30 jours = 43200 minutes pour garder la session active)
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 24 * 30))

# Pointeur vers le conteneur PostgreSQL défini dans le docker-compose
# Si on est hors Docker, on pointe vers localhost par défaut.
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://mon_user:mon_mot_de_passe@localhost:5432/mon_app_db"
)

# URL du flux caméra (supporte HTTP/MJPEG, TCP, RTSP)
CAMERA_URL = os.getenv("CAMERA_URL", "http://172.20.10.2:8080/")

# Configuration SMTP optionnelle pour les e-mails de compte et d'appareil.
SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "").strip()
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

# Clé secrète de provisioning machine-to-cloud pour Raspberry Pi
DEVICE_PROVISION_KEY = os.getenv("DEVICE_PROVISION_KEY", "cf-factory-sec-2026-pi4-prod-key")