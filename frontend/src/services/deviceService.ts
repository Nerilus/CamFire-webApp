import { API_URL } from '../config/api';

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
  status: 'online' | 'offline' | 'tampered';
  tamper_status?: 'normal' | 'tampered' | 'signal_lost';
  cpu_temp?: number;
  disk_free_gb?: number;
  wifi_rssi?: number;
  battery_voltage?: number;
  privacy_masks?: string | null;
  is_maintenance_mode?: boolean;
  maintenance_until?: string | null;
  alarm_active?: boolean;
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
  },

  /**
   * Transmet un message vocal enregistré au haut-parleur du Raspberry Pi
   */
  async speakToDevice(deviceId: string, audioBlob: Blob): Promise<{ status: string; message: string }> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/devices/${deviceId}/speak`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': audioBlob.type || 'audio/webm',
      },
      body: audioBlob,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || "Échec de l'envoi vocal au Raspberry Pi.");
    }
    return response.json();
  },

  /**
   * URL du flux audio direct pour écouter le micro du Raspberry Pi
   */
  getAudioStreamUrl(deviceId: string): string {
    const token = localStorage.getItem('token');
    return `${API_URL}/devices/${deviceId}/audio?token=${token || ''}`;
  },

  /**
   * Déclenche ou arrête la sirène d'alarme sur le Raspberry Pi
   */
  async triggerAlarm(deviceId: string, action: 'start' | 'stop', durationSeconds: number = 15): Promise<{ status: string; alarm_active: boolean; message: string }> {
    const response = await fetch(`${API_URL}/devices/${deviceId}/alarm`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action, duration_seconds: durationSeconds }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || "Échec de la commande d'alarme.");
    }
    return response.json();
  },

  /**
   * Active ou désactive le Mode Travaux (pause détection incendie pour travaux/fumées)
   */
  async toggleMaintenance(deviceId: string, enabled: boolean, durationHours?: number): Promise<{ status: string; is_maintenance_mode: boolean; maintenance_until?: string | null; message: string }> {
    const response = await fetch(`${API_URL}/devices/${deviceId}/maintenance`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ enabled, duration_hours: durationHours }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || "Échec de la modification du Mode Travaux.");
    }
    return response.json();
  },

  /**
   * Enregistre les zones de masquage de confidentialité RGPD pour le flux
   */
  async updatePrivacyMasks(deviceId: string, privacyMasks: string): Promise<{ status: string; privacy_masks: string; message: string }> {
    const response = await fetch(`${API_URL}/devices/${deviceId}/privacy-masks`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ privacy_masks: privacyMasks }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || "Échec de l'enregistrement des masques RGPD.");
    }
    return response.json();
  }
};


