#!/usr/bin/env python3
"""
Script d'entraînement Ultralytics YOLO11 optimisé pour Mac M5 (Apple Silicon).
Gère l'accélération matérielle MPS (Metal Performance Shaders), la haute résolution (imgsz=1280),
et applique les hyperparamètres spécifiques pour la météo dégradée, la nuit et la distance.
"""

import os
import sys
import argparse
from pathlib import Path
import torch
from ultralytics import YOLO

# ==============================================================================
# 1. DÉTECTION DU MATÉRIEL (GPU vs CPU)
# ==============================================================================
def detect_best_device():
    """
    Sélectionne automatiquement le processeur le plus rapide disponible :
    - MPS (Metal) : Utilise la puce graphique des Mac Apple Silicon (M1 à M5).
    - CUDA : Utilise une carte graphique NVIDIA si disponible (ex: serveur Cloud).
    - CPU : Solution de secours si aucun GPU n'est détecté.
    """
    if torch.backends.mps.is_available():
        if torch.backends.mps.is_built():
            print(" Apple Silicon détecté : Accélération GPU Metal (MPS) ACTIVÉE.")
            return "mps"
    if torch.cuda.is_available():
        print("GPU NVIDIA CUDA détecté.")
        return "0"
    print("Aucun accélérateur matériel détecté. Utilisation du CPU.")
    return "cpu"

# ==============================================================================
# 2. CONFIGURATION SYSTÈME (Optimisation Mac)
# ==============================================================================
def configure_m5_environment():
    """
    Variables d'environnement pour stabiliser PyTorch sur Apple Silicon :
    - FALLBACK : Si une opération mathématique n'existe pas sur Metal, bascule sur le CPU sans crasher.
    - GRAPH_MODE : Fusionne les calculs pour accélérer l'exécution sur le GPU.
    """
    os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"
    os.environ["MPS_FORCE_GRAPH_MODE"] = "1"

# ==============================================================================
# 3. FONCTION PRINCIPALE D'ENTRAÎNEMENT
# ==============================================================================
def train(
    model_name="yolo11m.pt",                       # Modèle de base pré-entraîné (YOLO11 Medium)
    data_config="configs/human_surveillance.yaml", # Fichier YAML décrivant les chemins des images
    hyp_config="configs/hyp_adverse_conditions.yaml", # Hyperparamètres météo (pluie, nuit, fumée)
    epochs=100,                                   # Nombre total de passages sur tout le dataset
    batch_size=16,                                # 16 images envoyées au GPU par étape de calcul
    img_size=1280,                                # Résolution 1280px (4x plus de détails pour cibles lointaines)
    project="runs/detect",                        # Dossier où enregistrer les résultats
    name="camfire_human_m5",                      # Nom de l'expérience d'entraînement
    resume=False                                  # True pour reprendre un entraînement interrompu
):
    # Étape A : Préparation de l'environnement et détection du GPU
    configure_m5_environment()
    device = detect_best_device()

    base_dir = Path(__file__).resolve().parent
    data_path = base_dir / data_config
    hyp_path = base_dir / hyp_config

    print("=" * 80)
    print(" DÉMARRAGE ENTRAÎNEMENT CAMFIRE VISION - DÉTECTION HUMAINE AVANCÉE")
    print(f" Modèle de base : {model_name}")
    print(f" Plateforme de calcul : {device.upper()} (Mac M5)")
    print(f" Résolution d'image : {img_size}x{img_size} (Optimisée cibles lointaines)")
    print(f" Époques : {epochs} | Batch size : {batch_size}")
    print(f" Dataset config : {data_path}")
    print(f" Hyperparamètres : {hyp_path}")
    print("=" * 80)

    # Étape B : Vérification de sécurité (vérifie que les dossiers d'images existent et ne sont pas vides)
    import yaml
    with open(data_path, "r") as f:
        data_info = yaml.safe_load(f)
    
    root_path = Path(data_info.get("path", base_dir / "data" / "camfire_human_dataset"))
    train_dir = root_path / data_info.get("train", "images/train")
    val_dir = root_path / data_info.get("val", "images/val")
    
    valid_train = train_dir.exists() and any(train_dir.glob("*.*"))
    valid_val = val_dir.exists() and any(val_dir.glob("*.*"))

    # Si le dataset est manquant, affiche un message d'aide clair plutôt que de crasher
    if not valid_train or not valid_val:
        print("\n" + "!" * 80)
        print(" ATTENTION : Le dossier d'entraînement est actuellement vide ou incomplet.")
        print(f" Chemin attendu : {root_path}")
        print(f" - Images Train : {train_dir} {'[OK]' if valid_train else '[MANQUANT]'}")
        print(f" - Images Val   : {val_dir} {'[OK]' if valid_val else '[MANQUANT]'}")
        print("\nPour commencer :")
        print("1. Téléchargez les images (ExDark, WiderPerson, DAWN, RTTS) :")
        print("   python3 datasets/download_curated.py --list")
        print("2. Ou testez immédiatement l'entraînement sur votre puce M5 avec le mode Démo :")
        print("   python3 train.py --demo")
        print("!" * 80 + "\n")
        sys.exit(1)

    # Étape C : Chargement des poids du réseau de neurones YOLO11
    model = YOLO(model_name)

    # Étape D : Lancement de l'apprentissage (boucle de rétropropagation des gradients)
    results = model.train(
        data=str(data_path),
        cfg=str(hyp_path) if hyp_path.exists() else None,
        epochs=epochs,
        batch=batch_size,
        imgsz=img_size,
        device=device,
        workers=4,           # 4 processus parallèles (idéal pour la mémoire unifiée du Mac)
        project=project,
        name=name,
        resume=resume,       # Reprise automatique si interrompu
        save=True,
        save_period=10,      # Sauvegarde de sécurité toutes les 10 époques (évite de tout perdre)
        val=True,            # Calcule les métriques (mAP, Précision, Rappel) après chaque époque
        plots=True,          # Génère les graphiques d'analyse (courbes de pertes, matrice de confusion)
        verbose=True
    )

    # Étape E : Fin de l'entraînement et enregistrement du modèle final
    print("\n[✓] Entraînement terminé avec succès !")
    best_weights = Path(project) / name / "weights" / "best.pt"
    print(f"[✓] Meilleurs poids sauvegardés dans : {best_weights}")
    print("Prochaine étape : Export CoreML pour l'Apple Neural Engine (ANE) via :")
    print(f"  python3 export_coreml.py --weights {best_weights}")

# ==============================================================================
# 4. MODE DÉMO (Test rapide en 30 secondes pour le jury)
# ==============================================================================
def run_demo():
    """
    Lance un entraînement miniature sur 3 époques avec le dataset test coco8.
    Permet de prouver au jury que le GPU Metal et le code fonctionnent en direct.
    """
    configure_m5_environment()
    device = detect_best_device()
    print("=" * 80)
    print(" TEST DE VALIDATION MATÉRIELLE SUR MAC M5 (MODE DÉMO)")
    print(f" Device : {device.upper()} | Modèle : yolo11n.pt | Époques : 3")
    print("=" * 80)
    model = YOLO("yolo11n.pt")
    model.train(
        data="coco8.yaml",
        epochs=3,
        batch=4,
        imgsz=640,
        device=device,
        project="runs/detect",
        name="demo_m5_validation",
        verbose=True
    )
    print("\n[✓] Test de validation sur puce M5 réussi à 100% !")

# ==============================================================================
# 5. GESTION DES ARGUMENTS EN LIGNE DE COMMANDE (CLI)
# ==============================================================================
def main():
    parser = argparse.ArgumentParser(description="Entraînement Ultralytics YOLO11 sur Mac M5.")
    parser.add_argument("--model", type=str, default="yolo11m.pt", help="Modèle YOLO11 de départ (yolo11n, yolo11s, yolo11m).")
    parser.add_argument("--epochs", type=int, default=100, help="Nombre total d'époques.")
    parser.add_argument("--batch", type=int, default=16, help="Taille du batch (16 conseillé pour 1280px sur M5).")
    parser.add_argument("--imgsz", type=int, default=1280, help="Taille des images d'entrée (1280 recommandé pour distance).")
    parser.add_argument("--resume", action="store_true", help="Reprendre le dernier entraînement interrompu.")
    parser.add_argument("--demo", action="store_true", help="Lancer un test rapide de 3 époques pour valider l'accélération M5.")
    args = parser.parse_args()

    # Si l'utilisateur passe --demo, on exécute uniquement le test rapide
    if args.demo:
        run_demo()
        return

    # Sinon, on lance l'entraînement complet avec les paramètres choisis
    train(
        model_name=args.model,
        epochs=args.epochs,
        batch_size=args.batch,
        img_size=args.imgsz,
        resume=args.resume
    )

if __name__ == "__main__":
    main()

