const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface CaptureItem {
  id: number;
  detection_type: 'person' | 'fire' | 'manual';
  status: 'warn' | 'fire' | 'safe';
  confidence?: number;
  location?: string;
  image_url: string;
  created_at: string;
  user_id?: number;
  device_id?: number;
}

export const captureService = {
  async getCaptures(type?: string): Promise<CaptureItem[]> {
    const url = new URL(`${API_URL}/captures/`);
    if (type && type !== 'all') {
      url.searchParams.set('detection_type', type);
    }
    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error('Impossible de récupérer les captures');
    }
    const data: CaptureItem[] = await res.json();
    return data.map(item => ({
      ...item,
      // Si l'URL commence par /static, préfixer avec API_URL pour un affichage direct
      image_url: item.image_url.startsWith('http') ? item.image_url : `${API_URL}${item.image_url}`
    }));
  },

  async deleteCapture(id: number): Promise<boolean> {
    const res = await fetch(`${API_URL}/captures/${id}`, {
      method: 'DELETE',
    });
    return res.ok;
  },

  async createManualCapture(data: {
    detection_type: string;
    status: string;
    confidence?: number;
    location?: string;
    image_url: string;
  }): Promise<CaptureItem> {
    const res = await fetch(`${API_URL}/captures/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error('Erreur lors de la création de la capture');
    }
    return res.json();
  }
};
