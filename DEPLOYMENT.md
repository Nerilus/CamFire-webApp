# Guide de Déploiement en Production & CI/CD — CamFire

Ce guide explique étape par étape comment déployer **CamFire** sur votre propre **serveur VPS** (Ubuntu ou Debian) et activer le **déploiement continu automatique** (CI/CD via GitHub Actions) à chaque `git push` sur la branche `main`.

---

## Architecture de Production

L'architecture de production est pensée pour être **légère, rapide et hautement sécurisée** :

- **Frontend React (SPA)** : Compilé en statique avec Vite, servi par un conteneur **Nginx** haute performance avec compression Gzip et cache des assets.
- **Reverse Proxy Nginx** : Écoute sur le **port 80** public et redirige automatiquement les appels d'API (`/auth`, `/devices`, `/sites`, `/captures`, `/scan`, `/static`, etc.) vers le backend FastAPI. **Zéro problème de CORS** car le frontend et l'API sont sur la même origine.
- **Backend FastAPI** : Tourne sur Uvicorn avec 2 workers de production sans rechargement à chaud (`--workers 2`).
- **PostgreSQL 15** : Base de données isolée dans le réseau Docker interne (**non exposée sur internet** pour une sécurité maximale). Les données sont conservées sur le volume persistant `postgres_prod_data`.
- **Captures d'images** : Stockées sur le volume persistant Docker `captures_data`.

---

## Étape 1 : Initialisation de votre VPS (1 seule commande)

Connectez-vous à votre VPS en SSH :
```bash
ssh utilisateur@ip_de_votre_vps
```

Exécutez le script d'initialisation automatique :
```bash
curl -fsSL https://raw.githubusercontent.com/Nerilus/CamFire-webApp/main/scripts/setup-vps.sh | sudo bash
```

### Ce que fait ce script automatiquement :
1. Installe **Docker** et le plugin **Docker Compose**.
2. Configure le pare-feu **UFW** (ouvre uniquement les ports nécessaires : `22` pour SSH, `80` pour HTTP, `443` pour HTTPS).
3. Clone le dépôt dans `~/CamFire-webApp`.
4. Initialise le fichier de configuration `.env` avec une clé secrète sécurisée (`SECRET_KEY`).
5. **Génère une paire de clés SSH dédiée** et affiche la clé privée prête à copier dans GitHub Secrets !

---

## Étape 2 : Configuration des Secrets GitHub Actions (CI/CD)

Pour que chaque `git push main` déploie automatiquement le projet sur votre VPS, configurez les secrets dans GitHub :

1. Allez sur votre dépôt GitHub : **Settings** > **Secrets and variables** > **Actions** > bouton **New repository secret**.
2. Ajoutez les secrets suivants :

| Nom du Secret | Description | Exemple |
|---|---|---|
| `VPS_HOST` | Adresse IP publique ou nom de domaine de votre VPS | `198.51.100.24` |
| `VPS_USER` | Utilisateur SSH configuré sur le VPS | `ubuntu` ou `root` |
| `VPS_SSH_KEY` | La clé privée SSH générée par `setup-vps.sh` | `-----BEGIN OPENSSH PRIVATE KEY----- ...` |
| `VPS_PORT` | Port SSH (Optionnel, 22 par défaut) | `22` |
| `VPS_DEPLOY_PATH` | Répertoire d'installation sur le VPS | `/home/ubuntu/CamFire-webApp` |

---

## Étape 3 : Personnalisation du fichier `.env` sur le VPS

Sur le VPS, rendez-vous dans le dossier de l'application :
```bash
cd ~/CamFire-webApp
nano .env
```

Vérifiez et renseignez vos informations personnelles :
```ini
# Mot de passe fort pour PostgreSQL
POSTGRES_USER=camfire_prod_user
POSTGRES_PASSWORD=votre_mot_de_passe_robuste_ici
POSTGRES_DB=camfire_prod_db

# Configuration SMTP (ex: Gmail pour les alertes et le 2FA)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=votre_email@gmail.com
SMTP_PASSWORD=votre_mot_de_passe_d_application_16_caracteres
SMTP_FROM=CamFire Security <votre_email@gmail.com>
SMTP_USE_TLS=true

# Discord Webhook pour les alertes (Optionnel)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

Sauvegardez avec `Ctrl + O` puis quittez avec `Ctrl + X`.

---

## Étape 4 : Lancement Manuel (ou premier démarrage)

Pour lancer les conteneurs manuellement sur le VPS sans attendre un push GitHub :
```bash
cd ~/CamFire-webApp
bash scripts/deploy.sh
```

Ou directement avec Docker Compose :
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Ouvrez ensuite votre navigateur et accédez à :
`http://ip_de_votre_vps/`

Votre application **CamFire** est en ligne ! 🎉

---

## Étape 5 (Optionnel) : Configuration d'un nom de domaine & HTTPS (SSL gratuit)

Si vous possédez un nom de domaine (ex: `camfire.mondomaine.com`) pointant vers l'IP de votre VPS (enregistrement DNS de type `A`) :

Exécutez simplement le script SSL inclus :
```bash
sudo bash scripts/setup-ssl.sh camfire.mondomaine.com votre_email@mondomaine.com
```

Le certificat sera généré et renouvelé automatiquement par Certbot.

---

## Commandes Utiles au Quotidien sur le VPS

### Voir l'état des conteneurs
```bash
docker compose -f docker-compose.prod.yml ps
```

### Consulter les logs en temps réel
```bash
# Tous les services
docker compose -f docker-compose.prod.yml logs -f

# Uniquement le backend FastAPI
docker compose -f docker-compose.prod.yml logs -f backend

# Uniquement le frontend Nginx
docker compose -f docker-compose.prod.yml logs -f frontend
```

### Redémarrer les conteneurs
```bash
docker compose -f docker-compose.prod.yml restart
```

### Arrêter les conteneurs
```bash
docker compose -f docker-compose.prod.yml down
```

### Sauvegarde manuelle de la base de données PostgreSQL
```bash
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U camfire_prod_user camfire_prod_db > backup_$(date +%Y%m%d).sql
```
