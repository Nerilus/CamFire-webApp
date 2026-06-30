import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import { FlameIcon, WarningIcon, CheckCircleIcon, XIcon, RefreshIcon } from '../components/icons';
import { fetchZonesWeather } from '../services/weatherService';
import { WindOverlay } from '../components/WindOverlay';
import './Carte.css';

interface Camera {
  id: string;
  name: string;
  status: 'safe' | 'warn' | 'fire';
  temp: number;
  risk: number;
  battery: number;
  wind?: number;
  wind_direction?: number;
  humidity?: number;
  coords: string;
  lat: number;
  lng: number;
  perimeter: [number, number][];
  lastUpdate: string;
}

const initialCameras: Camera[] = [
  {
    id: 'cam-1',
    name: 'Bois de Vincennes (Paris Est)',
    status: 'fire',
    temp: 84,
    risk: 94,
    battery: 78,
    coords: '48.8283°N 2.4330°E',
    lat: 48.8283,
    lng: 2.4330,
    perimeter: [
      [48.835, 2.420], [48.840, 2.445], [48.832, 2.465], [48.818, 2.455], [48.820, 2.425]
    ],
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
    lat: 48.8624,
    lng: 2.2492,
    perimeter: [
      [48.875, 2.240], [48.878, 2.260], [48.855, 2.265], [48.845, 2.245], [48.855, 2.230]
    ],
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
    lat: 48.4066,
    lng: 2.6685,
    perimeter: [
      [48.45, 2.60], [48.46, 2.75], [48.35, 2.80], [48.32, 2.65], [48.38, 2.55]
    ],
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
    lat: 48.6644,
    lng: 1.8156,
    perimeter: [
      [48.72, 1.75], [48.74, 1.85], [48.65, 1.90], [48.60, 1.80], [48.62, 1.70]
    ],
    lastUpdate: 'Il y a 8 min',
  },
];

// Custom icons
const createIcon = (status: 'safe' | 'warn' | 'fire', isSelected: boolean, windDirection?: number) => {
  const color = status === 'fire' ? '#ff3300' : status === 'warn' ? '#ffaa00' : '#00cc66';
  const size = isSelected ? 24 : 16;
  const pulseHtml = isSelected && status === 'fire' 
    ? `<div style="position: absolute; top: 50%; left: 50%; width: 50px; height: 50px; transform: translate(-50%, -50%); border-radius: 50%; border: 2px solid ${color}; animation: pulse-ring 1.2s infinite;"></div>` 
    : '';
  
  // Arrow pointing in the wind direction
  // The arrow represents where the wind is going. If direction is 90 (East), the arrow should point right.
  // We use an SVG path of an arrow. By default, it points UP (0 degrees, North).
  const windHtml = windDirection !== undefined 
    ? `
      <div style="position: absolute; top: 50%; left: 50%; width: 40px; height: 40px; margin-top: -20px; margin-left: -20px; transform: rotate(${windDirection}deg); pointer-events: none; z-index: 1;">
        <svg viewBox="0 0 40 40" width="40" height="40" style="opacity: ${isSelected ? 0.9 : 0.6}">
          <path d="M20 4 L20 20 M20 4 L14 10 M20 4 L26 10" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        </svg>
      </div>
    ` : '';
  
  return L.divIcon({
    className: 'custom-leaflet-icon',
    html: `
      ${pulseHtml}
      ${windHtml}
      <div style="width: ${size}px; height: ${size}px; background-color: ${color}; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${color}; position: relative; z-index: 2; transition: all 0.3s ease;"></div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const MapController = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 11, { duration: 1.5 });
  }, [center, map]);
  return null;
};

export const Carte: React.FC = () => {
  const navigate = useNavigate();
  const [cameras, setCameras] = useState<Camera[]>(initialCameras);
  const [selectedCamId, setSelectedCamId] = useState<string | null>('cam-1');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showWind, setShowWind] = useState(true);

  useEffect(() => {
    const loadWeather = async () => {
      const weatherData = await fetchZonesWeather();
      if (weatherData && weatherData.length > 0) {
        setCameras(prev => prev.map(cam => {
          const w = weatherData.find(d => d.id === cam.id);
          if (w) {
            return {
              ...cam,
              temp: w.temperature,
              risk: w.risk_percentage,
              status: w.status,
              wind: w.wind_speed,
              wind_direction: w.wind_direction,
              humidity: w.humidity,
              lastUpdate: "À l'instant"
            };
          }
          return cam;
        }));
      }
    };
    loadWeather();
  }, []);

  const selectedCam = cameras.find((c) => c.id === selectedCamId);

  // Calculate average wind metrics to drive the global WindOverlay
  const avgWindSpeed = cameras.reduce((sum, cam) => sum + (cam.wind || 0), 0) / (cameras.length || 1);
  const avgWindDir = cameras.reduce((sum, cam) => sum + (cam.wind_direction || 0), 0) / (cameras.length || 1);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const weatherData = await fetchZonesWeather();
    if (weatherData && weatherData.length > 0) {
      setCameras(prev => prev.map(cam => {
        const w = weatherData.find(d => d.id === cam.id);
        if (w) {
          return {
            ...cam,
            temp: w.temperature,
            risk: w.risk_percentage,
            status: w.status,
            wind: w.wind_speed,
            wind_direction: w.wind_direction,
            humidity: w.humidity,
            lastUpdate: "À l'instant"
          };
        }
        return cam;
      }));
    }
    setIsRefreshing(false);
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
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={showWind} 
              onChange={(e) => setShowWind(e.target.checked)} 
              style={{ accentColor: 'var(--info)' }}
            />
            VENT
          </label>
          <button
            className={`carte-refresh-btn ${isRefreshing ? 'spinning' : ''}`}
            onClick={handleRefresh}
            aria-label="Rafraîchir les caméras"
          >
            <RefreshIcon size={20} />
          </button>
        </div>
      </div>

      <div className="map-container" style={{ position: 'relative' }}>
        {showWind && <WindOverlay windDirection={avgWindDir} windSpeed={avgWindSpeed} />}
        
        <MapContainer 
          center={selectedCam ? [selectedCam.lat, selectedCam.lng] : [46.2276, 2.2137]} 
          zoom={selectedCam ? 11 : 5} 
          style={{ width: '100%', height: '100%', background: '#1a1a1a', borderRadius: '16px' }}
          zoomControl={false}
          attributionControl={false}
        >
          {/* Tuiles sombres CARTO (très adaptées à une interface Sci-Fi / Cyber) */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {selectedCam && <MapController center={[selectedCam.lat, selectedCam.lng]} />}
          
          {cameras.map((cam) => {
            const isSelected = cam.id === selectedCamId;
            const polyColor = cam.status === 'fire' ? '#ff3300' : cam.status === 'warn' ? '#ffaa00' : '#00cc66';
            
            return (
              <React.Fragment key={cam.id}>
                {/* Surface area polygon */}
                <Polygon 
                  positions={cam.perimeter} 
                  pathOptions={{ 
                    color: polyColor, 
                    fillOpacity: isSelected ? 0.25 : 0.1,
                    weight: isSelected ? 3 : 1,
                    dashArray: isSelected ? undefined : '5, 5'
                  }} 
                  eventHandlers={{
                    click: () => setSelectedCamId(cam.id),
                  }}
                />
                {/* Camera Node Marker */}
                <Marker 
                  position={[cam.lat, cam.lng]} 
                  icon={createIcon(cam.status, isSelected, cam.wind_direction)}
                  eventHandlers={{
                    click: () => setSelectedCamId(cam.id),
                  }}
                />
              </React.Fragment>
            );
          })}
        </MapContainer>

        {/* Selected Camera Details overlay */}
        {selectedCam && (
          <div className="camera-details-panel" style={{ zIndex: 1000, position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', width: '90%' }}>
            <div className="panel-header">
              <h3>{selectedCam.name}</h3>
              <button className="panel-close-btn" onClick={() => setSelectedCamId(null)}>
                <XIcon size={16} />
              </button>
            </div>
            
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
                {selectedCam.wind !== undefined && <span>VENT: {selectedCam.wind}km/h {selectedCam.wind_direction !== undefined ? `(${selectedCam.wind_direction}deg)` : ''}</span>}
                {selectedCam.humidity !== undefined && <span>HUM: {selectedCam.humidity}%</span>}
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
