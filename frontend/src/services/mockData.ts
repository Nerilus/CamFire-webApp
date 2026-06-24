export type ScanStatus = 'fire' | 'safe' | 'warn';

export interface ScanRecord {
  id: string;
  status: ScanStatus;
  location: string;
  date: string;
  confidence?: number;
  coords?: string;
}

export const scanHistory: ScanRecord[] = [
  { id: '1', status: 'fire', location: 'Secteur 7B, Marseille', date: '24 juin 2026, 14:32', confidence: 94, coords: '43.2965°N 5.3698°E' },
  { id: '2', status: 'safe', location: 'Rue de la Paix, Lyon', date: '23 juin 2026, 09:15' },
  { id: '3', status: 'warn', location: 'Zone Industrielle, Bordeaux', date: '22 juin 2026, 16:47', confidence: 61 },
  { id: '4', status: 'safe', location: 'Centre Ville, Paris', date: '21 juin 2026, 11:20' },
  { id: '5', status: 'fire', location: 'Forêt des Landes, Gironde', date: '19 juin 2026, 22:08', confidence: 99, coords: '44.2167°N 0.9000°W' },
];

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  role: string;
}

export const emergencyContacts: EmergencyContact[] = [
  { id: '1', name: 'Marie Dupont', phone: '+33 6 12 34 56 78', role: 'Voisin' },
  { id: '2', name: 'Jean-Paul Martin', phone: '+33 7 98 76 54 32', role: 'Famille' },
];
