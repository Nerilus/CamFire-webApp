#!/usr/bin/env bash
# =============================================================================
# CamFire - Script d'installation automatique du VPS (Ubuntu / Debian)
# Usage : curl -fsSL https://raw.githubusercontent.com/Nerilus/CamFire-webApp/main/scripts/setup-vps.sh | sudo bash
# ou : sudo bash scripts/setup-vps.sh
# =============================================================================

set -e

echo "=========================================================="
echo "🔥 Configuration du serveur VPS pour CamFire Production"
echo "=========================================================="

# Vérification des droits root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Ce script doit être exécuté avec les privilèges root (ex: sudo bash setup-vps.sh)."
  exit 1
fi

TARGET_USER="${SUDO_USER:-$USER}"
if [ "$TARGET_USER" = "root" ] && id -u ubuntu >/dev/null 2>&1; then
    TARGET_USER="ubuntu"
fi

USER_HOME=$(getent passwd "$TARGET_USER" | cut -d: -f6)
DEPLOY_DIR="$USER_HOME/CamFire-webApp"

echo "👤 Utilisateur système cible : $TARGET_USER"
echo "📂 Dossier de déploiement : $DEPLOY_DIR"

# 1. Mise à jour des paquets système
echo "📦 Mise à jour des paquets système..."
apt-get update -y && apt-get upgrade -y

# 2. Installation des prérequis
echo "🔧 Installation des paquets essentiels (curl, git, ufw, ca-certificates)..."
apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    ufw \
    openssl

# 3. Installation officielle de Docker Engine & Docker Compose Plugin
if ! command -v docker >/dev/null 2>&1; then
    echo "🐳 Installation de Docker..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
    echo "✅ Docker est déjà installé."
fi

# 4. Ajout de l'utilisateur au groupe docker
usermod -aG docker "$TARGET_USER"
systemctl enable docker
systemctl start docker

# 5. Configuration du pare-feu (UFW)
echo "🛡️ Configuration du pare-feu UFW..."
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP CamFire Web'
ufw allow 443/tcp comment 'HTTPS CamFire Web'
ufw --force enable

# 6. Préparation du répertoire de déploiement
echo "📁 Préparation du dossier de l'application..."
if [ ! -d "$DEPLOY_DIR" ]; then
    echo "📥 Clonage du dépôt Git CamFire-webApp..."
    git clone https://github.com/Nerilus/CamFire-webApp.git "$DEPLOY_DIR"
    chown -R "$TARGET_USER":"$TARGET_USER" "$DEPLOY_DIR"
else
    echo "✅ Le dossier $DEPLOY_DIR existe déjà."
fi

# 7. Préparation du fichier .env
if [ ! -f "$DEPLOY_DIR/.env" ]; then
    if [ -f "$DEPLOY_DIR/.env.production.example" ]; then
        echo "📝 Création de .env à partir du modèle..."
        cp "$DEPLOY_DIR/.env.production.example" "$DEPLOY_DIR/.env"
        # Génération automatique d'une clé secrète robuste
        GEN_SECRET=$(openssl rand -hex 32)
        sed -i "s/votre_cle_secrete_ultra_securisee_a_remplacer_obligatoirement/$GEN_SECRET/" "$DEPLOY_DIR/.env"
        chown "$TARGET_USER":"$TARGET_USER" "$DEPLOY_DIR/.env"
        chmod 600 "$DEPLOY_DIR/.env"
        echo "🔑 Une nouvelle clé SECRET_KEY a été générée automatiquement dans .env."
    fi
fi

# 8. Génération d'une paire de clés SSH pour GitHub Actions (si non existante)
SSH_DIR="$USER_HOME/.ssh"
mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"
chown "$TARGET_USER":"$TARGET_USER" "$SSH_DIR"

DEPLOY_KEY="$SSH_DIR/camfire_deploy_key"
if [ ! -f "$DEPLOY_KEY" ]; then
    echo "🔑 Génération d'une paire de clés SSH dédiée pour GitHub Actions..."
    ssh-keygen -t ed25519 -C "github-actions-camfire" -f "$DEPLOY_KEY" -N "" -q
    cat "$DEPLOY_KEY.pub" >> "$SSH_DIR/authorized_keys"
    chmod 600 "$SSH_DIR/authorized_keys"
    chown -R "$TARGET_USER":"$TARGET_USER" "$SSH_DIR"
fi

echo ""
echo "=========================================================="
echo "🎉 Installation terminée avec succès sur votre VPS !"
echo "=========================================================="
echo ""
echo "👉 Pour configurer le déploiement automatique sur GitHub :"
echo "Allez dans votre repo GitHub > Settings > Secrets and variables > Actions"
echo "et ajoutez les secrets suivants :"
echo ""
echo "1) VPS_HOST       : $(curl -s ifconfig.me || hostname -I | awk '{print $1}')"
echo "2) VPS_USER       : $TARGET_USER"
echo "3) VPS_PORT       : 22"
echo "4) VPS_DEPLOY_PATH: $DEPLOY_DIR"
echo "5) VPS_SSH_KEY    : (Copiez la clé privée ci-dessous)"
echo ""
echo "------------------- CLÉ PRIVÉE SSH (À copier) -------------------"
cat "$DEPLOY_KEY"
echo "-----------------------------------------------------------------"
echo ""
echo "👉 Pour démarrer l'application manuellement dès maintenant :"
echo "cd $DEPLOY_DIR && docker compose -f docker-compose.prod.yml up -d --build"
echo ""
