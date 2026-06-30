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
  { id: '6', status: 'safe', location: 'Quai de la Fosse, Nantes', date: '18 juin 2026, 07:44' },
];

export interface Camera {
  id: string;
  name: string;
  status: 'safe' | 'warn' | 'fire';
  temp: number;
  risk: number;
  battery: number;
  coords: string;
  x: number; // SVG coordinates percent
  y: number;
  lastUpdate: string;
}

export const cameras: Camera[] = [
  {
    id: 'cam-1',
    name: 'Calanques - Sud (Marseille)',
    status: 'fire',
    temp: 84,
    risk: 94,
    battery: 78,
    coords: '43.2104°N 5.4382°E',
    x: 65,
    y: 72,
    lastUpdate: 'Il y a 30s',
  },
  {
    id: 'cam-2',
    name: 'Forêt des Landes - Secteur Nord',
    status: 'warn',
    temp: 41,
    risk: 61,
    battery: 92,
    coords: '44.5824°N 0.7452°W',
    x: 25,
    y: 40,
    lastUpdate: 'Il y a 2 min',
  },
  {
    id: 'cam-3',
    name: 'Massif Sainte-Victoire - Crête',
    status: 'safe',
    temp: 24,
    risk: 4,
    battery: 99,
    coords: '43.5312°N 5.5794°E',
    x: 80,
    y: 32,
    lastUpdate: 'Il y a 5 min',
  },
  {
    id: 'cam-4',
    name: 'Mercantour - Vallée Haute',
    status: 'safe',
    temp: 18,
    risk: 1,
    battery: 87,
    coords: '44.1504°N 7.1298°E',
    x: 48,
    y: 18,
    lastUpdate: 'Il y a 8 min',
  },
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
