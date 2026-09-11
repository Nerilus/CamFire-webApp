#!/usr/bin/env bash
# =============================================================================
# CamFire - Configuration HTTPS / SSL automatique avec Certbot (Let's Encrypt)
# Usage : sudo bash scripts/setup-ssl.sh votredomaine.com votre_email@domaine.com
# =============================================================================

set -e

DOMAIN="$1"
EMAIL="$2"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "Usage : sudo bash scripts/setup-ssl.sh <domaine.com> <email@domaine.com>"
    echo "Exemple : sudo bash scripts/setup-ssl.sh camfire.mondomaine.com contact@mondomaine.com"
    exit 1
fi

if [ "$EUID" -ne 0 ]; then
  echo "❌ Ce script doit être exécuté en root (sudo)."
  exit 1
fi

echo "=========================================================="
echo "🔒 Configuration SSL Let's Encrypt pour $DOMAIN"
echo "=========================================================="

# 1. Installation de certbot
apt-get update -y
apt-get install -y certbot

# 2. Arrêt temporaire du conteneur frontend pour libérer le port 80 pendant la vérification ACME
echo "⏸️ Arrêt temporaire de CamFire frontend..."
docker stop camfire-frontend || true

# 3. Génération du certificat Let's Encrypt
echo "📜 Obtention du certificat SSL..."
certbot certonly --standalone \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive \
    --preferred-challenges http

echo "✅ Certificat SSL généré dans /etc/letsencrypt/live/$DOMAIN/"

# 4. Redémarrage du conteneur
echo "▶️ Redémarrage des conteneurs CamFire..."
docker start camfire-frontend || docker compose -f docker-compose.prod.yml up -d

echo ""
echo "=========================================================="
echo "🎉 Certificat SSL configuré avec succès !"
echo "Le renouvellement automatique est géré par certbot timer."
echo "=========================================================="
