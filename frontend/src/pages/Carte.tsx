import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import { FlameIcon, WarningIcon, CheckCircleIcon, XIcon, RefreshIcon } from '../components/icons';
import { fetchZonesWeather } from '../services/weatherService';
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
    id: 'cam-axis-1',
    name: 'AXIS M1065-L (Locale)',
    status: 'safe',
    temp: 20,
    risk: 0,
    battery: 100,
    coords: '46.2276°N 2.2137°E',
    lat: 46.2276,
    lng: 2.2137,
    perimeter: [
      [46.25, 2.15], [46.30, 2.30], [46.15, 2.25], [46.10, 2.10], [46.20, 2.05]
    ],
    lastUpdate: 'En direct',
  }
];

// Custom icons
const createIcon = (status: 'safe' | 'warn' | 'fire', isSelected: boolean, windDirection?: number) => {
  const color = status === 'fire' ? '#ff3300' : status === 'warn' ? '#ffaa00' : '#00cc66';
  const size = isSelected ? 24 : 16;
  const pulseHtml = isSelected && status === 'fire' 
    ? `<div style="position: absolute; top: 50%; left: 50%; width: 50px; height: 50px; transform: translate(-50%, -50%); border-radius: 50%; border: 2px solid ${color}; animation: pulse-ring 1.2s infinite;"></div>` 
    : '';
  
  const windHtml = '';
  
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
  const [selectedCamId, setSelectedCamId] = useState<string | null>('cam-axis-1');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fireAlert, setFireAlert] = useState<{fire: boolean, confidence: number, timestamp: number} | null>(null);

  // Demander la permission pour les notifications au chargement
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Polling du statut de la caméra (toutes les 2 secondes)
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('http://localhost:8000/scan/status');
        if (res.ok) {
          const data = await res.json();
          setFireAlert(prev => {
            // Si on détecte un nouveau feu (timestamp différent ou passage de False à True)
            if (data.fire && (!prev || prev.timestamp !== data.timestamp)) {
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification("🔥 ALERTE INCENDIE", { 
                  body: `Feu/Fumée détectée ! (Confiance: ${data.confidence}%)`,
                  icon: '/favicon.ico' // Optionnel
                });
              }
            }
            return data;
          });
        }
      } catch (err) {
        // Ignorer les erreurs de réseau (ex: serveur éteint)
      }
    };
    
    const intervalId = setInterval(checkStatus, 2000);
    return () => clearInterval(intervalId);
  }, []);

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
        
        {/* Toast / Bannière visuelle d'alerte incendie */}
        {fireAlert && fireAlert.fire && (
          <div style={{
            position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
            backgroundColor: 'rgba(255, 51, 0, 0.9)', color: 'white', padding: '12px 24px',
            borderRadius: '8px', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '12px',
            boxShadow: '0 0 20px rgba(255, 51, 0, 0.6)', animation: 'pulse-ring 2s infinite',
            fontWeight: 'bold', letterSpacing: '1px', border: '1px solid #ffaa00'
          }}>
            <FlameIcon size={24} />
            <span>DÉTECTION EN COURS : FEU/FUMÉE ({fireAlert.confidence}%)</span>
          </div>
        )}

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
                <div className="feed-normal" style={{ overflow: 'hidden', padding: 0 }}>
                  <img 
                    src="http://localhost:8000/scan/stream" 
                    alt="Axis Camera Stream (AI Analyzed)" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                  <span className="feed-status-tag">EN DIRECT</span>
                </div>
              )}
              <div className="hud-overlay">
                <span>TEMP: {selectedCam.temp}°C</span>
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
