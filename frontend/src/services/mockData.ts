// Ce fichier ne contient plus de fausses données (mock).
// L'ensemble de l'application CamFire utilise les endpoints réels de l'API backend et de la base de données PostgreSQL.

export type ScanStatus = 'fire' | 'safe' | 'warn';

export interface ScanRecord {
  id: string;
  status: ScanStatus;
  location: string;
  date: string;
  confidence?: number;
  coords?: string;
  image_url?: string;
}

export const scanHistory: ScanRecord[] = [];

export interface Camera {
  id: string;
  name: string;
  status: 'safe' | 'warn' | 'fire';
  temp: number;
  risk: number;
  battery: number;
  coords: string;
  x: number;
  y: number;
  lastUpdate: string;
}

export const cameras: Camera[] = [];

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  role: string;
}

export const emergencyContacts: EmergencyContact[] = [];
