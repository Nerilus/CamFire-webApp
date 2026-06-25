import { useState, useCallback, useRef } from "react";
import { predictFire, predictFrame } from "@/services/predictionService";
import type { PredictionResult, PredictPayload } from "@/services/types/prediction";
import { PredictionError } from "@/services/types/prediction";

interface UsePredictionState {
  result: PredictionResult | null;
  isLoading: boolean;
  error: string | null;
}

interface UsePredictionReturn extends UsePredictionState {
  analyze: (payload: PredictPayload) => Promise<PredictionResult | null>;
  analyzeFrame: (blob: Blob) => Promise<PredictionResult | null>;
  reset: () => void;
  cancel: () => void;
}

/**
 * Hook pour envoyer une image/frame au service de prédiction.
 *
 * @example
 * const { analyze, result, isLoading, error } = usePrediction();
 *
 * const handleFile = async (file: File) => {
 *   const res = await analyze({ file });
 *   if (res?.isFire) console.log("🔥 Feu détecté !");
 * };
 */
export function usePrediction(): UsePredictionReturn {
  const [state, setState] = useState<UsePredictionState>({
    result: null,
    isLoading: false,
    error: null,
  });

  // AbortController pour annuler la requête en cours
  const abortRef = useRef<AbortController | null>(null);

  const analyze = useCallback(
    async (payload: PredictPayload): Promise<PredictionResult | null> => {
      // Annule toute requête précédente encore en vol
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setState({ result: null, isLoading: true, error: null });

      try {
        const result = await predictFire(payload, abortRef.current.signal);
        setState({ result, isLoading: false, error: null });
        return result;
      } catch (err) {
        if (err instanceof PredictionError && err.message === "Analyse annulée") {
          // Annulation volontaire — on ne met pas à jour l'état
          return null;
        }
        const message =
          err instanceof PredictionError
            ? err.message
            : "Une erreur inattendue s'est produite.";
        setState({ result: null, isLoading: false, error: message });
        return null;
      }
    },
    [],
  );

  const analyzeFrame = useCallback(
    async (blob: Blob): Promise<PredictionResult | null> => {
      return analyze({ file: blob, filename: "frame.jpg" });
    },
    [analyze],
  );

  const reset = useCallback(() => {
    setState({ result: null, isLoading: false, error: null });
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState((prev) => ({ ...prev, isLoading: false }));
  }, []);

  return { ...state, analyze, analyzeFrame, reset, cancel };
}