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
  { id: '1', status: 'fire', location: 'Bois de Vincennes (Paris Est)', date: '30 juin 2026, 14:32', confidence: 94, coords: '48.8283°N 2.4330°E' },
  { id: '2', status: 'warn', location: 'Bois de Boulogne (Paris Ouest)', date: '30 juin 2026, 16:47', confidence: 61, coords: '48.8624°N 2.2492°E' },
  { id: '3', status: 'safe', location: 'Forêt de Fontainebleau', date: '30 juin 2026, 09:15', coords: '48.4066°N 2.6685°E' },
  { id: '4', status: 'safe', location: 'Forêt de Rambouillet', date: '29 juin 2026, 11:20', coords: '48.6644°N 1.8156°E' },
  { id: '5', status: 'safe', location: 'Forêt de Fontainebleau', date: '28 juin 2026, 22:08', coords: '48.4066°N 2.6685°E' },
  { id: '6', status: 'safe', location: 'Bois de Vincennes (Paris Est)', date: '28 juin 2026, 07:44', coords: '48.8283°N 2.4330°E' },
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
    id: 'cam-axis-1',
    name: 'AXIS M1065-L (Locale)',
    status: 'safe',
    temp: 20,
    risk: 0,
    battery: 100,
    coords: '46.2276°N 2.2137°E', // Central France for demo purposes
    x: 50,
    y: 50,
    lastUpdate: 'En direct',
  }
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
