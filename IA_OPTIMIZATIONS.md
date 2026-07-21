# Documentation des Optimisations IA & Performances

Ce document résume les récentes modifications architecturales apportées au système de prédiction (Backend) et à l'interface de scan (Frontend) de l'application **Fireshield (CamFire)** afin d'améliorer la stabilité, les performances, et l'intégration d'un système de détection multi-modèles.

---

## 1. Architecture Multi-Modèles (Dual-Model)
L'application ne se contente plus d'un seul modèle d'intelligence artificielle. Elle tourne désormais avec **deux modèles YOLO en parallèle** :
1. **Modèle Incendie (`best.pt`)** : Modèle YOLOv8 entraîné sur mesure pour détecter les flammes et la fumée. (Seuil de confiance abaissé à `0.15` pour maximiser la détection).
2. **Modèle Intrusion (`yolo11n.pt`)** : Modèle YOLOv11 Nano pré-entraîné sur le dataset COCO, configuré pour cibler uniquement la classe `0` (Personne) avec un seuil de confiance de `0.30`.

**Impact Visuel :**
- Les détections d'incendie sont encadrées de leur couleur par défaut (rouge/orange).
- Les détections humaines sont encadrées en **Bleu** (`(255, 0, 0)` en BGR).

---

## 2. Optimisations des Performances du Flux Vidéo

Traiter un flux vidéo avec deux modèles d'IA sur un thread synchrone est extrêmement lourd pour le processeur. Trois optimisations majeures ont été déployées dans `api/services/predict.py` :

### A. Échantillonnage agressif (Frame Dropping)
- **Avant :** L'IA analysait 1 frame sur 3.
- **Maintenant :** L'IA analyse **1 frame sur 10** (`if frame_count % 10 != 0: continue`). 
- **Bénéfice :** Réduit drastiquement la charge CPU en passant d'une fréquence d'inférence de ~10 FPS à ~3 FPS, ce qui est amplement suffisant pour de la vidéosurveillance d'incendie et d'intrusion sans perte d'efficacité.

### B. Sous-échantillonnage de la Résolution (Downscaling)
- Les frames capturées depuis la caméra Axis (souvent en 1080p ou 720p) sont désormais redimensionnées en **640x480** avant d'être passées aux modèles YOLO.
- **Bénéfice :** Accélère le temps de traitement de l'algorithme `model.predict()` et divise par deux le temps d'encodage JPEG (`cv2.imencode`) requis pour envoyer l'image au navigateur.

### C. Base de Données Asynchrone (Non-Bloquante)
- **Le Problème :** L'enregistrement d'une alerte avec SQLAlchemy (`db.commit()`) bloquait la boucle `while True` du générateur vidéo. Si la base de données était lente, le buffer de la caméra saturait et le flux crashait.
- **La Solution :** Création de la fonction `save_alert_async()` qui délègue l'enregistrement SQLite à un **thread séparé** (`threading.Thread(target=_save, daemon=True).start()`).
- **Bénéfice :** Empêche l'erreur fatale SQLite `database is locked` et assure une fluidité ininterrompue du flux MJPEG.

---

## 3. Évolution de l'API et du Frontend

### Refonte du Endpoint `/scan/predict`
L'API a été modifiée pour renvoyer un objet JSON universel plutôt que des métadonnées strictes liées au feu.
**Nouveau format de réponse :**
```json
{
  "detections": [
    { "bbox": [12.0, 34.0, 150.0, 200.0], "confidence": 0.85, "class": "fire" },
    { "bbox": [300.0, 100.0, 450.0, 300.0], "confidence": 0.45, "class": "person" }
  ],
  "image_base64": "<base64_string>"
}
```

### Mise à jour de React (`Scan.tsx`)
Puisque l'API retourne désormais toutes les détections confondues, l'interface graphique a été rendue "intelligente" :
- Elle parcourt le tableau `detections`.
- Elle filtre et **ignore la classe `person`** dans le calcul de l'alerte de feu.
- L'alerte rouge de danger (`FireAlertModal`) ne se déclenche que si le tableau filtré contient des classes d'incendie, évitant que l'application ne crie au feu lorsqu'elle détecte simplement un humain.
