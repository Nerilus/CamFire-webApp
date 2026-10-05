# PLAN D'ACTION DÉTAILLÉ : DÉTECTION HUMAINE ROBUSTE (VISION / ULTRALYTICS)
### Spécifications : Météo Dégradée, Variations Lumineuses, Longue Distance & Accélération Apple Silicon Mac M5

---

## 1. Objectifs & Enjeux Opérationnels

Dans le cadre du système de surveillance **CamFire**, la détection humaine ne peut pas reposer sur un modèle générique standard (comme YOLO entraîné sur COCO). Dans un contexte réel de surveillance extérieure et périmétrique forestière ou industrielle, le système fait face à des contraintes physiques majeures :
- **Conditions Météorologiques Extrêmes :** Brouillard matinal, pluie battante, neige, rafales de poussière et **fumées denses** issues de départs de feu.
- **Variations d'Éclairage Sévères :** Obscurité totale (nuit), pénombre crépusculaire, contre-jour direct provoqué par le soleil rasant ou les phares de véhicules.
- **Distance d'Observation Élevée :** Détection de personnes éloignées (50 à 200 mètres) où la silhouette humaine n'occupe que quelques dizaines de pixels sur le capteur (10 à 30 px de hauteur).
- **Plateforme Matérielle Cible :** Station de travail / serveur local **Apple Silicon Mac M5**, nécessitant d'exploiter la mémoire unifiée (UMA), les cœurs GPU Metal via **MPS** et l'**Apple Neural Engine (ANE)** via CoreML.

---

## 2. Sélection & Spécifications du Modèle Ultralytics

### 2.1 Modèle Recommandé : Ultralytics YOLO11
Nous retenons la gamme **YOLO11** (dernière génération Ultralytics), spécifiquement **`yolo11m`** (Medium) ou **`yolo11s`** (Small) selon la cadence d'images requise.

| Modèle | Paramètres | FLOPs | Usage Idéal | FPS estimé sur Mac M5 (CoreML/ANE) |
| :--- | :--- | :--- | :--- | :--- |
| **YOLO11n** | 2.6M | 6.5G | Détection embarquée basse consommation / multi-flux > 16 caméras | ~180+ FPS |
| **YOLO11s** | 9.4M | 21.5G | Excellent compromis vitesse/précision pour flux Full HD temps réel | ~110 FPS |
| **YOLO11m** *(Recommandé)* | 20.1M | 68.0G | **Meilleure précision sur cibles éloignées et masquées** | **~65 FPS** |
| **YOLO11x** | 56.9M | 194.9G | Analyse médico-légale / zoom ultra haute précision hors temps réel | ~25 FPS |

### 2.2 Pourquoi YOLO11 surpasse YOLOv8 / COCO par défaut ?
1. **Modules C3k2 & SPPF Améliorés :** Captent les structures fines et les gradients de contraste faibles (typique d'une silhouette dans la brume ou la pénombre).
2. **Architecture Anchor-Free Dynamique :** Adaptation bien supérieure aux ratios étroits et verticaux des piétons vus de loin.
3. **Résolution Native Variable :** Capacité d'entraînement à haute résolution (`imgsz=1280` au lieu de 640) sans dégradation exponentielle de la mémoire sur Mac M5.

### 2.3 Traitement de la Longue Distance : Stratégie Double Étage
Pour garantir la détection d'humains entre 50m et 200m :
1. **Entraînement Haute Définition :** Modèle entraîné à `imgsz=1280` pixels.
2. **Inférence SAHI (*Slicing Aided Hyper Inference*) :**
   - L'image haute résolution (1080p ou 4K) est découpée dynamiquement en tuiles de 640x640 avec un chevauchement réglable (20%).
   - L'inférence est exécutée sur chaque tuile ainsi que sur l'image globale.
   - Les boîtes englobantes sont fusionnées via NMS (Non-Maximum Suppression).
   - **Résultat :** Un piéton de 15 pixels de haut à 150m est détecté avec une confiance > 80% sans nécessiter de zoom optique motorisé.

---

## 3. Les Meilleurs Datasets Mondiaux Sélectionnés

Pour construire un modèle résistant aux conditions réelles, le dataset d'entraînement doit combiner plusieurs sources de référence complémentaires :

### 3.1 Pour la Longue Distance & les Silhouettes Minuscules
1. **WiderPerson** :
   - *Volume :* 13 382 images, 399 786 annotations de piétons.
   - *Intérêt :* Scènes extérieures réelles très variées, fortes occlusions (végétation, mobilier urbain), personnes à toutes les distances.
   - *Lien :* [http://www.sklp.or.cn/datasets/widerperson.html](http://www.sklp.or.cn/datasets/widerperson.html)
2. **TinyPerson** :
   - *Volume :* 1 610 images ultra haute résolution.
   - *Intérêt :* Spécialement annoté pour les personnes mesurant entre 2 et 32 pixels dans de vastes paysages naturels et côtiers.
3. **VisDrone-DET (Classe Pedestrian / Person)** :
   - *Volume :* 10 209 images prises en hauteur (angles plongeants similaires aux caméras de surveillance sur mâts).

### 3.2 Pour les Conditions Météorologiques Dégradées
1. **DAWN (Detection in Adverse Weather Nature)** :
   - *Volume :* 1 000 images réelles réparties en 4 catégories climatiques : **Fog** (brouillard), **Snow** (neige), **Rain** (pluie) et **Sandstorm** (tempête de sable).
   - *Intérêt :* Capture la perte de contraste et les artefacts réels des intempéries.
2. **RTTS / RESIDE (Real Task-driven Testing Set)** :
   - *Volume :* 4 322 images extérieures prises par temps de brouillard et brume dense.
   - *Intérêt :* Entraîne le réseau à distinguer les formes humaines au travers de la fumée d'incendie et de la brume.
3. **Foggy Cityscapes (Sous-ensemble Piétons)** :
   - *Intérêt :* Annotations précises sous différents niveaux de densité de brouillard synthétique calibré physiquement.

### 3.3 Pour l'Obscurité et la Vision Nocturne
1. **ExDark (Exclusively Dark)** :
   - *Volume :* 7 363 images réelles en basse lumière couvrant 10 conditions : crépuscule, clair de lune, éclairage public lointain, contre-jour nocturne, pénombre totale.
   - *Intérêt :* Évite les faux négatifs la nuit sans devoir ajouter un illuminateur infrarouge puissant.
2. **LLVIP (Low-Light Visible-Infrared Paired)** :
   - *Volume :* 16 836 paires synchronisées de jour/nuit en caméra Visible et Infrarouge Thermique.
   - *Intérêt :* Si des caméras thermiques sont branchées sur CamFire, ce dataset permet un entraînement direct sur l'imagerie infrarouge.

---

## 4. Optimisation Matérielle Spécifique pour Mac M5 (Apple Silicon)

Le Mac M5 bénéficie d'une architecture révolutionnaire combinant un GPU Metal à bande passante mémoire élevée (Unified Memory Architecture - UMA) et un Apple Neural Engine (ANE) surpuissant.

### 4.1 Entraînement Local via PyTorch MPS (*Metal Performance Shaders*)
- **Device de calcul :** `device="mps"` dans Ultralytics.
- **Gestion UMA :** Sur Mac M5, la mémoire vive est partagée entre CPU et GPU. On peut entraîner en `batch=16` ou `batch=32` à `imgsz=1280` sans souffrir des limitations 8 Go VRAM des cartes GPU standards.
- **Variables d'environnement d'accélération :**
  ```bash
  export PYTORCH_ENABLE_MPS_FALLBACK=1
  export MPS_FORCE_GRAPH_MODE=1
  ```

### 4.2 Déploiement en Inférence Haute Performance : CoreML sur ANE
Pour la production dans l'application CamFire, le modèle PyTorch `.pt` doit être exporté au format Apple CoreML (`.mlpackage`) :
- **Conversion ANE :**
  ```python
  from ultralytics import YOLO
  model = YOLO("runs/detect/camfire_human_m5/weights/best.pt")
  model.export(format="coreml", nms=True, half=True)
  ```
- **Gains concrets sur Mac M5 :**
  - Consommation énergétique divisée par 4.
  - Exécution 100% déchargée sur le NPU (Apple Neural Engine), libérant le GPU pour le rendu de l'interface et le CPU pour la gestion des flux vidéo RTSP.
  - Temps d'inférence < 5 ms par frame 640p.

---

## 5. Pipeline d'Augmentation & Entraînement

Pour maximiser la résilience du modèle sans nécessiter 100 000 images manuelles :

### Hyperparamètres Clés (`hyp_adverse_conditions.yaml`)
- **Luminosité & Contraste :** `hsv_v: 0.5` (simule des transitions ombre/soleil et scènes sombres) et `hsv_s: 0.7` (simule la décoloration due à la fumée et au brouillard).
- **Multi-échelles :** `scale: 0.7` avec `mosaic: 1.0` et `mixup: 0.15` (force l'apparition de micro-silhouettes dans les coins de l'image).
- **Transformations Albumentations intégrées :**
  - `RandomFog(fog_coef_lower=0.3, fog_coef_upper=0.8)`
  - `RandomRain(slant_lower=-10, slant_upper=10, drop_length=20)`
  - `CLAHE(clip_limit=4.0)` pour l'égalisation dynamique du contraste local.

---

## 6. Architecture des Fichiers dans `vision/`

Le dossier `vision/` est organisé de manière industrielle et modulaire :

```
vision/
├── configs/
│   ├── human_surveillance.yaml        # Fichier YAML Ultralytics (train/val/classes)
│   └── hyp_adverse_conditions.yaml     # Hyperparamètres météo/nuit/distance
├── datasets/
│   ├── download_curated.py             # Téléchargement automatisé des datasets
│   └── format_converter.py            # Convertisseur unifié vers format YOLO (txt)
├── train.py                            # Entraînement automatisé optimisé Mac M5 (MPS)
├── evaluate.py                         # Évaluation multi-critères (Nuit, Brume, Distance)
├── inference_sahi.py                   # Moteur d'inférence haute résolution découpée
├── export_coreml.py                    # Export vers Apple CoreML pour ANE M5
├── requirements.txt                    # Dépendances Python requises
├── PLAN_ACTION_DETECTION_HUMAIN.md     # Le présent document d'ingénierie
└── README.md                           # Guide d'exécution pas-à-pas
```

---

## 7. Feuille de Route d'Exécution

1. **Étape 1 (Préparation de l'environnement) :** Installation des dépendances dans un environnement virtuel Python (`pip install -r vision/requirements.txt`).
2. **Étape 2 (Acquisition & Normalisation) :** Exécution de `vision/datasets/download_curated.py` pour récupérer WiderPerson, ExDark et DAWN, puis conversion via `format_converter.py`.
3. **Étape 3 (Entraînement M5) :** Lancement de `vision/train.py` avec l'accélérateur `mps` et haute résolution (`imgsz=1280`).
4. **Étape 4 (Validation Spécialisée) :** Calcul des métriques mAP50 et mAP50-95 sur les conditions adverses avec `vision/evaluate.py`.
5. **Étape 5 (Export CoreML & Déploiement) :** Export en FP16 ANE via `vision/export_coreml.py` et intégration dans `api/services/predict.py`.
