# CamFire AI : Détection précoce de fumée en milieu forestier à l'aide de l'intelligence artificielle

**Projet de développement d'une application web de surveillance forestière**

- **Formation** : Master 2 CTO & Tech Lead
- **Établissement** : HETIC
- **Membres de l'équipe** : Bassirou CISSE
- **Rôle** : Chef de projet / DevOps / Infrastructure
- **Date de remise** : 31 juillet 2026
- **Année universitaire** : 2025 – 2026

---

## Table des matières

1. **Présentation du projet CamFire**
   1.1 Contexte
   1.2 Présentation générale de CamFire AI
   1.3 Objectifs du projet
   1.4 Périmètre du prototype
2. **Analyse du marché**
   2.1 Contexte
   2.2 Les détecteurs de fumée traditionnels
   2.3 Les caméras de surveillance
   2.4 Les solutions basées sur l'intelligence artificielle
   2.5 Positionnement du projet CamFire
   2.6 Limites des solutions existantes
   2.7 Les solutions existantes sur le marché
3. **Analyse de la problématique**
4. **Proposition de solution**
   4.1 Présentation générale
   4.2 Choix du modèle YOLO11
   4.3 Développement du backend
   4.4 Développement du frontend
   4.5 Gestion des données
5. **Étude de l'implantation des caméras de surveillance**
   5.1 Objectif de l'implantation
   5.2 Critères de choix de l'emplacement
   5.3 Choix de la hauteur
   5.4 Installation sur un arbre ou sur un poteau
   5.5 Orientation de la caméra
   5.6 Nombre de caméras
   5.7 Alimentation du système
   5.8 Contraintes environnementales
   5.9 Perspectives d'amélioration
6. **Gestion de projet**
   6.1 Organisation de l'équipe
   6.2 Gestion des tâches avec Jira
   6.3 Gestion du code source avec GitHub
   6.4 Méthodologie de développement
   6.5 Environnement de développement
   6.6 Documentation
7. **Plan d'action : Vision, objectifs et indicateurs**
   7.1 Vision du projet
   7.2 Objectifs du projet
   7.3 Feuille de route
   7.4 Indicateurs de suivi (KPIs)
8. **La solution (POC)**
   8.1 Présentation générale
   8.2 Fonctionnement
   8.3 Infrastructure de déploiement
   8.4 Principaux risques
   8.5 Perspectives
9. **Conclusion**
10. **Bibliographie**

---

## 1. Présentation du projet CamFire AI

### 1.1 Contexte

Les incendies de forêt représentent un enjeu environnemental et humain majeur. Chaque année, ils détruisent des milliers d'hectares de végétation, mettent en danger la biodiversité et peuvent menacer les populations ainsi que les infrastructures. L'un des principaux défis est de détecter un départ de feu suffisamment tôt pour permettre une intervention rapide des services compétents.

Les méthodes de surveillance traditionnelles reposent principalement sur des rondes humaines, des tours de guet ou des détecteurs installés localement. Bien que ces solutions soient efficaces dans certains contextes, elles présentent plusieurs limites : couverture géographique réduite, coûts de maintenance, temps de réaction ou dépendance aux conditions météorologiques.

Dans ce contexte, les progrès récents en intelligence artificielle et en vision par ordinateur ouvrent de nouvelles possibilités pour automatiser la surveillance des zones sensibles.

Notre projet CamFire s'inscrit dans cette démarche. L'objectif est de concevoir un prototype capable de détecter automatiquement la présence de fumée et d'être humain grâce à un modèle d'intelligence artificielle entraîné avec YOLO11 et YOLOv8, puis de transmettre rapidement cette information à une application web afin d'alerter les utilisateurs.

Le projet combine plusieurs domaines techniques : vision par ordinateur, intelligence artificielle, développement web, développement backend, systèmes embarqués et gestion de projet.

### 1.2 Présentation générale de CamFire AI

CamFire est une plateforme de détection précoce de fumée destinée à la surveillance d'espaces naturels.

Le système repose sur une caméra connectée qui capture des images. Ces données sont envoyées vers une API développée avec FastAPI. L'API utilise un modèle YOLO11 et YOLOv8 entraîné spécifiquement pour reconnaître la présence de fumée et d'être humain.

Une fois l'analyse effectuée, le résultat est transmis à une application web développée avec React et TypeScript. Cette interface permet à l'utilisateur de consulter l'image, l'historique des détections et les alertes générées par le système.

### 1.3 Objectifs du projet

Les principaux objectifs de CamFire sont les suivants :

- détecter automatiquement les panaches de fumée dès les premières phases d'un départ de feu ;
- proposer une architecture simple, modulaire et facilement déployable ;
- permettre la consultation des alertes depuis une Progressive Web Application (PWA) ;
- assurer une communication sécurisée entre le frontend et le backend via une API REST ;
- développer un prototype autonome pouvant fonctionner dans un environnement extérieur et une alimentation adaptée.

### 1.4 Périmètre du prototype

Dans le cadre de ce projet, nous réalisons une preuve de concept (Proof of Concept - POC).

L'objectif n'est pas de couvrir l'intégralité d'un massif forestier mais de démontrer la faisabilité technique de la solution. Le prototype permet de capturer un flux vidéo, d'envoyer les images au serveur d'analyse, d'effectuer une détection automatique de fumée et d'être humain avec YOLO11 et YOLOv8 et d'afficher les résultats sur une interface web.

Le système pourra ensuite être amélioré afin de prendre en compte plusieurs caméras, des notifications en temps réel, des optimisations de performances ainsi que des déploiements sur des zones plus importantes.

---

## 2. Analyse du marché

### 2.1 Contexte

Les incendies de forêt constituent aujourd'hui un enjeu environnemental majeur. Selon les régions du monde, ils sont favorisés par les fortes températures, les périodes de sécheresse, le vent ainsi que certaines activités humaines. Au-delà des pertes de biodiversité, ces incendies entraînent également des conséquences économiques importantes et représentent un risque direct pour les populations. Comme le cas de Gironde et de Fontainebleau cet été 2026 en France.

### 2.2 Les détecteurs de fumée traditionnels

Les détecteurs de fumée sont largement utilisés dans les bâtiments afin de protéger les personnes contre les incendies. Ils permettent de détecter rapidement la présence de particules de fumée dans un environnement fermé.

Cependant, leur utilisation est beaucoup plus limitée dans un environnement extérieur comme une forêt. Le vent, l'humidité, la pluie ou encore l'étendue de la zone rendent leur déploiement difficile et nécessitent l'installation d'un très grand nombre de capteurs.

Ces dispositifs restent donc peu adaptés à la surveillance de grandes surfaces naturelles.

### 2.3 Les caméras de surveillance

Une autre approche consiste à installer des caméras fixes permettant de surveiller une zone en continu.

Certaines collectivités utilisent déjà ce type d'équipement afin d'observer les massifs forestiers depuis des points hauts.

L'avantage principal est qu'une seule caméra peut couvrir une zone relativement importante. En revanche, la surveillance repose souvent sur un opérateur humain chargé d'observer les images et de signaler un départ de feu. Cette méthode devient rapidement coûteuse lorsqu'il est nécessaire de surveiller plusieurs sites simultanément.

### 2.4 Les solutions basées sur l'intelligence artificielle

Ces dernières années, les progrès réalisés en vision par ordinateur ont permis le développement de systèmes capables d'analyser automatiquement des images ou des vidéos.

Grâce aux réseaux de neurones, il devient possible d'identifier différents objets présents dans une scène, notamment des véhicules, des personnes, des animaux mais également de la fumée ou des flammes.

Ces technologies permettent d'automatiser une grande partie de la surveillance tout en réduisant le temps nécessaire à la détection d'un événement.

Les modèles de la famille YOLO (You Only Look Once) font aujourd'hui partie des solutions les plus utilisées pour la détection d'objets en temps réel grâce à leurs bonnes performances et à leur rapidité d'exécution.

### 2.5 Positionnement du projet CamFire

Notre projet s'inscrit dans cette dernière catégorie. Contrairement à une surveillance entièrement humaine, CamFire automatise l'analyse des images grâce à un modèle YOLO11 et YOLOv8 entraîné pour reconnaître la présence de fumée et d'être humain.

Le choix de détecter la fumée plutôt que les flammes permet de réagir plus tôt. Dans de nombreux cas, un panache de fumée apparaît avant que les flammes ne deviennent visibles sur une caméra. Cette approche vise donc à réduire le délai entre le départ d'un incendie et sa détection.

Par ailleurs, l'utilisation d'une caméra compacte et d'une alimentation autonome permet d'envisager un système relativement peu coûteux et facilement déployable dans différents environnements.

### 2.6 Limites des solutions existantes

Malgré les progrès réalisés, aucune solution n'est parfaite.

Les conditions météorologiques peuvent influencer les performances d'un système de vision par ordinateur. Le brouillard, les nuages bas, la pluie ou encore certaines variations de luminosité peuvent provoquer des erreurs de détection.

De plus, chaque forêt possède ses propres caractéristiques : relief, densité de végétation, hauteur des arbres ou encore conditions climatiques. Ces différences doivent être prises en compte lors du choix de l'emplacement des caméras et de leur orientation.

C'est pourquoi notre projet ne se limite pas au développement d'un modèle d'intelligence artificielle. Il prend également en compte les contraintes matérielles, énergétiques et environnementales afin de proposer une solution cohérente et adaptable au terrain.

### 2.7 Les solutions existantes sur le marché

Plusieurs entreprises et organismes proposent aujourd'hui des solutions destinées à la détection précoce des incendies de forêt. Elles reposent sur différentes technologies telles que les caméras optiques, les caméras thermiques, les satellites ou encore l'intelligence artificielle.

#### En France

En France, la surveillance des massifs forestiers est principalement assurée par les services départementaux d'incendie et de secours (SDIS), l'Office National des Forêts (ONF) et les collectivités locales. Dans plusieurs départements du sud de la France, des réseaux de caméras sont installés sur des points hauts afin de surveiller les massifs forestiers. Ces dispositifs permettent aux opérateurs de repérer rapidement un départ de fumée et de déclencher une intervention.

Parmi les entreprises françaises, Parrot développe des drones professionnels utilisés pour la surveillance de l'environnement et l'inspection de zones à risque. Bien qu'ils ne soient pas exclusivement dédiés à la détection des incendies, ces drones peuvent être utilisés pour compléter les dispositifs de surveillance grâce à leurs caméras haute résolution et thermiques.

La société CS Group (anciennement CS Systèmes d'Information) développe également des solutions d'observation et de traitement d'images destinées aux domaines de la défense, de la sécurité et de la surveillance territoriale. Certaines de ces technologies peuvent être adaptées à la surveillance des espaces naturels.

#### À l'international

À l'échelle internationale, plusieurs entreprises sont spécialisées dans la détection automatisée des incendies.

Pano AI (États-Unis) déploie des caméras haute définition associées à des algorithmes d'intelligence artificielle capables de détecter les départs de fumée sur de longues distances et d'alerter rapidement les autorités.

Dryad Networks (Allemagne) adopte une approche différente en utilisant un réseau de capteurs connectés installés directement dans les forêts afin de détecter très tôt la présence de fumée et de transmettre automatiquement les alertes.

D'autres acteurs comme OroraTech (Allemagne) exploitent les données satellitaires combinées à l'intelligence artificielle pour assurer une surveillance à grande échelle des incendies de forêt.

Ces solutions sont principalement destinées aux grandes collectivités, aux organismes de gestion forestière ou aux gouvernements. Elles nécessitent souvent des infrastructures importantes et des investissements élevés.

Le projet CamFire adopte une approche différente. Son objectif est de démontrer qu'une solution reposant sur un Raspberry Pi, une caméra standard, une API FastAPI et un modèle YOLO11 open source peut constituer une preuve de concept accessible, modulaire et peu coûteuse, tout en répondant aux besoins d'une détection précoce de la fumée.

### Tableau comparatif des concurrents

| Solution | Pays | Technologie | Points forts | Limites |
|---|---|---|---|---|
| Parrot | France | Drones + caméras | Mobilité, inspection aérienne | Nécessite un pilote ou une mission |
| CS Group | France | Observation et traitement d'images | Solutions professionnelles | Coût élevé, orienté grands projets |
| Pano AI | États-Unis | Caméras + IA | Détection automatique, couverture importante | Infrastructure coûteuse |
| Dryad Networks | Allemagne | Capteurs IoT | Détection très précoce | Grand nombre de capteurs à déployer |
| OroraTech | Allemagne | Satellites + IA | Couverture de très grandes zones | Résolution et fréquence limitées selon les passages satellites |
| **CamFire** | France (Projet étudiant) | Raspberry Pi + Caméra + YOLO11 + FastAPI | Faible coût, open source, architecture modulaire | Prototype, couverture limitée à une caméra |

---

## 3. Analyse de la problématique

Le développement d'un système de détection précoce des incendies de forêt ne consiste pas uniquement à entraîner un modèle d'intelligence artificielle. Il faut également prendre en compte de nombreuses contraintes liées à l'environnement dans lequel le système sera installé.

Contrairement à un environnement contrôlé, une forêt présente des conditions très variables. La luminosité change au cours de la journée, les conditions météorologiques évoluent rapidement et la végétation peut masquer une partie de la scène observée. Tous ces éléments peuvent influencer la qualité des images et, par conséquent, les performances du modèle de détection.

Dans notre projet, le modèle YOLO11 a été entraîné pour détecter la présence de fumée. Ce choix permet de repérer un départ de feu avant que les flammes ne deviennent importantes. Cependant, la fumée peut parfois être difficile à distinguer d'autres phénomènes naturels comme le brouillard, les nuages bas, la poussière ou la vapeur d'eau. Le modèle doit donc être suffisamment robuste pour limiter les fausses alertes.

L'emplacement de la caméra constitue également un élément essentiel. Une caméra mal positionnée risque de voir son champ de vision réduit par les arbres ou le relief. À l'inverse, une caméra installée sur un point haut bénéficie d'une meilleure visibilité, mais elle est davantage exposée au vent, aux intempéries et nécessite parfois une maintenance plus complexe.

L'alimentation électrique représente une autre contrainte importante. Les zones forestières ne disposent généralement pas d'un accès direct au réseau électrique. Le système doit donc être capable de fonctionner de manière autonome grâce à une batterie, éventuellement complétée par un panneau solaire afin d'augmenter son autonomie.

La transmission des données constitue également un défi. Selon la zone d'installation, la couverture réseau peut être limitée. Il est donc nécessaire de prévoir une architecture capable de gérer des interruptions temporaires de communication ou de transmettre uniquement les informations utiles afin de limiter la consommation de bande passante.

Enfin, le coût de déploiement doit rester raisonnable. Une solution très performante mais trop coûteuse serait difficile à reproduire sur plusieurs sites. L'un des objectifs de CamFire est justement de proposer une architecture reposant sur des composants accessibles et des technologies open source afin de faciliter son évolution et son déploiement futur.

---

## 4. Proposition de solution

### 4.1 Présentation générale

Afin de répondre aux problématiques identifiées, nous avons choisi de concevoir une solution reposant sur l'intelligence artificielle et des technologies open source. L'objectif est de proposer un prototype capable de détecter automatiquement la présence de fumée, de transmettre les résultats à une application web et de permettre une consultation rapide des alertes.

Notre architecture repose sur plusieurs composants indépendants qui communiquent entre eux. Cette approche facilite le développement, les tests et les évolutions futures du projet.

Le fonctionnement général est le suivant :

1. Une caméra installée sur le terrain capture des images ou un flux vidéo.
2. Les images sont récupérées par un Raspberry Pi.
3. Le Raspberry Pi transmet les données au backend développé avec FastAPI.
4. Le backend exécute le modèle YOLOv8 et YOLO11 afin de détecter la présence de fumée et d'être humain.
5. Le résultat de la prédiction est enregistré dans la base de données lorsque cela est nécessaire.
6. Les informations sont ensuite affichées dans l'application web développée avec React.

Cette architecture modulaire permet de remplacer ou d'améliorer facilement un composant sans modifier l'ensemble du système.

### 4.2 Choix du modèle YOLO11 et YOLOv8

Au début du projet, plusieurs modèles d'apprentissage profond ont été étudiés. Une première version utilisait MobileNetV2 pour effectuer une classification d'images. Après plusieurs échanges au sein de l'équipe, nous avons décidé d'utiliser YOLOv8 et YOLO11.

Ce choix s'explique par le fait que YOLO11 et YOLOv8 ne se limitent pas à dire si une image contient de la fumée. Il permet également de localiser précisément la zone détectée à l'intérieur de l'image grâce à des boîtes de détection (bounding boxes). Cette approche est particulièrement adaptée à l'analyse de flux vidéo en temps réel.

YOLO11 et YOLOv8 offrent également un bon compromis entre précision, rapidité d'exécution et facilité d'intégration dans une application de vision par ordinateur.

### 4.3 Développement du backend

Le backend a été développé avec FastAPI. Ce framework a été retenu pour plusieurs raisons. Il offre de très bonnes performances, génère automatiquement une documentation OpenAPI (Swagger), facilite la création d'API REST et s'intègre naturellement avec Python, qui est également utilisé pour le modèle d'intelligence artificielle.

Le backend est responsable de plusieurs tâches :

- recevoir les images envoyées par le frontend ;
- exécuter le modèle YOLO11 et YOLOv8 ;
- gérer les utilisateurs et leur authentification ;
- communiquer avec la base de données PostgreSQL ;
- retourner les résultats de la détection.

### 4.4 Développement du frontend

L'interface utilisateur a été développée avec React et TypeScript.

React permet de créer une interface moderne composée de composants réutilisables. L'utilisation de TypeScript apporte un meilleur contrôle des types, ce qui réduit les erreurs de développement et facilite la maintenance du projet.

L'application est conçue sous la forme d'une Progressive Web Application (PWA), ce qui permet une utilisation sur ordinateur comme sur smartphone sans nécessiter le développement d'une application mobile native.

### 4.5 Gestion des données

Les informations relatives aux utilisateurs, à l'authentification et aux résultats des analyses sont stockées dans une base de données PostgreSQL.

Ce système de gestion de base de données a été choisi pour sa stabilité, ses performances et sa compatibilité avec SQLAlchemy utilisé dans le backend.

### 4.6 Conteneurisation et déploiement

Afin de garantir un environnement identique pour tous les membres de l'équipe, les différents services sont conteneurisés avec Docker. Le projet utilise Docker Compose pour orchestrer les différents conteneurs (frontend, backend et base de données). Cette approche simplifie le développement collaboratif et facilite le déploiement sur un serveur VPS.

À terme, le prototype pourra être installé sur un serveur distant afin d'être accessible depuis différents appareils connectés au réseau.

---

## 5. Étude de l'implantation des caméras de surveillance

### 5.1 Objectif de l'implantation

Le choix de l'emplacement des caméras est un élément essentiel pour assurer une détection efficace de la fumée. Même avec un modèle d'intelligence artificielle performant, une caméra mal positionnée réduira considérablement les capacités du système.

L'objectif n'est pas uniquement de couvrir une grande surface, mais surtout de garantir une bonne visibilité des zones où un départ de feu est susceptible de se produire. Le positionnement doit également faciliter la détection précoce des panaches de fumée avant que les flammes ne deviennent importantes.

### 5.2 Critères de choix de l'emplacement

Avant l'installation d'une caméra, plusieurs critères doivent être étudiés :

- la densité de la végétation ;
- le relief du terrain ;
- la hauteur moyenne des arbres ;
- la présence de zones à risque (sentiers, routes, aires de pique-nique ou zones fréquemment fréquentées) ;
- l'accessibilité pour les opérations de maintenance ;
- la disponibilité d'une alimentation électrique ou la possibilité d'utiliser une alimentation autonome.

### 5.3 Choix de la hauteur

Il n'existe pas de hauteur idéale valable pour toutes les situations. La hauteur d'installation dépend principalement du type de forêt et de la topographie du terrain.

Dans une forêt dense, une caméra placée trop bas risque d'avoir son champ de vision masqué par les arbres. À l'inverse, une caméra installée trop haut peut rendre les premiers panaches de fumée plus difficiles à distinguer, tout en compliquant les opérations de maintenance.

Pour un prototype comme CamFire, une installation comprise entre 6 et 12 mètres constitue un bon compromis. Cette hauteur permet généralement de dépasser les obstacles proches tout en conservant une intervention relativement simple en cas de maintenance.

Dans des zones montagneuses ou présentant un relief marqué, il est préférable de privilégier un point haut naturel plutôt que d'augmenter artificiellement la hauteur du support.

### 5.4 Installation sur un arbre ou sur un poteau

Deux solutions peuvent être envisagées.

La première consiste à fixer la caméra directement sur un arbre suffisamment robuste. Cette solution est économique et rapide à mettre en œuvre. En revanche, les mouvements provoqués par le vent, la croissance de l'arbre et les difficultés d'accès peuvent compliquer la maintenance.

La seconde consiste à installer la caméra sur un poteau ou un mât dédié. Cette solution offre une meilleure stabilité, permet un réglage plus précis de l'orientation et facilite les interventions techniques. Elle représente cependant un coût d'installation plus important.

Dans le cadre de notre prototype, ces deux approches pourront être évaluées selon les contraintes du site d'expérimentation.

### 5.5 Orientation de la caméra

Notre modèle YOLO11 et YOLOv8 sont entraînés à détecter la présence de fumée et d'être humain. Il est donc préférable d'orienter la caméra de manière à conserver une large portion de l'horizon dans son champ de vision.

Une légère inclinaison vers le bas permet d'observer à la fois la végétation proche et les zones plus éloignées où un panache de fumée pourrait apparaître.

### 5.6 Nombre de caméras

Le nombre de caméras dépend directement de la surface à surveiller. Pour une preuve de concept, une seule caméra est suffisante afin de valider le fonctionnement de la chaîne complète de détection.

Dans le cadre d'un futur déploiement, plusieurs caméras pourront être installées sur différents points stratégiques. Leurs champs de vision pourront se compléter afin de réduire les zones non couvertes et d'améliorer la fiabilité de la détection.

### 5.7 Alimentation du système

Les zones forestières ne disposent pas toujours d'un accès au réseau électrique. Il est donc nécessaire de prévoir une alimentation autonome.

Notre prototype repose sur un Raspberry Pi alimenté par une batterie associée à une carte UPS Lite. Cette carte assure la continuité de fonctionnement en cas de coupure d'alimentation.

Afin d'augmenter l'autonomie du système, un panneau solaire pourra être utilisé pour recharger la batterie durant la journée. Cette solution limite les interventions humaines et améliore l'autonomie du dispositif sur le terrain.

### 5.8 Contraintes environnementales

L'installation d'un système de surveillance en milieu naturel implique de prendre en compte plusieurs contraintes.

Les conditions météorologiques peuvent réduire la visibilité de la caméra. Le brouillard, la pluie, la neige ou encore une forte luminosité peuvent affecter les performances du modèle.

Le vent peut provoquer des vibrations du support et modifier légèrement le cadrage de la caméra. La végétation évolue également au fil des saisons et peut masquer progressivement une partie du champ de vision.

Enfin, le matériel doit être protégé contre l'humidité, la poussière, les insectes et les variations de température afin d'assurer un fonctionnement fiable sur le long terme.

### 5.9 Perspectives d'amélioration

Dans une version plus avancée du projet, l'implantation des caméras pourrait être optimisée grâce à une étude cartographique des zones à risque. Des données telles que la topographie, la densité de végétation, les statistiques d'incendies passés ou les conditions météorologiques pourraient être utilisées afin de déterminer automatiquement les meilleurs emplacements.

Cette approche permettrait d'améliorer la couverture des zones surveillées tout en limitant le nombre de caméras nécessaires.

---

## 6. Gestion de projet

### 6.1 Organisation de l'équipe

Le projet CamFire a été réalisé par une équipe de cinq étudiants. Afin de faciliter le travail collaboratif, chaque membre s'est vu attribuer un ou plusieurs domaines de responsabilité (backend, frontend, intelligence artificielle, infrastructure, gestion de projet).

En tant que chef de projet, mon rôle consistait principalement à organiser les différentes tâches, assurer le suivi de leur avancement, coordonner les échanges entre les membres de l'équipe et veiller au respect des délais fixés.

Des points réguliers étaient réalisés afin de faire le bilan de l'avancement du projet, d'identifier les difficultés rencontrées et de répartir les nouvelles tâches.

### 6.2 Gestion des tâches avec Jira

Nous avons utilisé Jira afin d'organiser le développement du projet.

Chaque fonctionnalité ou amélioration faisait l'objet d'un ticket décrivant l'objectif, les critères d'acceptation ainsi que les éventuelles dépendances avec les autres tâches.

Les tickets étaient ensuite répartis dans différentes colonnes correspondant à leur état d'avancement :

- À faire (To Do)
- En cours (In Progress)
- En revue (Code Review)
- Terminé (Done)

Cette organisation nous a permis d'avoir une vision claire de l'avancement du projet et de mieux répartir le travail entre les différents membres de l'équipe.

### 6.3 Gestion du code source avec GitHub

L'ensemble du code source est hébergé sur GitHub.

Afin d'éviter les conflits entre les développeurs, chaque nouvelle fonctionnalité est développée dans une branche dédiée.

La convention de nommage utilisée est la suivante :

- `feature/PROJ-25-api-upload`
- `feature/PROJ-22-live-stream`
- `feature/PROJ-10-router-layout`
- `fix/nom-du-correctif`
- `hotfix/nom-du-correctif`

Une fois le développement terminé, une Pull Request est créée afin que les autres membres de l'équipe puissent relire le code avant son intégration dans la branche principale.

Cette méthode nous permet de conserver un historique clair des modifications et de limiter les erreurs lors des fusions.

### 6.4 Méthodologie de développement

Le développement suit un cycle simple.

Lorsqu'une nouvelle fonctionnalité est identifiée, un ticket Jira est créé.

Le développeur crée ensuite une branche Git correspondant au ticket, développe la fonctionnalité localement puis réalise différents tests.

Une fois les tests validés, les modifications sont envoyées sur GitHub et une Pull Request est ouverte.

Après validation par un autre membre de l'équipe, la branche est fusionnée avec la branche principale.

Cette méthode nous permet de limiter les régressions et d'assurer une meilleure qualité du code.

### 6.5 Environnement de développement

Afin que tous les membres disposent du même environnement de travail, nous utilisons Docker Compose.

Trois conteneurs principaux sont exécutés :

- un conteneur React pour le frontend ;
- un conteneur FastAPI pour le backend ;
- un conteneur PostgreSQL pour la base de données.

Cette organisation simplifie l'installation du projet sur une nouvelle machine et garantit un fonctionnement identique pour tous les développeurs.

### 6.6 Documentation

Le backend utilise automatiquement la documentation Swagger générée par FastAPI.

Cette documentation permet de consulter l'ensemble des endpoints disponibles et de tester directement les requêtes HTTP sans utiliser d'outil externe.

Elle facilite également l'intégration entre le frontend et le backend.

---

## 7. Plan d'action : Vision, objectifs et indicateurs

### 7.1 Vision du projet

L'objectif de CamFire est de proposer une solution capable de détecter automatiquement les premiers signes d'un incendie de forêt grâce à l'intelligence artificielle.

Notre ambition est de concevoir un système simple à déployer, reposant sur des composants accessibles et des technologies open source. À terme, cette solution pourrait être installée dans différentes zones à risque afin d'aider les équipes de surveillance à détecter plus rapidement un départ de feu.

Le projet présenté dans ce rapport constitue une preuve de concept (POC). Il a pour objectif de démontrer la faisabilité technique de cette approche avant d'envisager un déploiement à plus grande échelle.

### 7.2 Objectifs du projet

Pour répondre à cette vision, plusieurs objectifs ont été définis.

**Objectifs techniques**

- Développer un modèle d'intelligence artificielle capable de détecter la fumée sur des images ou un flux vidéo.
- Concevoir une API REST avec FastAPI pour traiter les images et communiquer avec le frontend.
- Développer une interface web moderne permettant de visualiser les résultats de la détection.
- Stocker les informations importantes dans une base de données PostgreSQL.
- Déployer l'application dans un environnement Docker afin de faciliter son installation.

**Objectifs fonctionnels**

- Permettre à un utilisateur de s'authentifier.
- Consulter les alertes générées par le système.
- Visualiser les images analysées.
- Envoyer une image ou un flux vidéo au backend pour lancer une analyse.
- Préparer l'intégration future d'un système de notification en temps réel.

### 7.3 Feuille de route

Le développement du projet s'est organisé en plusieurs étapes.

**Phase 1 : Préparation**

- Étude des solutions existantes.
- Choix des technologies.
- Constitution de l'équipe.
- Mise en place du dépôt GitHub et de Jira.

**Phase 2 : Développement**

- Entraînement et amélioration du modèle d'intelligence artificielle.
- Développement du backend FastAPI.
- Développement du frontend React.
- Mise en place de la base de données.
- Conteneurisation avec Docker.

**Phase 3 : Validation**

- Tests fonctionnels.
- Vérification des performances du modèle.
- Tests de communication entre le frontend et le backend.
- Vérification du fonctionnement global de l'application.

**Phase 4 : Perspectives**

À plus long terme, plusieurs évolutions pourront être envisagées :

- amélioration continue du modèle YOLO11 et YOLOv8 avec de nouvelles données ;
- prise en charge de plusieurs caméras simultanément ;
- notifications en temps réel vers les utilisateurs ;
- tableau de bord d'administration plus complet ;
- déploiement sur un serveur VPS accessible à distance ;
- expérimentation dans un environnement forestier réel.

### 7.4 Indicateurs de suivi (KPIs)

Afin de mesurer l'avancement du projet, plusieurs indicateurs ont été retenus.

**Développement**

- Nombre de tickets Jira réalisés.
- Respect des échéances du projet.
- Nombre de fonctionnalités développées.

**Intelligence artificielle**

- Taux de détection de la fumée.
- Nombre de faux positifs et de faux négatifs observés pendant les tests.
- Temps moyen nécessaire pour analyser une image.

**Application**

- Temps de réponse moyen de l'API.
- Temps de chargement des pages principales.
- Disponibilité de l'application pendant les tests.

Ces indicateurs permettront d'évaluer les performances du prototype et d'identifier les améliorations à apporter lors des prochaines évolutions du projet.

---

## 8. La solution (POC)

### 8.1 Présentation générale

La solution développée dans le cadre du projet CamFire est une preuve de concept permettant de détecter automatiquement la présence de fumée grâce à un modèle d'intelligence artificielle.

Elle repose sur une architecture modulaire composée d'un frontend React, d'un backend FastAPI, d'une base de données PostgreSQL et d'un modèle YOLO11 et YOLOv8 spécialisés dans la détection de fumée et d'être humain.

L'ensemble de ces composants communique au travers d'API REST et est exécuté dans des conteneurs Docker afin de simplifier le développement et le déploiement.

### 8.2 Fonctionnement

Le fonctionnement du système peut être résumé en plusieurs étapes :

1. Une caméra capture une image ou un flux vidéo.
2. L'image est transmise au backend.
3. Le backend exécute le modèle YOLOv8 pour le feu/fumée + YOLO11 pour les personnes.
4. Le modèle recherche la présence de fumée.
5. Le résultat est renvoyé au frontend.
6. L'utilisateur consulte le résultat depuis l'application web.

Cette architecture permet de séparer clairement les responsabilités de chaque composant et facilite les évolutions futures.

### 8.3 Infrastructure de déploiement

Pour le prototype, le projet est exécuté dans un environnement Docker Compose comprenant :

- un conteneur React ;
- un conteneur FastAPI ;
- un conteneur PostgreSQL.

À terme, l'application sera déployée sur un serveur VPS afin de permettre un accès distant et de centraliser les différents services.

### 8.4 Principaux risques

Comme tout projet informatique, CamFire présente plusieurs risques techniques. Les principaux risques identifiés sont :

- une connexion Internet instable sur le lieu d'installation ;
- une alimentation électrique insuffisante en période de faible ensoleillement ;
- des conditions météorologiques pouvant réduire la qualité des images ;
- des faux positifs ou des faux négatifs du modèle d'intelligence artificielle ;
- une défaillance matérielle de la caméra ou du Raspberry Pi.

Afin de limiter ces risques, plusieurs mesures sont prévues, notamment l'utilisation d'une alimentation secourue, une maintenance régulière du matériel, l'amélioration continue du modèle et la surveillance des performances du système.

### 8.5 Perspectives

Le prototype développé valide la faisabilité technique de notre approche.

Les prochaines étapes consisteront à poursuivre les tests dans des conditions proches du terrain, enrichir le jeu de données d'entraînement, améliorer les performances du modèle et étendre progressivement les fonctionnalités de l'application. Notamment la détection d'un pyromane, c'est-à-dire un être humain qui pourrait déclencher volontairement le départ d'un feu comme le cas de la forêt de Fontainebleau au mois de juillet 2026 dont l'origine a été causée par un pompier volontaire.

L'objectif final est de disposer d'un système capable d'assister efficacement les équipes de surveillance en détectant les départs de fumée le plus tôt possible.

---

## 9. Conclusion

Le projet CamFire nous a permis de mettre en pratique les compétences acquises au cours de notre formation en développement logiciel, intelligence artificielle et gestion de projet.

L'objectif était de concevoir une preuve de concept capable de détecter automatiquement la présence de fumée grâce à un modèle d'intelligence artificielle, tout en proposant une interface web permettant de visualiser les résultats de manière simple et intuitive.

Au cours du projet, nous avons travaillé sur plusieurs aspects complémentaires : l'entraînement d'un modèle de vision par ordinateur, le développement d'une API avec FastAPI, la réalisation d'une interface React, la mise en place d'une base de données PostgreSQL ainsi que la conteneurisation de l'application avec Docker.

L'utilisation de Jira et GitHub nous a également permis d'organiser le travail de l'équipe et de suivre l'avancement des différentes fonctionnalités.

Même si le projet est aujourd'hui présenté sous la forme d'un prototype, il démontre qu'il est possible de développer une solution de détection précoce des incendies reposant sur des technologies open source et du matériel accessible.

Les premiers résultats obtenus sont encourageants et montrent que cette approche peut constituer une base intéressante pour des développements futurs.

Plusieurs améliorations pourront être envisagées, notamment l'optimisation du modèle YOLO11 et YOLOv8 avec de nouvelles données d'entraînement, l'intégration de plusieurs caméras, la mise en place de notifications en temps réel, ainsi que des expérimentations dans un environnement forestier réel.

Ce projet nous a également permis de mieux comprendre les contraintes liées au développement d'un système complet, depuis la conception jusqu'au déploiement, tout en mettant en évidence l'importance du travail collaboratif, de la communication au sein d'une équipe et de l'utilisation d'outils de gestion de projet.

---

## 10. Bibliographie

### Documentation technique

- Documentation officielle FastAPI : https://fastapi.tiangolo.com/
- Documentation React : https://react.dev/
- Documentation Docker : https://docs.docker.com/
- Documentation PostgreSQL : https://www.postgresql.org/docs/
- Documentation SQLAlchemy : https://docs.sqlalchemy.org/
- Documentation OpenCV : https://opencv.org/
- Documentation Ultralytics YOLO : https://docs.ultralytics.com/
- Documentation TensorFlow : https://www.tensorflow.org/

### Organismes et institutions

- Office National des Forêts (ONF) : https://www.onf.fr/
- Météo-France : https://meteofrance.fr/
- Ministère de la Transition écologique : https://www.ecologie.gouv.fr/
- Service Copernicus (European Union) : https://www.copernicus.eu/
- Journal 20h TF1, LCI, HugoDécrypte (les incendies en France juillet 2026)

### Entreprises et solutions étudiées

- Pano AI : https://www.pano.ai/
- Dryad Networks : https://www.dryad.net/
- Parrot : https://www.parrot.com/
- CS Group : https://www.csgroup.eu/

### Matériel

- Documentation de la caméra OV5647 : https://www.raspberrypi.com/documentation/accessories/camera.html

### Gestion de projet

- GitHub : https://github.com/Nerilus/CamFire-webApp
- Jira Software : https://camfireia.atlassian.net/jira/software/projects/KAN/boards/1