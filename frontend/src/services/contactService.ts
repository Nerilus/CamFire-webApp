import { API_URL } from '../config/api';

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

const handleResponse = async (response: Response, errorMsg: string) => {
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      window.dispatchEvent(new Event('camfire_unauthorized'));
    }
    throw new Error(errorMsg);
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

  async addContact(name: string, phone: string, role: string): Promise<EmergencyContact> {
    const response = await fetch(`${API_URL}/contacts/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, phone, role }),
    });
    await handleResponse(response, 'Erreur lors de l\'ajout du contact');
    return response.json();
  },

  async deleteContact(id: number): Promise<void> {
    const response = await fetch(`${API_URL}/contacts/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    await handleResponse(response, 'Erreur lors de la suppression du contact');
  }
};
