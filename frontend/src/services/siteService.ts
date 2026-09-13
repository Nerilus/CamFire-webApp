import { API_URL } from '../config/api';

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
  is_maintenance_mode?: boolean;
  maintenance_until?: string | null;
  alarm_active?: boolean;
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
  },

  async getTacticalPoints(siteId: number): Promise<TacticalPoint[]> {
    const res = await fetch(`${API_URL}/sites/${siteId}/tactical-points`, {
      headers: getHeaders()
    });
    if (!res.ok) {
      return [];
    }
    return res.json();
  },

  async createTacticalPoint(siteId: number, data: TacticalPointInput): Promise<TacticalPoint> {
    const res = await fetch(`${API_URL}/sites/${siteId}/tactical-points`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Erreur lors de l'ajout du point tactique." }));
      throw new Error(err.detail || "Erreur lors de l'ajout du point tactique.");
    }
    return res.json();
  },

  async deleteTacticalPoint(pointId: number): Promise<void> {
    const res = await fetch(`${API_URL}/sites/tactical-points/${pointId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) {
      throw new Error("Erreur lors de la suppression du point tactique.");
    }
  },

  async scanOsmHydrants(siteId: number, radiusMeters: number = 2500): Promise<OsmHydrantScanResponse> {
    const res = await fetch(`${API_URL}/sites/${siteId}/scan-osm-hydrants?radius=${radiusMeters}`, {
      headers: getHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Erreur lors du scan OpenData." }));
      throw new Error(err.detail || "Erreur lors du scan OpenData.");
    }
    return res.json();
  },

  async importOsmHydrants(siteId: number, radiusMeters: number = 2500, selectedOsmIds?: number[]): Promise<OsmHydrantImportResponse> {
    const res = await fetch(`${API_URL}/sites/${siteId}/import-osm-hydrants`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ radius_meters: radiusMeters, selected_osm_ids: selectedOsmIds })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Erreur lors de l'import OpenData." }));
      throw new Error(err.detail || "Erreur lors de l'import OpenData.");
    }
    return res.json();
  }
};

export interface TacticalPoint {
  id: number;
  site_id: number;
  name: string;
  point_type: 'water_tank' | 'hydrant' | 'pool' | 'access_path' | 'gate';
  lat: number;
  lng: number;
  capacity_liters?: number;
  notes?: string;
  created_at: string;
}

export interface TacticalPointInput {
  name: string;
  point_type: 'water_tank' | 'hydrant' | 'pool' | 'access_path' | 'gate';
  lat: number;
  lng: number;
  capacity_liters?: number;
  notes?: string;
}

export interface OsmHydrantItem {
  osm_id: number;
  name: string;
  point_type: 'water_tank' | 'hydrant' | 'pool' | 'access_path' | 'gate';
  lat: number;
  lng: number;
  distance_meters: number;
  capacity_liters?: number;
  notes?: string;
  already_imported?: boolean;
}

export interface OsmHydrantScanResponse {
  total_found: number;
  radius_meters: number;
  items: OsmHydrantItem[];
}

export interface OsmHydrantImportResponse {
  imported_count: number;
  already_existing: number;
  total_found: number;
  points: TacticalPoint[];
}
