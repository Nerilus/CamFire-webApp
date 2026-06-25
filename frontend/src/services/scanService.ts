const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface ScanResult {
  fire_detected: boolean;
  confidence: number;
  gradcam_base64?: string | null;
}

export const scanService = {
  async predictImage(fileOrBlob: Blob): Promise<ScanResult> {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Non authentifié. Veuillez vous reconnecter.');

    const formData = new FormData();
    formData.append('file', fileOrBlob, 'scan.jpg');

    const response = await fetch(`${API_URL}/scan/predict`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Erreur lors de l'analyse de l'image par l'IA.");
    }

    return response.json();
  }
};
