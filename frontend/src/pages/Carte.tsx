import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CameraIcon, FlameIcon, WarningIcon, CheckCircleIcon, XIcon, RefreshIcon } from '../components/icons';
import './Carte.css';

interface Camera {
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

const initialCameras: Camera[] = [
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

export const Carte: React.FC = () => {
  const navigate = useNavigate();
  const [cameras, setCameras] = useState<Camera[]>(initialCameras);
  const [selectedCamId, setSelectedCamId] = useState<string | null>('cam-1');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const selectedCam = cameras.find((c) => c.id === selectedCamId);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      // Simulate refreshing metrics slightly
      setCameras((prev) =>
        prev.map((c) => {
          if (c.status === 'fire') {
            return { ...c, temp: Math.floor(82 + Math.random() * 5), risk: Math.floor(92 + Math.random() * 4) };
          }
          if (c.status === 'warn') {
            return { ...c, temp: Math.floor(39 + Math.random() * 4), risk: Math.floor(58 + Math.random() * 6) };
          }
          return { ...c, temp: Math.floor(21 + Math.random() * 4) };
        })
      );
      setIsRefreshing(false);
    }, 800);
  };

  const getStatusBadge = (status: Camera['status']) => {
    switch (status) {
      case 'fire':
        return <span className="badge badge-fire"><FlameIcon size={12} /> CRITIQUE</span>;
      case 'warn':
        return <span className="badge badge-warn"><WarningIcon size={12} /> ALERTE</span>;
      default:
        return <span className="badge badge-safe"><CheckCircleIcon size={12} /> SURVEILLÉ</span>;
    }
  };

  return (
    <div className="carte-page">
      <div className="carte-header">
        <div>
          <h1 className="carte-title">RÉSEAU DE SURVEILLANCE</h1>
          <p className="carte-subtitle">{cameras.length} caméras actives</p>
        </div>
        <button
          className={`carte-refresh-btn ${isRefreshing ? 'spinning' : ''}`}
          onClick={handleRefresh}
          aria-label="Rafraîchir les caméras"
        >
          <RefreshIcon size={20} />
        </button>
      </div>

      <div className="map-container">
        {/* Futuristic Topography Vector Map Representation */}
        <svg className="map-vector" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Radar Scanning Sweep Circle */}
          <circle cx="50" cy="50" r="45" stroke="rgba(255, 69, 0, 0.04)" strokeWidth="0.5" fill="none" />
          <circle cx="50" cy="50" r="30" stroke="rgba(255, 255, 255, 0.02)" strokeWidth="0.5" fill="none" />
          <circle cx="50" cy="50" r="15" stroke="rgba(255, 255, 255, 0.02)" strokeWidth="0.5" fill="none" />

          {/* Grid lines */}
          <line x1="10" y1="0" x2="10" y2="100" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="0.2" />
          <line x1="30" y1="0" x2="30" y2="100" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="0.2" />
          <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="0.2" />
          <line x1="70" y1="0" x2="70" y2="100" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="0.2" />
          <line x1="90" y1="0" x2="90" y2="100" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="0.2" />
          
          <line x1="0" y1="10" x2="100" y2="10" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="0.2" />
          <line x1="0" y1="30" x2="100" y2="30" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="0.2" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="0.2" />
          <line x1="0" y1="70" x2="100" y2="70" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="0.2" />
          <line x1="0" y1="90" x2="100" y2="90" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="0.2" />

          {/* Contour topographic paths (simulated mountains/forest land shapes) */}
          <path
            d="M -10,30 Q 15,10 30,35 T 70,25 T 110,40"
            fill="none"
            stroke="rgba(255, 255, 255, 0.04)"
            strokeWidth="0.6"
          />
          <path
            d="M -10,50 Q 20,40 45,65 T 85,50 T 110,65"
            fill="none"
            stroke="rgba(255, 255, 255, 0.03)"
            strokeWidth="0.5"
          />
          <path
            d="M -10,75 Q 10,85 35,68 T 75,85 T 110,70"
            fill="none"
            stroke="rgba(255, 69, 0, 0.05)"
            strokeWidth="0.8"
          />

          {/* High risk zone glowing polygon overlay */}
          <polygon
            points="55,60 75,55 85,75 70,88 50,75"
            fill="rgba(255, 69, 0, 0.06)"
            stroke="rgba(255, 69, 0, 0.2)"
            strokeWidth="0.4"
            strokeDasharray="1,1"
          />
          <text x="60" y="80" fill="rgba(255, 69, 0, 0.4)" fontSize="2" fontWeight="bold">ZONE À HAUT RISQUE</text>
        </svg>

        {/* Camera hotspot overlays */}
        {cameras.map((cam) => {
          const isSelected = cam.id === selectedCamId;
          return (
            <button
              key={cam.id}
              className={`camera-node ${cam.status} ${isSelected ? 'selected' : ''}`}
              style={{ left: `${cam.x}%`, top: `${cam.y}%` }}
              onClick={() => setSelectedCamId(cam.id)}
            >
              <span className="ping-ring" />
              <span className="dot-center">
                <CameraIcon size={12} className="node-icon" />
              </span>
              <span className="cam-label">{cam.name.split(' ')[0]}</span>
            </button>
          );
        })}

        {/* Selected Camera Details overlay (floating slide-up glassmorphic panel) */}
        {selectedCam && (
          <div className="camera-details-panel">
            <div className="panel-header">
              <h3>{selectedCam.name}</h3>
              <button className="panel-close-btn" onClick={() => setSelectedCamId(null)}>
                <XIcon size={16} />
              </button>
            </div>
            
            {/* Live Camera Stream Simulator */}
            <div className="panel-preview">
              {selectedCam.status === 'fire' ? (
                <div className="feed-fire-alert">
                  <div className="static-noise" />
                  <div className="alert-overlay">
                    <FlameIcon className="pulse" size={40} />
                    <span>ALERTE INCENDIE IN SITU</span>
                  </div>
                </div>
              ) : selectedCam.status === 'warn' ? (
                <div className="feed-warn-alert">
                  <div className="static-noise" />
                  <div className="alert-overlay">
                    <WarningIcon className="pulse" size={40} />
                    <span>DÉTECTION FUMÉE (61%)</span>
                  </div>
                </div>
              ) : (
                <div className="feed-normal">
                  <div className="scanline" />
                  <span className="feed-status-tag">EN DIRECT</span>
                </div>
              )}
              <div className="hud-overlay">
                <span>TEMP: {selectedCam.temp}°C</span>
                <span>BATT: {selectedCam.battery}%</span>
              </div>
            </div>

            <div className="panel-stats">
              <div className="stat-card">
                <span className="stat-label">Statut</span>
                {getStatusBadge(selectedCam.status)}
              </div>
              <div className="stat-card">
                <span className="stat-label">Température</span>
                <span className={`stat-value ${selectedCam.status}`}>{selectedCam.temp}°C</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Risque</span>
                <span className={`stat-value ${selectedCam.status}`}>{selectedCam.risk}%</span>
              </div>
            </div>

            <div className="panel-footer">
              <span className="gps-label">{selectedCam.coords} · {selectedCam.lastUpdate}</span>
              {selectedCam.status === 'fire' ? (
                <button className="btn btn-flame" onClick={() => navigate('/alertes')}>
                  DÉCLENCHER SECOURS
                </button>
              ) : (
                <button className="btn btn-dark" onClick={() => navigate('/scan')}>
                  SCAN MANUEL
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
