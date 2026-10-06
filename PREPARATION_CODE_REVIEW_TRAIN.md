# Guide de Soutenance & Code Review : train.py

Ce document constitue la fiche de préparation complète pour l'examen de **Code Review (20 minutes)** portant sur le moteur d'entraînement Computer Vision & Deep Learning : [`vision/train.py`](file:///Users/herby/Herby/CamFire-webApp/vision/train.py) et sa configuration d'hyperparamètres [`vision/configs/hyp_adverse_conditions.yaml`](file:///Users/herby/Herby/CamFire-webApp/vision/configs/hyp_adverse_conditions.yaml).

---

## ⏱️ Découpage Minuté de la Présentation (20 minutes)

| Timing | Phase | Objectif & Contenu clé |
|---|---|---|
| **00:00 - 03:00** | **1. Enjeux Métier & Problématique IA** | Pourquoi les modèles génériques échouent en milieu forestier (distance, nuit, fumée). |
| **03:00 - 08:00** | **2. Détection & Optimisation Matérielle** | Détailler `detect_best_device` et `configure_m5_environment` (Apple Silicon Metal MPS / CUDA). |
| **08:00 - 14:00** | **3. La Pépite : Hyperparamètres Physiques** | Détailler `hyp_adverse_conditions.yaml` : résolution 1280px, DFL, Random Erasing et HSV. |
| **14:00 - 17:00** | **4. Pipeline d'Exécution & Résilience CLI** | Détailler la validation du dataset, le mode `--demo` et l'export CoreML pour l'Apple Neural Engine. |
| **17:00 - 20:00** | **5. Questions / Réponses du Jury** | Réponses prêtes sur le mAP, le Recall, la DFL, le Transfer Learning et l'Overfitting. |

---

## 🎙️ Script de Présentation Mot-à-Mot

### 1. Introduction & Responsabilité Métier (00:00 - 03:00)
> **Ce que vous dites au jury :**  
> *« Bonjour. Aujourd'hui, je vous présente [`vision/train.py`](file:///Users/herby/Herby/CamFire-webApp/vision/train.py), le cœur de notre moteur d'entraînement de Computer Vision basé sur l'architecture Ultralytics YOLO11.  
> Dans un système de détection d'incendies et d'intrusions comme CamFire, les modèles d'IA pré-entraînés du marché échouent systématiquement sur le terrain : ils sont entraînés sur des photos urbaines de jour où les personnes sont proches.  
> En forêt, un intrus ou un départ de feu se trouve souvent à **100 ou 200 mètres**, sous la pluie, dans la fumée ou en pleine nuit.  
> Ce script résout deux défis majeurs d'ingénierie :  
> 1. **L'accélération matérielle agnostique** (exploitation native des puces Apple Silicon via Metal Performance Shaders - MPS).  
> 2. **L'ingénierie d'hyperparamètres adaptée aux conditions extrêmes** via notre configuration sur-mesure [`hyp_adverse_conditions.yaml`](file:///Users/herby/Herby/CamFire-webApp/vision/configs/hyp_adverse_conditions.yaml). »*

---

### 2. L'Optimisation Matérielle Agnostique (Lignes 15 à 31)
* **Code à projeter :**
```python
def detect_best_device():
    """Détecte l'environnement Apple Silicon ou CUDA/CPU."""
    if torch.backends.mps.is_available() and torch.backends.mps.is_built():
        print("[✓] Apple Silicon détecté : Accélération GPU Metal (MPS) ACTIVÉE.")
        return "mps"
    if torch.cuda.is_available():
        print("[✓] GPU NVIDIA CUDA détecté.")
        return "0"
    return "cpu"

def configure_m5_environment():
    """Applique les variables d'environnement optimales pour macOS Apple Silicon."""
    os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"
    os.environ["MPS_FORCE_GRAPH_MODE"] = "1"
```
* **Ce que vous expliquez au jury :**
  - **Agnostique du hardware** : Le script tourne indifféremment sur Mac Apple Silicon (MPS), sur cluster cloud avec GPU Nvidia (CUDA) ou sur CPU standard.
  - **Résilience `PYTORCH_ENABLE_MPS_FALLBACK=1`** : Si un opérateur PyTorch rare n'est pas encore implémenté dans les shaders Metal, PyTorch bascule automatiquement ce calcul sur le CPU au lieu de crasher l'entraînement après 8 heures de calcul.

---

### 3. Hyperparamètres "Conditions Extrêmes" (`hyp_adverse_conditions.yaml`)
* **Ce que vous expliquez au jury (Le point clé de Data Science) :**
  - **Résolution `imgsz=1280`** (au lieu de 640 standard) : À 640px, une silhouette lointaine ne fait que 8 pixels. À 1280px, la résolution spatiale est quadruplée : le réseau dispose de suffisamment de textures pour segmenter les contours d'une cible lointaine.
  - **`flipud: 0.0`** : Pas de retournement vertical car les humains ne marchent pas au plafond et la fumée monte toujours vers le ciel.
  - **`erasing: 0.4` (Random Erasing)** : Efface aléatoirement 40% de portions d'image pour forcer le modèle à reconnaître une personne même si elle est partiellement masquée derrière des branches d'arbres.
  - **`hsv_s: 0.7` et `hsv_v: 0.5`** : Simule la décoloration due au brouillard et les fortes variations de luminosité (nuit, pénombre, contre-jour).

---

## ❓ Les 5 Questions Pièges du Jury & Vos Réponses

#### 1. « Pourquoi du Transfer Learning plutôt qu'un entraînement "from scratch" ? »
> **Votre réponse :**  
> *« Entraîner YOLO11 à partir de zéro nécessiterait des millions d'images et des semaines sur des clusters de GPU. En partant des poids pré-entraînés `yolo11m.pt`, le réseau sait déjà extraire les primitives visuelles universelles (lignes, textures, contrastes). Le fine-tuning permet d'adapter ces représentations à notre domaine spécifique en seulement 100 époques avec une convergence rapide. »*

#### 2. « En détection d'incendie, quelle métrique privilégiez-vous entre la Précision et le Rappel (Recall) ? »
> **Votre réponse :**  
> *« Le **Rappel (Recall)** est la métrique prioritaire absolue. Il est préférable d'avoir quelques faux positifs vérifiables par un agent de sécurité plutôt qu'un seul faux négatif : un feu non détecté qui ravage une forêt. »*

#### 3. « Comment luttez-vous contre le sur-apprentissage (Overfitting) ? »
> **Votre réponse :**  
> *« Par trois verrous majeurs :  
> 1. La régularisation L2 via `weight_decay: 0.0005`.  
> 2. Une forte data augmentation synthétique (`mosaic`, `mixup`, `erasing`) qui empêche le modèle d'apprendre par cœur les arrière-plans.  
> 3. La validation croisée sur le dataset `val` à chaque époque pour n'extraire et ne sauvegarder que les poids ayant la meilleure généralisation (`best.pt`). »*

#### 4. « Qu'est-ce que la perte DFL (`dfl: 1.5`) dans YOLO11 ? »
> **Votre réponse :**  
> *« La Distribution Focal Loss (DFL) modélise les coordonnées des boîtes sous forme de distributions de probabilités continues plutôt que de simples scalaires. C'est idéal pour la fumée ou les silhouettes lointaines où les contours sont flous et incertains. »*

#### 5. « Pourquoi `workers=4` dans `model.train()` ? »
> **Votre réponse :**  
> *« Sur l'architecture Apple Silicon, la mémoire vive est unifiée entre CPU et GPU. Allouer 4 workers permet de pré-charger et transformer les batchs d'images en parallèle sur les cœurs CPU haute performance sans saturer le contrôleur de mémoire partagée. »*
