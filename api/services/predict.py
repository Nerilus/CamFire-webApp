import builtins
def print(*args, **kwargs):
    kwargs['flush'] = True
    builtins.print(*args, **kwargs)

import os
import io
import base64
import numpy as np
import tensorflow as tf
from PIL import Image
import matplotlib.cm as cm
import matplotlib

matplotlib.use("Agg")

# Tentative de charger d'abord fire_model.keras (comme dans l'ancien projet)
# Sinon, on retombe sur mobilenet_v2.weights.h5 (qui risque de planter car c'est juste des poids)
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..")
MODEL_PATH_KERAS = os.path.join(MODEL_DIR, "fire_model.keras")
MODEL_PATH_H5 = os.path.join(MODEL_DIR, "mobilenet_v2.weights.h5")

_model = None
_feature_model = None
GRADCAM_AVAILABLE = False

def init_model():
    global _model, _feature_model, GRADCAM_AVAILABLE
    if _model is not None:
        return
    
    path_to_load = MODEL_PATH_KERAS if os.path.exists(MODEL_PATH_KERAS) else MODEL_PATH_H5
    print(f"Chargement du modele depuis {path_to_load}...")
    
    try:
        _model = tf.keras.models.load_model(path_to_load)
        print("Modele charge avec succes.")
    except Exception as e:
        print(f"Erreur de chargement du modele complet: {e}")
        # Si ça plante, on tente l'architecture par défaut (au cas où ce sont juste les poids)
        base = tf.keras.applications.MobileNetV2(input_shape=(224, 224, 3), include_top=False, weights=None)
        x = tf.keras.layers.GlobalAveragePooling2D()(base.output)
        x = tf.keras.layers.Dense(1, activation='sigmoid')(x)
        _model = tf.keras.models.Model(inputs=base.input, outputs=x)
        try:
            _model.load_weights(path_to_load)
            print("Poids chargés sur l'architecture de secours.")
        except Exception as e2:
            print(f"Impossible de charger les poids : {e2}")

    try:
        # Logique de l'ancien projet
        _mobilenet = _model.get_layer("mobilenetv2_1.00_224")
        _feature_model = tf.keras.Model(
            inputs=_mobilenet.inputs,
            outputs=_mobilenet.get_layer("out_relu").output,
        )
        GRADCAM_AVAILABLE = True
        print("Grad-CAM disponible via 'mobilenetv2_1.00_224'.")
    except Exception as e:
        # Fallback si le layer s'appelle autrement (ex: 'mobilenetv2_1.00_224' introuvable)
        print(f"Grad-CAM (logique ancienne) non disponible : {e}")
        GRADCAM_AVAILABLE = False


def preprocess_image(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((224, 224))
    # Prétraitement de l'ancien projet : division par 255.0 au lieu de preprocess_input de keras
    return np.expand_dims(np.array(img, dtype=np.float32) / 255.0, axis=0)

def compute_gradcam(img_array, is_fire, model):
    if not GRADCAM_AVAILABLE or _feature_model is None:
        return None
    try:
        img_tensor = tf.cast(img_array, tf.float32)
        conv_features = _feature_model(img_tensor)

        with tf.GradientTape() as tape:
            tape.watch(conv_features)
            x = tf.reduce_mean(conv_features, axis=[1, 2])
            # Attention: L'ancien projet reprenait à model.layers[2:]
            # On vérifie si ça ne crashe pas.
            for layer in model.layers[2:]:
                x = layer(x, training=False)
            predictions = x
            loss = (1.0 - predictions[:, 0]) if is_fire else predictions[:, 0]

        grads = tape.gradient(loss, conv_features)
        if grads is None:
            return None

        pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
        heatmap = tf.reduce_sum(conv_features[0] * pooled_grads, axis=-1)
        heatmap = tf.nn.relu(heatmap)

        max_val = tf.reduce_max(heatmap)
        heatmap = heatmap / max_val if max_val > 0 else heatmap

        return heatmap.numpy()
    except Exception as e:
        print(f"Erreur Grad-CAM : {e}")
        return None

def make_overlay(original_bytes, heatmap_np, alpha=0.45):
    orig = Image.open(io.BytesIO(original_bytes)).convert("RGB")
    W, H = orig.size

    hm_img = Image.fromarray(np.uint8(255 * heatmap_np))
    
    # Utilisation de Image.Resampling.LANCZOS (Pillow >= 10.0)
    try:
        resample_filter = Image.Resampling.LANCZOS
    except AttributeError:
        resample_filter = Image.LANCZOS

    # Redimensionnement de la heatmap à la taille de l'image ORIGINALE
    hm_img = hm_img.resize((W, H), resample_filter)
    
    colormap = matplotlib.colormaps["inferno"]
    colored = colormap(np.array(hm_img, dtype=np.float32) / 255.0)[:, :, :3]
    hm_colored = Image.fromarray(np.uint8(255 * colored))
    
    overlay = Image.blend(orig, hm_colored, alpha=alpha)
    buf = io.BytesIO()
    overlay.save(buf, format="JPEG", quality=90)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def process_image(image_bytes: bytes):
    if _model is None:
        raise Exception("Le modèle n'a pas pu être chargé. Assurez-vous d'avoir fire_model.keras dans l'API.")

    img_array = preprocess_image(image_bytes)
    
    # Inférence selon l'ancien code
    print("Analyse de l'image en cours par le modèle IA...")
    raw_score = float(_model.predict(img_array, verbose=0)[0][0])
    
    # L'ancien code considère que c'est le feu si score < 0.5 (et non l'inverse !)
    is_fire = raw_score < 0.5
    confidence = round((1.0 - raw_score if is_fire else raw_score) * 100, 1)

    if is_fire:
        print(f"🔥 ALERTE : Il y a le feu ! (Analyse Image | Confiance : {confidence}%)")
    else:
        print(f"🟢 RAS - Surveillance normale (Confiance sécurité : {confidence}%)")

    # Génération du Grad-CAM
    heatmap = compute_gradcam(img_array, is_fire, _model)
    gradcam_b64 = None
    if heatmap is not None:
        gradcam_b64 = make_overlay(image_bytes, heatmap)

    return {
        "fire_detected": is_fire,
        "confidence": confidence / 100.0, # le frontend s'attend à un score de 0 à 1
        "gradcam_base64": f"data:image/jpeg;base64,{gradcam_b64}" if gradcam_b64 else None
    }

# Initialisation du modèle dès le chargement du fichier (au démarrage du serveur)
print("--- DÉMARRAGE DU SERVICE IA ---")
init_model()
