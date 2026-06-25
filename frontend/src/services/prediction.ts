export interface PredictionResponse {
  is_fire: boolean;
  confidence: number;   // 0.0 – 1.0
  raw_score: number;
  gradcam_data?: string; 
}

export interface PredictionResult {
  isFire: boolean;
  confidence: number;         // pourcentage 0–100
  label: "Feu détecté" | "Aucun feu";
  severity: "danger" | "safe";
  gradcamBase64?: string;
  analyzedAt: Date;
}

// ── Paramètres d'envoi ────────────────────────────────────────────────────
export interface PredictPayload {
  file: File | Blob;
  filename?: string;
}

export class PredictionError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "PredictionError";
  }
}