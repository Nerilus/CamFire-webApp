# Architecture Globale : CamFire (Fireshield)

Ce document présente l'architecture complète du système, détaillant la façon dont la Caméra IP, le Serveur (Backend API), les modèles d'Intelligence Artificielle et l'Interface Web (Frontend React) communiquent entre eux.

## Schéma d'Architecture

Voici le diagramme des flux de données et des interactions entre les différents composants :

```mermaid
flowchart TD
    %% Composants matériels / externes
    Cam[🎥 Caméra IP AXIS / Flux] -->|Flux Vidéo Continu| VideoStream[Service Vidéo OpenCV]
    
    subgraph Backend [Serveur Backend (FastAPI + Python)]
        Router[🛣️ Endpoints API REST]
        VideoStream
        ImageScan[Service Scan Image]
        
        subgraph AI_Engine [Moteur IA Ultralytics]
            FireModel[🔥 YOLOv8 (best.pt)]
            PersonModel[👤 YOLOv11 (yolo11n.pt)]
        end
        
        DB[(🗄️ Base de Données SQLite)]
        Background[Background Thread]
        
        Router --> ImageScan
        Router <--> VideoStream
        
        VideoStream -->|Frame redimensionnée| AI_Engine
        ImageScan -->|Image décodée| AI_Engine
        
        AI_Engine -->|Résultats (Boîtes, Confiance)| VideoStream
        AI_Engine -->|Résultats (Boîtes, Confiance)| ImageScan
        
        VideoStream -.->|Délégation asynchrone| Background
        ImageScan -.->|Délégation asynchrone| Background
        Background -->|INSERT (Alertes)| DB
        
        DB -.->|SELECT (Historique)| Router
    end
    
    subgraph Frontend [Application Client (React + TypeScript)]
        ScanPage[🔍 Page Scan Manuel]
        Dashboard[📺 Tableau de Bord (Flux Vidéo)]
        AlertsPage[📜 Historique / Alertes]
    end
    
    %% Connexions Front -> Back
    ScanPage -->|POST /scan/predict (Upload Image)| Router
    Dashboard <-->|GET /scan/stream (Multipart MJPEG)| Router
    AlertsPage -->|GET /alerts (Récupération JSON)| Router
    
    %% Réponses au Front
    Router -->|JSON (Detections) + Image Base64| ScanPage
```

---

## Description des Composants

### 1. 🎥 Caméra IP
- C'est la source matérielle du système. Elle transmet son flux vidéo sur le réseau local via un protocole standard (RTSP, HTTP MJPEG, etc.).
- La connexion est gérée nativement par **OpenCV** `cv2.VideoCapture` dans le Backend.

### 2. ⚙️ Serveur Backend (FastAPI)
C'est le cœur du système. Il fait le pont entre la demande visuelle du Frontend, le matériel (Caméra) et la réflexion algorithmique (IA).
- **Service Vidéo (`generate_video_stream`)** : Lit le flux en continu, l'échantillonne (saute des frames pour la performance), demande l'inférence à l'IA, dessine les boîtes sur l'image et l'envoie au Frontend via un streaming Multipart.
- **Service Scan (`process_image`)** : Analyse une seule image statique envoyée manuellement par l'utilisateur.
- **Moteur IA** : Exécute deux réseaux neuronaux en parallèle :
  - `best.pt` : Le modèle personnalisé YOLOv8 spécialisé dans la détection de feu et de fumée.
  - `yolo11n.pt` : Le modèle ultra-léger YOLOv11 pour détecter d'éventuelles présences humaines.
- **Base de Données & Background** : Utilise SQLAlchemy (SQLite). Pour éviter de bloquer l'analyse vidéo pendant l'enregistrement d'une alerte, l'écriture se fait en tâche de fond (Thread).

### 3. 💻 Frontend (React WebApp)
Il s'agit de l'interface qui tourne dans le navigateur de l'utilisateur final.
- **Tableau de Bord** : Affiche la balise `<img>` pointant directement vers la route de streaming vidéo de FastAPI. Cela permet d'avoir le retour caméra en direct annoté par l'IA.
- **Page de Scan** : Transforme l'image uploadée, l'envoie via `fetch`, et reçoit en retour un JSON intelligent décrivant exactement quoi encadrer et comment afficher l'alerte (si la classe `fire` est présente).
- **Historique** : Interroge la route `/alerts` pour charger toutes les alertes (Feu ou Personnes) détectées et persistées par le Backend.
