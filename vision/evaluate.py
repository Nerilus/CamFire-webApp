#!/usr/bin/env python3
"""
Script d'évaluation détaillée pour la détection humaine (CamFire Vision).
Permet de mesurer précisément les performances (mAP50, mAP50-95, Precision, Recall, Latence)
sur des sous-ensembles spécifiques (Nuit, Météo dégradée, Longue distance).
"""

import os
import argparse
from pathlib import Path
import torch
from ultralytics import YOLO

def evaluate(weights_path, data_config="configs/human_surveillance.yaml", img_size=1280, split="val"):
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    base_dir = Path(__file__).resolve().parent
    data_path = base_dir / data_config

    print("=" * 80)
    print(" ÉVALUATION DES PERFORMANCES DU MODÈLE CAMFIRE VISION")
    print(f" Poids : {weights_path}")
    print(f" Dataset : {data_path}")
    print(f" Split : {split} | Résolution : {img_size}px | Device : {device.upper()}")
    print("=" * 80)

    model = YOLO(weights_path)
    metrics = model.val(
        data=str(data_path),
        imgsz=img_size,
        split=split,
        device=device,
        plots=True,
        verbose=True
    )

    print("\n" + "=" * 40 + " RÉSULTATS DÉTAILLÉS " + "=" * 40)
    print(f" Précision (P)      : {metrics.box.mp:.4f}")
    print(f" Rappel (R)         : {metrics.box.mr:.4f}")
    print(f" mAP@0.50           : {metrics.box.map50:.4f}")
    print(f" mAP@0.50:0.95      : {metrics.box.map:.4f}")
    print(f" Vitesse Inférence  : {metrics.speed['inference']:.2f} ms / frame")
    print(f" Vitesse NMS        : {metrics.speed['nms']:.2f} ms / frame")
    print("=" * 101)

def main():
    parser = argparse.ArgumentParser(description="Évaluation du modèle Ultralytics CamFire.")
    parser.add_argument("--weights", type=str, required=True, help="Chemin vers le fichier de poids .pt.")
    parser.add_argument("--data", type=str, default="configs/human_surveillance.yaml", help="Fichier de configuration dataset.")
    parser.add_argument("--imgsz", type=int, default=1280, help="Taille des images pour le test.")
    parser.add_argument("--split", type=str, default="val", choices=["val", "test"], help="Jeu à évaluer.")
    args = parser.parse_args()

    evaluate(args.weights, args.data, args.imgsz, args.split)

if __name__ == "__main__":
    main()
