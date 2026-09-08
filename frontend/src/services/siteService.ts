const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
};

export interface SiteDeviceSummary {
  id: number;
  device_id: string;
  name: string;
  stream_url?: string;
  is_online: boolean;
}

export interface Site {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  lat: number;
  lng: number;
  radius: number; // en mètres
  device_id?: number | null;
  device?: SiteDeviceSummary | null;
  created_at: string;
}

export interface SiteCreateInput {
  name: string;
  description?: string;
  lat: number;
  lng: number;
  radius?: number;
  device_id?: number | null;
}

export interface SiteUpdateInput {
  name?: string;
  description?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  device_id?: number | null;
}

export const siteService = {
  async getSites(): Promise<Site[]> {
    const res = await fetch(`${API_URL}/sites`, {
      headers: getHeaders()
    });
    if (!res.ok) {
      throw new Error("Impossible de récupérer vos sites.");
    }
    return res.json();
  },

  async createSite(data: SiteCreateInput): Promise<Site> {
    const res = await fetch(`${API_URL}/sites`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Erreur lors de la création du site." }));
      throw new Error(err.detail || "Erreur lors de la création du site.");
    }
    return res.json();
  },

  async updateSite(id: number, data: SiteUpdateInput): Promise<Site> {
    const res = await fetch(`${API_URL}/sites/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Erreur lors de la modification du site." }));
      throw new Error(err.detail || "Erreur lors de la modification du site.");
    }
    return res.json();
  },

  async assignDevice(siteId: number, deviceId: number | null): Promise<Site> {
    const res = await fetch(`${API_URL}/sites/${siteId}/assign`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ device_id: deviceId })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Erreur lors de l'association du Raspberry Pi." }));
      throw new Error(err.detail || "Erreur lors de l'association du Raspberry Pi.");
    }
    return res.json();
  },

  async deleteSite(id: number): Promise<{ message: string }> {
    const res = await fetch(`${API_URL}/sites/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) {
      throw new Error("Erreur lors de la suppression du site.");
    }
    return res.json();
  }
};
