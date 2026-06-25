import type {
  PredictPayload,
  PredictionResponse,
  PredictionResult,
} from "./types/prediction";
import { PredictionError } from "./types/prediction";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const PREDICT_ENDPOINT = `${API_BASE_URL}/predict`;

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

function validateFile(file: File | Blob): void {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new PredictionError(
      `Fichier trop volumineux (max 5 Mo, reçu ${(file.size / 1024 / 1024).toFixed(1)} Mo)`,
    );
  }

  const mime = file instanceof File ? file.type : (file as Blob).type;
  if (!ALLOWED_MIME_TYPES.includes(mime)) {
    throw new PredictionError(
      `Format non supporté : ${mime || "inconnu"}. Formats acceptés : JPEG, PNG, WebP`,
    );
  }
}

function mapResponse(raw: PredictionResponse): PredictionResult {
  return {
    isFire: raw.is_fire,
    confidence: Math.round(raw.confidence * 100),
    label: raw.is_fire ? "Feu détecté" : "Aucun feu",
    severity: raw.is_fire ? "danger" : "safe",
    gradcamBase64: raw.gradcam_data,
    analyzedAt: new Date(),
  };
}

// ── Fonction principale ───────────────────────────────────────────────────
/**
 * Envoie une image vers POST /predict et retourne le résultat de détection.
 *
 * @example
 * const result = await predictFire({ file: imageFile });
 * if (result.isFire) alert(`🔥 ${result.label} (${result.confidence}%)`);
 */
export async function predictFire(
  payload: PredictPayload,
  signal?: AbortSignal,
): Promise<PredictionResult> {
  const { file, filename } = payload;

  // 1. Validation locale
  validateFile(file);

  // 2. Construction du FormData
  const formData = new FormData();
  const resolvedFilename =
    filename ?? (file instanceof File ? file.name : "capture.jpg");
  formData.append("file", file, resolvedFilename);

  // 3. Récupération du JWT (ajouté en header si présent)
  const token = localStorage.getItem("access_token");
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

  // 4. Appel API
  let response: Response;
  try {
    response = await fetch(PREDICT_ENDPOINT, {
      method: "POST",
      headers,
      body: formData,
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new PredictionError("Analyse annulée");
    }
    throw new PredictionError(
      "Impossible de joindre le serveur. Vérifiez votre connexion.",
    );
  }

  // 5. Gestion des erreurs HTTP
  if (!response.ok) {
    let detail = `Erreur serveur (${response.status})`;
    try {
      const body = await response.json();
      detail = body?.detail ?? detail;
    } catch {
     
    }
    throw new PredictionError(detail, response.status);
  }

  // 6. Parse + mapping
  const raw: PredictionResponse = await response.json();
  return mapResponse(raw);
}

// ── Utilitaire : analyse d'une frame Blob (ex: capturée via WebRTC) ───────
/**
 * Variante pour les frames vidéo capturées depuis un canvas ou MediaStream.
 * Convertit un Blob brut en résultat de prédiction.
 */
export async function predictFrame(
  blob: Blob,
  signal?: AbortSignal,
): Promise<PredictionResult> {
  return predictFire({ file: blob, filename: "frame.jpg" }, signal);
}