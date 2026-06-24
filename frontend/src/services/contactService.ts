const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface EmergencyContact {
  id: number;
  user_id: number;
  name: string;
  phone: string;
  role: string;
}

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
};

export const contactService = {
  async getContacts(): Promise<EmergencyContact[]> {
    const response = await fetch(`${API_URL}/contacts/`, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Erreur lors de la récupération des contacts');
    return response.json();
  },

  async addContact(name: string, phone: string, role: string): Promise<EmergencyContact> {
    const response = await fetch(`${API_URL}/contacts/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, phone, role }),
    });
    if (!response.ok) throw new Error('Erreur lors de l\'ajout du contact');
    return response.json();
  },

  async deleteContact(id: number): Promise<void> {
    const response = await fetch(`${API_URL}/contacts/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Erreur lors de la suppression du contact');
  }
};
