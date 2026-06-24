# Utilisation d'une image Python légère
FROM python:3.11-slim

# Définition du répertoire de travail
WORKDIR /app

# Installation des dépendances système (libgl1 remplace libgl1-mesa-glx)
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copie des fichiers de dépendances en premier pour optimiser le cache Docker
COPY requirements.txt .

# Installation des dépendances Python
RUN pip install --no-cache-dir -r requirements.txt

# Copie du reste du code source
COPY . .

# Définition de l'application Flask
ENV FLASK_APP=app.py
ENV FLASK_ENV=development

# Commande de lancement avec Flask
CMD ["flask", "run", "--host=0.0.0.0", "--port=8000"]