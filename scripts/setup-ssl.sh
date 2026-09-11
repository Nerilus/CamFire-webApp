#!/usr/bin/env bash
# =============================================================================
# CamFire - Configuration HTTPS / SSL automatique avec Certbot (Let's Encrypt)
# Usage : sudo bash scripts/setup-ssl.sh [domaine] [email]
# Exemple : sudo bash scripts/setup-ssl.sh 51.15.143.236.sslip.io nerilus.h@gmail.com
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Détection automatique de l'IP si domaine non fourni
VPS_IP=$(curl -s4 ifconfig.me || hostname -I | awk '{print $1}')
DOMAIN="${1:-${VPS_IP}.sslip.io}"
EMAIL="${2:-nerilus.h@gmail.com}"

if [ "$EUID" -ne 0 ]; then
  echo "❌ Ce script doit être exécuté en root (sudo bash scripts/setup-ssl.sh)."
  exit 1
fi

echo "=========================================================="
echo "🔒 Configuration SSL Let's Encrypt pour : $DOMAIN"
echo "📧 Adresse e-mail de notification : $EMAIL"
echo "=========================================================="

# 1. Installation de certbot
if ! command -v certbot >/dev/null 2>&1; then
    echo "📦 Installation de Certbot..."
    apt-get update -y
    apt-get install -y certbot
else
    echo "✅ Certbot est déjà installé."
fi

# 2. Arrêt temporaire du conteneur frontend pour libérer le port 80 pendant la vérification ACME
echo "⏸️ Libération temporaire du port 80..."
docker stop camfire-frontend 2>/dev/null || true

# 3. Génération du certificat Let's Encrypt
echo "📜 Obtention du certificat SSL auprès de Let's Encrypt..."
certbot certonly --standalone \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive \
    --preferred-challenges http

echo "✅ Certificat SSL généré dans /etc/letsencrypt/live/$DOMAIN/"

# 4. Copie des certificats dans le dossier certs du projet pour Nginx
mkdir -p "$ROOT_DIR/certs"
cp -L "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$ROOT_DIR/certs/fullchain.pem"
cp -L "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$ROOT_DIR/certs/privkey.pem"
chmod 644 "$ROOT_DIR/certs/fullchain.pem"
chmod 600 "$ROOT_DIR/certs/privkey.pem"

# 5. Redémarrage des conteneurs CamFire
echo "▶️ Redémarrage des conteneurs CamFire avec SSL..."
cd "$ROOT_DIR"
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "=========================================================="
echo "🎉 Certificat SSL configuré avec succès !"
echo "🌐 Votre application est maintenant accessible de manière sécurisée sur :"
echo "👉 https://$DOMAIN/"
echo "=========================================================="
