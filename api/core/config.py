import os

SECRET_KEY = os.getenv("SECRET_KEY", "VOTRE_CLE_SECRETE_SUPER_SECURISEE_A_CHANGER")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Pointeur vers le conteneur PostgreSQL défini dans le docker-compose
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://mon_user:mon_mot_de_passe@db:5432/mon_app_db"
)