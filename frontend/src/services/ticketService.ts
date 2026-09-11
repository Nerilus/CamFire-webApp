export interface Ticket {
  id: number;
  device_id: number | null;
  client_name: string;
  location: string | null;
  description: string | null;
  created_at: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class TicketService {
  private getHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  async getMyTickets(): Promise<Ticket[]> {
    const response = await fetch(`${API_URL}/tickets`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error("Erreur lors de la récupération des tickets.");
    }
    return response.json();
  }
}

export const ticketService = new TicketService();
