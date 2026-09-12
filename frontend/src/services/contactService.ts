import { API_URL } from '../config/api';

export interface EmergencyContact {
  id: number;
  user_id: number;
  name: string;
  phone: string;
  email?: string;
  role: string;
}

export interface EmergencyAlertSettings {
  emergency_alert_emails: string[];
  emergency_alerts_enabled: boolean;
}

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
};

const handleResponse = async (response: Response, errorMsg: string) => {
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      window.dispatchEvent(new Event('camfire_unauthorized'));
    }
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || errorMsg);
  }
  return response;
};

export const contactService = {
  async getContacts(): Promise<EmergencyContact[]> {
    const response = await fetch(`${API_URL}/contacts/`, {
      method: 'GET',
      headers: getHeaders(),
    });
    await handleResponse(response, 'Erreur lors de la récupération des contacts');
    return response.json();
  },

  async addContact(name: string, phone: string, role: string, email?: string): Promise<EmergencyContact> {
    const response = await fetch(`${API_URL}/contacts/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, phone, role, email: email ? email.trim() : undefined }),
    });
    await handleResponse(response, "Erreur lors de l'ajout du contact");
    return response.json();
  },

  async deleteContact(id: number): Promise<void> {
    const response = await fetch(`${API_URL}/contacts/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    await handleResponse(response, 'Erreur lors de la suppression du contact');
  },

  /**
   * Récupère la configuration des alertes e-mail d'urgence avec photo
   */
  async getEmergencyAlertSettings(): Promise<EmergencyAlertSettings> {
    const response = await fetch(`${API_URL}/auth/emergency-alerts`, {
      method: 'GET',
      headers: getHeaders(),
    });
    await handleResponse(response, 'Erreur lors de la récupération des réglages d\'alerte');
    return response.json();
  },

  /**
   * Met à jour la liste des e-mails d'urgence et l'activation des alertes avec photo
   */
  async updateEmergencyAlertSettings(emails: string[], enabled: boolean): Promise<EmergencyAlertSettings> {
    const response = await fetch(`${API_URL}/auth/emergency-alerts`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({
        emergency_alert_emails: emails,
        emergency_alerts_enabled: enabled,
      }),
    });
    await handleResponse(response, 'Erreur lors de l\'enregistrement des réglages');
    return response.json();
  },

  /**
   * Envoie immédiatement un e-mail test d'alerte incendie critique
   */
  async testEmergencyAlert(): Promise<{ status: string; message: string }> {
    const response = await fetch(`${API_URL}/auth/emergency-alerts/test`, {
      method: 'POST',
      headers: getHeaders(),
    });
    await handleResponse(response, 'Erreur lors de l\'envoi de l\'e-mail de test');
    return response.json();
  },
};
