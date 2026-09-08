const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface Device {
  id: number;
  device_id: string;
  name: string;
  role?: 'owner' | 'member';
  is_paired: boolean;
  paired_at?: string;
  last_seen_at?: string;
  lat?: number;
  lng?: number;
  status: 'online' | 'offline';
}

export interface DeviceMember {
  user_id: number;
  email: string;
  firstname?: string;
  lastname?: string;
  role: 'owner' | 'member';
  paired_at?: string;
}

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
};

export const deviceService = {
  /**
   * Récupère les équipements Raspberry Pi liés au compte
   */
  async getMyDevices(): Promise<Device[]> {
    const response = await fetch(`${API_URL}/devices/my`, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des appareils');
    }
    return response.json();
  },

  /**
   * Appaire un nouvel équipement avec son ID matériel et son code secret
   */
  async pairDevice(deviceId: string, pairingCode: string, name?: string): Promise<Device> {
    const response = await fetch(`${API_URL}/devices/pair`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        device_id: deviceId.trim(),
        pairing_code: pairingCode.trim(),
        name: name ? name.trim() : undefined,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || "Échec de l'appairage de l'appareil.");
    }

    return response.json();
  },

  /**
   * Dissocie un appareil en vérifiant le mot de passe du compte
   */
  async unpairDevice(deviceId: string, password: string): Promise<void> {
    const response = await fetch(`${API_URL}/devices/unpair/${deviceId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || "Échec de la dissociation de l'appareil.");
    }
  },

  /**
   * Récupère la liste des comptes associés à l'appareil
   */
  async getDeviceMembers(deviceId: string): Promise<DeviceMember[]> {
    const response = await fetch(`${API_URL}/devices/${deviceId}/members`, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des membres');
    }
    return response.json();
  },

  /**
   * Révoque l'accès d'un compte (Action réservée au propriétaire / owner)
   */
  async revokeMember(deviceId: string, userId: number): Promise<void> {
    const response = await fetch(`${API_URL}/devices/${deviceId}/members/${userId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Erreur lors de la révocation du membre');
    }
  },

  /**
   * Régénère un nouveau code d'appairage sécurisé (Action réservée au propriétaire / owner)
   */
  async refreshPairingCode(deviceId: string): Promise<{ device_id: string; new_pairing_code: string; expires_at?: string }> {
    const response = await fetch(`${API_URL}/devices/${deviceId}/refresh-code`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Erreur lors de la régénération du code');
    }
    return response.json();
  },

  /**
   * Génère l'URL de streaming sécurisée (avec jeton d'authentification)
   */
  getSecureStreamUrl(deviceId: string): string {
    const token = localStorage.getItem('token');
    return `${API_URL}/devices/${deviceId}/stream?token=${token || ''}`;
  },

  /**
   * Obtient un ticket de streaming éphémère (60 secondes) et retourne l'URL sans exposer le JWT
   */
  async getEphemeralStreamUrl(deviceId: string): Promise<string> {
    try {
      const response = await fetch(`${API_URL}/devices/${deviceId}/stream-ticket`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        return `${API_URL}${data.stream_url}`;
      }
    } catch {
      // Fallback
    }
    return this.getSecureStreamUrl(deviceId);
  }
};


