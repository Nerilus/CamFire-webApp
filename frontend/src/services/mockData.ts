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
    id: 'cam-1',
    name: 'Bois de Vincennes (Paris Est)',
    status: 'fire',
    temp: 84,
    risk: 94,
    battery: 78,
    coords: '48.8283°N 2.4330°E',
    x: 65,
    y: 72,
    lastUpdate: 'Il y a 30s',
  },
  {
    id: 'cam-2',
    name: 'Bois de Boulogne (Paris Ouest)',
    status: 'warn',
    temp: 41,
    risk: 61,
    battery: 92,
    coords: '48.8624°N 2.2492°E',
    x: 25,
    y: 40,
    lastUpdate: 'Il y a 2 min',
  },
  {
    id: 'cam-3',
    name: 'Forêt de Fontainebleau',
    status: 'safe',
    temp: 24,
    risk: 4,
    battery: 99,
    coords: '48.4066°N 2.6685°E',
    x: 80,
    y: 32,
    lastUpdate: 'Il y a 5 min',
  },
  {
    id: 'cam-4',
    name: 'Forêt de Rambouillet',
    status: 'safe',
    temp: 18,
    risk: 1,
    battery: 87,
    coords: '48.6644°N 1.8156°E',
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
