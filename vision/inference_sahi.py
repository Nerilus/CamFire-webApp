#!/usr/bin/env python3
"""
Moteur d'inférence haute résolution utilisant SAHI (Slicing Aided Hyper Inference) + Ultralytics YOLO11.
Permet de détecter des personnes minuscules à très grande distance (50 à 200m) sur des flux 1080p ou 4K
en découpant l'image en tranches (slices) tuilées avec recouvrement sans perte de définition.
"""

import os
import sys
import cv2
import argparse
import numpy as np
from pathlib import Path

try:
    from sahi import AutoDetectionModel
    from sahi.predict import get_sliced_prediction
    SAHI_AVAILABLE = True
except ImportError:
    SAHI_AVAILABLE = False

from ultralytics import YOLO

def run_sahi_inference(
    image_path,
    model_path="yolo11m.pt",
    slice_height=640,
    slice_width=640,
    overlap_height_ratio=0.2,
    overlap_width_ratio=0.2,
    confidence_threshold=0.35,
    output_path="runs/sahi_output.jpg"
):
    print("=" * 80)
    print(" INFÉRENCE HAUTE RÉSOLUTION SAHI - DÉTECTION LONGUE DISTANCE")
    print(f" Image source : {image_path}")
    print(f" Modèle : {model_path}")
    print(f" Taille des tuiles (slices) : {slice_width}x{slice_height} (Overlap: {overlap_width_ratio*100}%)")
    print(f" Seuil de confiance : {confidence_threshold}")
    print("=" * 80)

    if not os.path.exists(image_path):
        print(f"[!] Erreur : Fichier image introuvable : {image_path}")
        return

    os.makedirs(Path(output_path).parent, exist_ok=True)

    if SAHI_AVAILABLE:
        print("[*] Utilisation de la bibliothèque native SAHI...")
        detection_model = AutoDetectionModel.from_pretrained(
            model_type="yolov8", # Compatible YOLO11 Ultralytics
            model_path=model_path,
            confidence_threshold=confidence_threshold,
            device="mps" if (hasattr(cv2, "ocl") and True) else "cpu"
        )

        result = get_sliced_prediction(
            image_path,
            detection_model,
            slice_height=slice_height,
            slice_width=slice_width,
            overlap_height_ratio=overlap_height_ratio,
            overlap_width_ratio=overlap_width_ratio,
            perform_standard_pred=True # Combine vue globale + tuiles découpées
        )

        # Sauvegarde de la visualisation avec boîtes
        result.export_visuals(export_dir=str(Path(output_path).parent), file_name=Path(output_path).stem)
        print(f"[✓] Résultat sauvegardé dans : {output_path}")
        print(f"[✓] {len(result.object_prediction_list)} silhouettes humaines détectées à distance.")
    else:
        print("[!] SAHI n'est pas encore installé (pip install sahi). Utilisation du fallback Ultralytics direct...")
        model = YOLO(model_path)
        img = cv2.imread(image_path)
        results = model.predict(img, conf=confidence_threshold, classes=[0], imgsz=1280)
        res_plot = results[0].plot()
        cv2.imwrite(output_path, res_plot)
        print(f"[✓] Résultat standard sauvegardé dans : {output_path}")

def main():
    parser = argparse.ArgumentParser(description="Inférence SAHI longue distance pour CamFire.")
    parser.add_argument("--image", type=str, required=True, help="Chemin vers l'image à analyser.")
    parser.add_argument("--weights", type=str, default="yolo11m.pt", help="Poids du modèle YOLO11.")
    parser.add_argument("--slice-size", type=int, default=640, help="Taille des tuiles d'inférence.")
    parser.add_argument("--conf", type=float, default=0.35, help="Seuil de confiance.")
    parser.add_argument("--out", type=str, default="runs/sahi_output.jpg", help="Fichier de sortie.")
    args = parser.parse_args()

    run_sahi_inference(
        image_path=args.image,
        model_path=args.weights,
        slice_height=args.slice_size,
        slice_width=args.slice_size,
        confidence_threshold=args.conf,
        output_path=args.out
    )

if __name__ == "__main__":
    main()
