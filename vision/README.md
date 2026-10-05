# CamFire Vision : Détection Humaine Ultralytics sur Mac M5
### Module Haute Précision : Intempéries, Basse Lumière & Cibles Lointaines

Ce sous-projet regroupe les outils, pipelines d'entraînement et d'inférence pour déployer un modèle de vision par ordinateur haute performance spécialisé dans la détection d'humains en environnement extérieur hostile (forêt, périmètres industriels, conditions météo extrêmes, obscurité et distance).

---

## 1. Prérequis & Installation sur Mac M5

Activez votre environnement virtuel Python et installez les dépendances :

```bash
cd /Users/herby/Herby/CamFire-webApp/vision

# Création d'un venv dédié (recommandé Python 3.11 ou 3.12)
python3 -m venv .venv
source .venv/bin/activate

# Installation des dépendances optimisées Apple Silicon
pip install --upgrade pip
pip install -r requirements.txt
```

Vérifiez que l'accélération **Metal (MPS)** est bien active :
```bash
python3 -c "import torch; print('Accélération MPS active :', torch.backends.mps.is_available())"
```

---

## 2. Acquisition des Meilleurs Datasets

Consultez le catalogue détaillé des jeux de données recommandés :
```bash
python3 datasets/download_curated.py --list
```

Initialisez la structure de dossiers standardisée :
```bash
python3 datasets/download_curated.py --init
```

Convertissez vos données téléchargées (WiderPerson, ExDark, DAWN, RTTS) au format YOLO :
```bash
# Exemple pour DAWN / RTTS (format Pascal VOC XML) :
python3 datasets/format_converter.py --source-type voc \
    --input-dir data/raw/dawn/Annotations \
    --images-dir data/raw/dawn/JPEGImages \
    --output-labels-dir data/camfire_human_dataset/labels/train

# Exemple pour WiderPerson :
python3 datasets/format_converter.py --source-type wider \
    --input-dir data/raw/WiderPerson/Annotations \
    --images-dir data/raw/WiderPerson/Images \
    --output-labels-dir data/camfire_human_dataset/labels/train
```

---

## 3. Entraînement sur Mac M5 (Apple Silicon MPS)

Lancez l'entraînement avec le modèle **YOLO11m** à haute résolution (`1280px`) pour préserver les silhouettes éloignées :

```bash
python3 train.py --model yolo11m.pt --epochs 100 --batch 16 --imgsz 1280
```

> **Note Performance M5 :** Grâce à l'architecture de mémoire unifiée UMA et au backend Metal Performance Shaders (`device='mps'`), le Mac M5 est capable de traiter un batch de 16 images en résolution 1280x1280 sans saturation de VRAM.

---

## 4. Inférence Longue Distance (SAHI - Découpage en Tuiles)

Pour analyser un flux caméra haute définition (1080p ou 4K) sans dégrader les silhouettes à plus de 100 mètres :

```bash
python3 inference_sahi.py --image test_frame.jpg --weights runs/detect/camfire_human_m5/weights/best.pt --slice-size 640 --conf 0.30
```

---

## 5. Exportation vers Apple CoreML pour l'Apple Neural Engine (ANE)

Pour un déploiement ultra-fluide avec une latence `< 5 ms` et **0% de charge CPU** :

```bash
python3 export_coreml.py --weights runs/detect/camfire_human_m5/weights/best.pt --imgsz 640
```

Le fichier `.mlpackage` généré peut être chargé directement par l'API backend de CamFire :
```python
from ultralytics import YOLO
person_model = YOLO("runs/detect/camfire_human_m5/weights/best.mlpackage")
```

---

## 6. Documentation Complète

Retrouvez l'étude technique approfondie et les justifications mathématiques et architecturales dans :
📄 [PLAN_ACTION_DETECTION_HUMAIN.md](file:///Users/herby/Herby/CamFire-webApp/vision/PLAN_ACTION_DETECTION_HUMAIN.md)
