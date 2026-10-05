import { API_URL } from '../config/api';

export interface ScanResult {
  detections: Array<{
    bbox: number[];
    confidence: number;
    class: string;
  }>;
  image_base64: string;
  fire_detected?: boolean;
  confidence?: number;
  alert_triggered?: boolean;
}

export const scanService = {
  async predictImage(fileOrBlob: Blob): Promise<ScanResult> {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Non authentifié. Veuillez vous reconnecter.');

    const formData = new FormData();
    const fileName = (fileOrBlob instanceof File) ? fileOrBlob.name : (fileOrBlob.type.startsWith('video/') ? 'scan.mp4' : 'scan.jpg');
    formData.append('file', fileOrBlob, fileName);

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
