const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface LoginResult {
  requires2FA: boolean;
  token?: string;
  tempToken?: string;
  emailMasked?: string;
  expiresInSeconds?: number;
}

export const authService = {
  /**
   * Inscription (Attend du JSON)
   */
  async register(
    email: string, 
    password: string, 
    deviceData?: { pair_device: boolean; device_id: string; pairing_code: string; device_name?: string }
  ): Promise<void> {
    const payload: Record<string, any> = { email, password };
    if (deviceData && deviceData.pair_device) {
      payload.pair_device = true;
      payload.device_id = deviceData.device_id;
      payload.pairing_code = deviceData.pairing_code;
      if (deviceData.device_name) payload.device_name = deviceData.device_name;
    }

    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Échec de l'inscription");
    }
  },

  /**
   * Connexion (Attend du x-www-form-urlencoded)
   * Retourne soit le token direct, soit un challenge 2FA
   */
  async login(username: string, password: string): Promise<LoginResult> {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);

    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Identifiants incorrects');
    }

    const data = await response.json();

    if (data.requires_2fa) {
      return {
        requires2FA: true,
        tempToken: data.temp_token,
        emailMasked: data.email_masked,
        expiresInSeconds: data.expires_in_seconds,
      };
    }

    localStorage.setItem('token', data.access_token);
    return {
      requires2FA: false,
      token: data.access_token,
    };
  },

  /**
   * Validation du code 2FA par e-mail
   */
  async verify2FA(tempToken: string, code: string): Promise<string> {
    const response = await fetch(`${API_URL}/auth/verify-2fa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ temp_token: tempToken, code: code.trim() }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Code de vérification invalide');
    }

    const data = await response.json();
    localStorage.setItem('token', data.access_token);
    return data.access_token;
  },

  /**
   * Renvoyer un nouveau code 2FA
   */
  async resend2FA(tempToken: string): Promise<{ message: string; expiresInSeconds: number }> {
    const response = await fetch(`${API_URL}/auth/resend-2fa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ temp_token: tempToken }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Échec de l'envoi du nouveau code");
    }

    const data = await response.json();
    return {
      message: data.message,
      expiresInSeconds: data.expires_in_seconds,
    };
  },

  /**
   * Demande de désactivation du 2FA (envoie un code par e-mail)
   */
  async requestDisable2FA(): Promise<{ message: string; emailMasked: string; expiresInSeconds: number }> {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Aucun jeton trouvé');

    const response = await fetch(`${API_URL}/auth/me/2fa/request-disable`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Échec de l'envoi du code de confirmation");
    }

    const data = await response.json();
    return {
      message: data.message,
      emailMasked: data.email_masked,
      expiresInSeconds: data.expires_in_seconds,
    };
  },

  /**
   * Confirmation de la désactivation du 2FA avec le code reçu par e-mail
   */
  async confirmDisable2FA(code: string): Promise<boolean> {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Aucun jeton trouvé');

    const response = await fetch(`${API_URL}/auth/me/2fa/confirm-disable`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: code.trim() }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Code de confirmation invalide');
    }

    const data = await response.json();
    return data.is_2fa_enabled;
  },

  /**
   * Activation directe de la double authentification
   */
  async enable2FA(): Promise<boolean> {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Aucun jeton trouvé');

    const response = await fetch(`${API_URL}/auth/me/2fa/enable`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Échec de l'activation de la double authentification");
    }

    const data = await response.json();
    return data.is_2fa_enabled;
  },

  /**
   * Méthode de bascule (fallback)
   */
  async toggle2FA(enabled: boolean): Promise<boolean> {
    if (enabled) {
      return this.enable2FA();
    }
    throw new Error('Pour désactiver le 2FA, veuillez demander un code de confirmation.');
  },



  /**
   * Récupération du profil
   */
  async getMe() {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Aucun jeton trouvé');

    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        window.dispatchEvent(new Event('camfire_unauthorized'));
      }
      throw new Error('Session expirée');
    }

    return await response.json();
  },

  logout(): void {
    localStorage.removeItem('token');
    window.dispatchEvent(new Event('camfire_unauthorized'));
  },

  /**
   * Mise à jour du profil (prénom, nom)
   */
  async updateProfile(firstname: string, lastname: string) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Aucun jeton trouvé');

    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ firstname, lastname }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Erreur lors de la mise à jour du profil');
    }

    return await response.json();
  },

  /**
   * Mise à jour du mot de passe
   */
  async updatePassword(currentPassword: string, newPassword: string) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Aucun jeton trouvé');

    const response = await fetch(`${API_URL}/auth/me/password`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Erreur lors du changement de mot de passe');
    }

    return await response.json();
  }
};