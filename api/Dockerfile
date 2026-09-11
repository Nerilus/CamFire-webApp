# Utilisation d'une image Python légère
FROM python:3.11-slim

# Définition du répertoire de travail
WORKDIR /app

# Installation des dépendances système (nécessaires pour le traitement vidéo/image)
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copie des fichiers de dépendances en premier pour optimiser le cache Docker
COPY requirements.txt .

# Mise à jour pip pour éviter les problèmes de hash check (pip 24 bug)
RUN pip install --upgrade pip

# Installation de PyTorch CPU-only ultra-léger (économise ~5 Go en évitant les lourdes dépendances NVIDIA CUDA sur VPS)
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Installation des dépendances Python
RUN pip install --no-cache-dir -r requirements.txt

# Copie du reste du code source
COPY . .

# Lancement avec Uvicorn (FastAPI) au lieu de Flask
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]