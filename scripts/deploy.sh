#!/usr/bin/env bash
# =============================================================================
# CamFire - Script de déploiement manuel en production
# Usage : bash scripts/deploy.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

echo "=========================================================="
echo "🚀 Déploiement de CamFire en production..."
echo "📂 Répertoire : $ROOT_DIR"
echo "=========================================================="

# 1. Vérification du fichier .env
if [ ! -f ".env" ]; then
    echo "⚠️ Aucun fichier .env trouvé. Copie depuis .env.production.example..."
    cp .env.production.example .env
    echo "Pensez à ajuster vos variables dans le fichier .env !"
fi

# 2. Synchronisation Git
echo "📥 Récupération des dernières modifications..."
git fetch origin main
git reset --hard origin/main

# 3. Reconstruction et démarrage des conteneurs
echo "🐳 Démarrage des conteneurs avec docker-compose.prod.yml..."
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

# 4. Nettoyage du cache Docker
echo "🧹 Nettoyage des images inutilisées..."
docker image prune -f

echo "=========================================================="
echo "✅ Déploiement terminé avec succès !"
echo "🌐 CamFire est accessible sur le port 80 de ce serveur."
echo "=========================================================="
