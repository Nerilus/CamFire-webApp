const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const authService = {
  /**
   * Inscription (Attend du JSON)
   */
  async register(email: string, password: string): Promise<void> {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Échec de l'inscription");
    }
  },

  /**
   * Connexion (Attend du x-www-form-urlencoded)
   */
  async login(username: string, password: string): Promise<string> {
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
    localStorage.setItem('token', data.access_token);
    return data.access_token;
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
      localStorage.removeItem('token');
      throw new Error('Session expirée');
    }

    return await response.json();
  },

  logout(): void {
    localStorage.removeItem('token');
  }
};