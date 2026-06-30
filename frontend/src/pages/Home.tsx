import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NearbyAlertBanner } from '../components/NearbyAlertBanner';
import { CheckCircleIcon, FlameIcon, ClockIcon, UsersIcon, ChevronRightIcon, MapIcon } from '../components/icons';
import { scanHistory, emergencyContacts, cameras, type ScanStatus } from '../services/mockData';
import { fetchZonesWeather, type WeatherZoneData, fetchForecast, type ZoneForecast } from '../services/weatherService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';
import './Home.css';
import './Analyses.css';

const statusMeta: Record<ScanStatus, { label: string; className: string; borderClass: string }> = {
  fire: { label: 'DANGER', className: 'badge-fire', borderClass: 'accent-danger' },
  safe: { label: 'SÛR', className: 'badge-safe', borderClass: 'accent-safe' },
  warn: { label: 'ALERTE', className: 'badge-warn', borderClass: 'accent-warn' },
};

const cameraDotColor: Record<'safe' | 'warn' | 'fire', string> = {
  safe: 'var(--safe)',
  warn: 'var(--warn)',
  fire: 'var(--danger)',
};

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [showAlert, setShowAlert] = useState(true);
  const [weather, setWeather] = useState<WeatherZoneData[]>([]);
  const [forecasts, setForecasts] = useState<ZoneForecast[]>([]);
  const [selectedCamId, setSelectedCamId] = useState<string>('cam-1');
  const [isLoadingForecast, setIsLoadingForecast] = useState(true);

  useEffect(() => {
    fetchZonesWeather().then(setWeather);
    const loadForecast = async () => {
      setIsLoadingForecast(true);
      const data = await fetchForecast();
      setForecasts(data);
      setIsLoadingForecast(false);
    };
    loadForecast();
  }, []);

  const activeForecast = forecasts.find(f => f.id === selectedCamId)?.forecast || [];

  const chartData = activeForecast.map(f => {
    const date = new Date(f.time);
    return {
      time: `${date.getHours()}h`,
      fullTime: date.toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' }),
      temp: f.temperature,
      risk: f.risk_percentage,
      wind: f.wind_speed,
      humidity: f.humidity
    };
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-faint)', marginBottom: '4px' }}>{payload[0].payload.fullTime}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ fontSize: '14px', fontWeight: 700, color: entry.color, margin: '2px 0' }}>
              {entry.name} : {entry.value}{entry.name === 'Risque' || entry.name === 'Humidité' ? '%' : entry.name === 'Température' ? '°C' : 'km/h'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const incidentsCount = scanHistory.filter((r) => r.status === 'fire').length;
  const recentScans = scanHistory.slice(0, 3);

  const getMarkerColor = (id: string) => {
    const w = weather.find(wd => wd.id === id);
    const status = w ? w.status : 'safe';
    if (status === 'fire') return 'var(--danger)';
    if (status === 'warn') return 'var(--warn)';
    return 'var(--safe)';
  };

  return (
    <div className="home-page">
      {showAlert && (
        <NearbyAlertBanner
          message="ALERTE À PROXIMITÉ — Incendie signalé à 2,3 km au nord de votre position"
          onClose={() => setShowAlert(false)}
        />
      )}

      <div className="page" style={{ paddingTop: 20 }}>
        <div className="home-header">
          <div>
            <h1 className="brand">FIRESHIELD</h1>
            <div className="status-row">
              <span className="status-dot" />
              <span className="status-text">SURVEILLANCE ACTIVE</span>
            </div>
          </div>
        </div>



        <button className="home-map-preview" onClick={() => navigate('/carte')}>
          <div style={{ height: '120px', width: '100%', position: 'relative' }}>
            <MapContainer 
              center={[48.6, 2.3]} 
              zoom={7} 
              style={{ width: '100%', height: '100%', background: '#1a1a1a', zIndex: 1 }}
              zoomControl={false}
              attributionControl={false}
              dragging={false}
              scrollWheelZoom={false}
              doubleClickZoom={false}
              touchZoom={false}
            >
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              <CircleMarker center={[48.8283, 2.4330]} radius={5} pathOptions={{ color: getMarkerColor('cam-1'), fillColor: getMarkerColor('cam-1'), fillOpacity: 1 }} />
              <CircleMarker center={[48.8624, 2.2492]} radius={5} pathOptions={{ color: getMarkerColor('cam-2'), fillColor: getMarkerColor('cam-2'), fillOpacity: 1 }} />
              <CircleMarker center={[48.4066, 2.6685]} radius={5} pathOptions={{ color: getMarkerColor('cam-3'), fillColor: getMarkerColor('cam-3'), fillOpacity: 1 }} />
              <CircleMarker center={[48.6644, 1.8156]} radius={5} pathOptions={{ color: getMarkerColor('cam-4'), fillColor: getMarkerColor('cam-4'), fillOpacity: 1 }} />
            </MapContainer>
            {/* Invisible overlay to ensure the button intercepts clicks over the map */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2 }}></div>
          </div>
          <div className="home-map-preview-info">
            <div className="home-map-preview-icon"><MapIcon size={16} /></div>
            <div className="home-map-preview-text">
              <strong>Réseau de surveillance</strong>
              <span>{cameras.length} caméras actives</span>
            </div>
            <ChevronRightIcon size={16} />
          </div>
        </button>

        <div className="home-section-header">
          <span className="home-section-title">ACTIVITÉ RÉCENTE</span>
          <button className="home-see-all" onClick={() => navigate('/historique')}>
            Tout voir
            <ChevronRightIcon size={14} />
          </button>
        </div>

        <div className="home-activity-list">
          {recentScans.map((r) => {
            const cam = cameras.find(c => c.name === r.location);
            const w = cam ? weather.find(wd => wd.id === cam.id) : null;
            // Override the mocked status with the REAL status calculated from Météo France
            const displayStatus = w ? w.status : r.status;

            return (
              <button
                className={`home-activity-item ${statusMeta[displayStatus].borderClass}`}
                key={r.id}
                onClick={() => navigate('/historique')}
              >
                <div className="home-activity-info">
                  <strong>{r.location}</strong>
                  <span>{r.date}</span>
                  {w && (
                    <span style={{ color: 'var(--text-faint)', marginTop: '4px', fontSize: '10.5px', fontWeight: 600 }}>
                      🌡️ {w.temperature}°C • 💨 {w.wind_speed}km/h • 💧 {w.humidity}%
                    </span>
                  )}
                </div>
                <span className={`badge ${statusMeta[displayStatus].className}`}>{statusMeta[displayStatus].label}</span>
              </button>
            );
          })}
        </div>

        <div className="home-section-header" style={{ marginTop: '30px' }}>
          <span className="home-section-title">PRÉVISIONS (H+48)</span>
        </div>

        <div className="zone-selector">
          {cameras.map(cam => (
            <button 
              key={cam.id} 
              className={`zone-btn ${selectedCamId === cam.id ? 'active' : ''}`}
              onClick={() => setSelectedCamId(cam.id)}
            >
              {cam.name}
            </button>
          ))}
        </div>

        {isLoadingForecast ? (
          <div style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: '20px' }}>Chargement des modèles IA météo...</div>
        ) : chartData.length > 0 ? (
          <>
            <div className="chart-container">
              <div className="chart-title">
                <FlameIcon size={16} /> Évolution du Risque Incendie
              </div>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="var(--danger)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="time" stroke="var(--text-faint)" fontSize={11} tickMargin={10} minTickGap={20} />
                    <YAxis stroke="var(--text-faint)" fontSize={11} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={80} stroke="var(--danger)" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'DANGER', fill: 'var(--danger)', fontSize: 10 }} />
                    <ReferenceLine y={50} stroke="var(--warn)" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'ALERTE', fill: 'var(--warn)', fontSize: 10 }} />
                    <Area type="monotone" name="Risque" dataKey="risk" stroke="var(--danger)" fillOpacity={1} fill="url(#colorRisk)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="chart-container">
              <div className="chart-title">
                🌡️ Température & Conditions
              </div>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ffaa00" stopOpacity={0.5}/>
                        <stop offset="95%" stopColor="#ffaa00" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorWind" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="time" stroke="var(--text-faint)" fontSize={11} tickMargin={10} minTickGap={20} />
                    <YAxis stroke="var(--text-faint)" fontSize={11} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" name="Température" dataKey="temp" stroke="#ffaa00" fillOpacity={1} fill="url(#colorTemp)" strokeWidth={2} />
                    <Area type="monotone" name="Vent" dataKey="wind" stroke="#3b82f6" fillOpacity={1} fill="url(#colorWind)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        ) : null}

      </div>
    </div>
  );
};
