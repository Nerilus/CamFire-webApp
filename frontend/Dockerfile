# Utilisation d'une image Node.js légère
FROM node:20-alpine

# Définition du répertoire de travail
WORKDIR /app

# Copie des fichiers de configuration NPM
COPY package*.json ./

# Installation des dépendances
RUN npm install

# Copie du reste du code source
COPY . .

# Exposition du port par défaut de Vite
EXPOSE 5173

# Lancement du serveur de dev Vite en exposant l'hôte
CMD ["npm", "run", "dev", "--", "--host"]