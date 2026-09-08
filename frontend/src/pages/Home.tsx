import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlameIcon, ChevronRightIcon, MapIcon, MaximizeIcon, GalleryIcon } from '../components/icons';
import { VideoModal } from '../components/VideoModal';
import { fetchZonesWeather, type WeatherZoneData, fetchForecast, type ZoneForecast } from '../services/weatherService';
import { deviceService, type Device } from '../services/deviceService';
import { siteService, type Site } from '../services/siteService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';
import './Home.css';
import './Analyses.css';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [weather, setWeather] = useState<WeatherZoneData[]>([]);
  const [forecasts, setForecasts] = useState<ZoneForecast[]>([]);
  const [selectedCamId, setSelectedCamId] = useState<string>('cam-axis-1');
  const [isLoadingForecast, setIsLoadingForecast] = useState(true);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [pairedDevice, setPairedDevice] = useState<Device | null>(null);
  const [loadingDevices, setLoadingDevices] = useState<boolean>(true);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);

  useEffect(() => {
    deviceService.getMyDevices()
      .then(devs => {
        if (devs && devs.length > 0) {
          setPairedDevice(devs[0]);
        } else {
          setPairedDevice(null);
        }
      })
      .catch(() => {
        setPairedDevice(null);
      })
      .finally(() => {
        setLoadingDevices(false);
      });

    fetchZonesWeather().then(setWeather);
    siteService.getSites().then(s => {
      setSites(s);
      if (s.length > 0) {
        setSelectedSiteId(s[0].id);
        if (s[0].device) {
          deviceService.getMyDevices().then(devs => {
            const match = devs.find(d => d.id === s[0].device?.id);
            if (match) setPairedDevice(match);
          });
        }
      }
    }).catch(() => {});

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

  return (
    <div className="home-page">
    

      <div className="page" style={{ paddingTop: 20 }}>
        <div className="home-header">
          <div>
            <div className="status-row">
              <span className="status-dot" />
              <span className="status-text">SURVEILLANCE ACTIVE</span>
            </div>
          </div>
        </div>



        <button className="home-map-preview" onClick={() => navigate('/carte')}>
          <div style={{ height: '120px', width: '100%', position: 'relative' }}>
            <MapContainer 
              center={sites.length > 0 ? [sites[0].lat, sites[0].lng] : [46.2276, 2.2137]} 
              zoom={sites.length > 0 ? 8 : 7} 
              style={{ width: '100%', height: '100%', background: '#1a1a1a', zIndex: 1 }}
              zoomControl={false}
              attributionControl={false}
              dragging={false}
              scrollWheelZoom={false}
              doubleClickZoom={false}
              touchZoom={false}
            >
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              {sites.length > 0 ? (
                sites.map(s => (
                  <CircleMarker 
                    key={s.id} 
                    center={[s.lat, s.lng]} 
                    radius={6} 
                    pathOptions={{ 
                      color: s.device ? '#00cc66' : '#ffaa00', 
                      fillColor: s.device ? '#00cc66' : '#ffaa00', 
                      fillOpacity: 0.9 
                    }} 
                  />
                ))
              ) : (
                <CircleMarker center={[46.2276, 2.2137]} radius={5} pathOptions={{ color: 'var(--safe)', fillColor: 'var(--safe)', fillOpacity: 1 }} />
              )}
            </MapContainer>
            {/* Invisible overlay to ensure the button intercepts clicks over the map */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2 }}></div>
          </div>
          <div className="home-map-preview-info">
            <div className="home-map-preview-icon"><MapIcon size={16} /></div>
            <div className="home-map-preview-text">
              <strong>Réseau de surveillance</strong>
              <span>{sites.length > 0 ? `${sites.length} site(s) sur le plan` : 'Aucun site sur le plan'}</span>
            </div>
            <ChevronRightIcon size={16} />
          </div>
        </button>

        <div className="home-section-header">
          <span className="home-section-title">
            ACTIVITÉ RÉCENTE {sites.length > 0 ? `• SITES (${sites.length})` : ''}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              className="home-see-all" 
              onClick={() => navigate('/galerie')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: 'rgba(255, 69, 0, 0.12)',
                border: '1px solid rgba(255, 69, 0, 0.35)',
                color: 'var(--flame-start, #ff4400)',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              title="Voir les photos et captures de détection"
            >
              <GalleryIcon size={13} />
              <span>Galerie</span>
              <ChevronRightIcon size={12} />
            </button>
            <button className="home-see-all" onClick={() => navigate('/carte')}>
              {sites.length > 0 ? 'Plan' : 'Tout voir'}
              <ChevronRightIcon size={14} />
            </button>
          </div>
        </div>

        <div className="home-activity-list">
          {sites.length > 0 ? (
            sites.map((s) => {
              const hasDevice = Boolean(s.device);
              const w = weather.length > 0 ? weather[0] : null;

              return (
                <button
                  className={`home-activity-item ${hasDevice ? 'accent-safe' : 'accent-warn'}`}
                  key={s.id}
                  onClick={() => navigate(`/carte?site=${s.id}`)}
                  title={`Voir le site ${s.name} sur la carte`}
                >
                  <div className="home-activity-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '15px' }}>{hasDevice ? '📡' : '📍'}</span>
                      <strong style={{ fontSize: '14px', color: '#fff', letterSpacing: '-0.2px' }}>{s.name}</strong>
                      {hasDevice && (
                        <span style={{ 
                          fontSize: '10px', 
                          background: 'rgba(0, 204, 102, 0.15)', 
                          color: '#00cc66', 
                          padding: '1px 6px', 
                          borderRadius: '6px',
                          border: '1px solid rgba(0, 204, 102, 0.3)',
                          fontWeight: 700 
                        }}>
                          {s.device?.name || s.device?.device_id}
                        </span>
                      )}
                    </div>
                    <span>
                      {hasDevice 
                        ? `Surveillance continue active • Rayon : ${s.radius}m • [${s.lat.toFixed(3)}, ${s.lng.toFixed(3)}]` 
                        : `Site enregistré • Rayon : ${s.radius}m • En attente de caméra`}
                    </span>
                    {w && (
                      <span style={{ color: hasDevice ? 'var(--safe)' : 'var(--text-faint)', marginTop: '4px', fontSize: '10.5px', fontWeight: 600 }}>
                        🌡️ {w.temperature}°C • 💨 {w.wind_speed}km/h • 💧 {w.humidity}% • {hasDevice ? '🟢 Détection IA active' : '⚪ Capteur non appairé'}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                    <span className={`badge ${hasDevice ? 'badge-safe' : 'badge-warn'}`}>
                      {hasDevice ? 'EN DIRECT' : 'NON ÉQUIPÉ'}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      Plan <ChevronRightIcon size={12} />
                    </span>
                  </div>
                </button>
              );
            })
          ) : (
            <div style={{
              background: 'var(--surface)',
              border: '1px dashed var(--border)',
              borderRadius: '14px',
              padding: '24px 16px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '26px' }}>📍</span>
              <strong style={{ fontSize: '14px', color: '#fff' }}>Aucun site de surveillance configuré</strong>
              <p style={{ fontSize: '12px', color: 'var(--text-faint)', margin: '0 0 10px 0', maxWidth: '300px' }}>
                Ajoutez vos parcelles ou zones à surveiller sur la carte pour suivre leur activité en temps réel.
              </p>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '8px 16px' }}
                onClick={() => navigate('/carte')}
              >
                + Ajouter un site sur la carte
              </button>
            </div>
          )}
        </div>

        {/* Bouton raccourci direct vers la Galerie des photos de surveillance */}
        <div 
          onClick={() => navigate('/galerie')}
          style={{
            marginTop: '10px',
            background: 'linear-gradient(135deg, rgba(255,69,0,0.09) 0%, rgba(255,140,0,0.03) 100%)',
            border: '1px solid rgba(255,69,0,0.22)',
            borderRadius: '12px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '8px', 
              background: 'rgba(255,69,0,0.15)', 
              color: 'var(--flame-start, #ff4400)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <GalleryIcon size={16} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <strong style={{ fontSize: '12.5px', color: '#fff' }}>Galerie des photos capturées</strong>
              <span style={{ fontSize: '10.5px', color: 'var(--text-faint)' }}>Voir les snapshots de personnes et preuves en temps réel</span>
            </div>
          </div>
          <span style={{ 
            fontSize: '11px', 
            fontWeight: 700, 
            color: 'var(--flame-start, #ff4400)', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '3px' 
          }}>
            Galerie <ChevronRightIcon size={12} />
          </span>
        </div>

        <div className="home-section-header" style={{ marginTop: '30px' }}>
          <span className="home-section-title">SITES DE SURVEILLANCE ({sites.length})</span>
          <button className="home-see-all" onClick={() => navigate('/carte')}>
            Afficher sur le plan
            <ChevronRightIcon size={14} />
          </button>
        </div>

        <div className="zone-selector">
          {sites.length > 0 ? (
            sites.map((s) => (
              <button 
                key={s.id} 
                className={`zone-btn ${selectedSiteId === s.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedSiteId(s.id);
                  if (s.device) {
                    setPairedDevice({
                      id: s.device.id,
                      device_id: s.device.device_id,
                      name: s.device.name,
                      is_paired: true,
                      status: 'online'
                    });
                  } else {
                    setPairedDevice(null);
                  }
                }}
              >
                {s.device ? '📡 ' : '📍 '}{s.name}
              </button>
            ))
          ) : pairedDevice ? (
            <button 
              className="zone-btn active"
              onClick={() => setSelectedCamId(pairedDevice.device_id)}
            >
              {pairedDevice.name}
            </button>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--text-faint)', fontStyle: 'italic', padding: '4px 0' }}>
              Aucun site configuré
            </div>
          )}
          <button 
            className="zone-btn"
            style={{ borderStyle: 'dashed' }}
            onClick={() => navigate('/carte')}
          >
            + Gérer les sites
          </button>
        </div>

        {/* Flux vidéo de la caméra sélectionnée OU État Verrouillé */}
        {loadingDevices ? (
          <div style={{ 
            marginTop: '20px', 
            borderRadius: '14px', 
            background: 'var(--surface-2, #181820)', 
            height: '220px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'var(--text-faint)'
          }}>
            Vérification de vos équipements...
          </div>
        ) : !pairedDevice ? (
          <div 
            style={{ 
              marginTop: '20px', 
              borderRadius: '16px', 
              overflow: 'hidden', 
              border: '1px dashed #334155', 
              background: 'linear-gradient(145deg, #111118 0%, #171723 100%)', 
              padding: '28px 20px', 
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              position: 'relative'
            }}
          >
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              marginBottom: '12px',
              boxShadow: '0 0 16px rgba(239, 68, 68, 0.2)'
            }}>
              🔒
            </div>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '20px',
              padding: '4px 12px',
              fontSize: '10.5px',
              fontWeight: 800,
              color: '#f87171',
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
              marginBottom: '10px'
            }}>
              Accès Vidéo Verrouillé
            </div>

            <h3 style={{
              fontSize: '15px',
              fontWeight: 700,
              color: '#f8fafc',
              margin: '0 0 6px 0'
            }}>
              Aucun appareil connecté
            </h3>

            <p style={{
              fontSize: '12px',
              color: '#94a3b8',
              maxWidth: '320px',
              margin: '0 0 18px 0',
              lineHeight: '1.45'
            }}>
              Vous devez associer un Raspberry Pi à votre compte pour accéder au flux vidéo de télésurveillance et à la détection IA.
            </p>

            <button
              type="button"
              onClick={() => navigate('/pair')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#ff4400',
                backgroundImage: 'linear-gradient(135deg, #ff3300 0%, #ff5500 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 20px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(255, 51, 0, 0.35)',
                transition: 'all 0.2s ease'
              }}
            >
              <span>📡 Lier mon Raspberry Pi</span>
            </button>
          </div>
        ) : (
          <div 
            style={{ 
              marginTop: '20px', 
              borderRadius: '14px', 
              overflow: 'hidden', 
              border: '1px solid var(--border)', 
              background: '#000', 
              height: '240px', 
              position: 'relative', 
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              cursor: 'pointer'
            }}
            onClick={() => setIsVideoModalOpen(true)}
            title="Cliquer pour afficher la vidéo en grand"
          >
            <img 
              src={deviceService.getSecureStreamUrl(pairedDevice.device_id)} 
              alt="Flux en direct de la caméra" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {pairedDevice.tamper_status === 'tampered' ? (
              <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(220, 38, 38, 0.9)', padding: '5px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, color: '#fff', border: '1px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '6px', backdropFilter: 'blur(4px)', boxShadow: '0 0 15px rgba(220,38,38,0.6)' }}>
                <span className="live-dot" style={{ background: '#fff', width: '7px', height: '7px' }}></span>
                ⚠️ SABOTAGE DÉTECTÉ
              </div>
            ) : pairedDevice.status === 'offline' ? (
              <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(217, 119, 6, 0.9)', padding: '5px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, color: '#fff', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: '6px', backdropFilter: 'blur(4px)' }}>
                <span style={{ background: '#f59e0b', width: '7px', height: '7px', borderRadius: '50%' }}></span>
                🔴 SIGNAL PERDU (Dead Man's Switch)
              </div>
            ) : (
              <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(0,0,0,0.7)', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, color: 'var(--safe)', border: '1px solid rgba(0, 204, 102, 0.3)', display: 'flex', alignItems: 'center', gap: '6px', backdropFilter: 'blur(4px)' }}>
                <span className="status-dot" style={{ background: 'var(--safe)', width: '6px', height: '6px' }}></span>
                EN DIRECT {pairedDevice.cpu_temp ? `· ${pairedDevice.cpu_temp}°C` : ''}
              </div>
            )}

            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsVideoModalOpen(true);
              }}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11.5px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backdropFilter: 'blur(6px)',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                transition: 'all 0.2s ease'
              }}
              title="Agrandir la vidéo en plein écran"
            >
              <MaximizeIcon size={14} />
              <span>Agrandir</span>
            </button>
          </div>
        )}

        {pairedDevice && (
          <VideoModal
            isOpen={isVideoModalOpen}
            onClose={() => setIsVideoModalOpen(false)}
            streamUrl={deviceService.getSecureStreamUrl(pairedDevice.device_id)}
            cameraName={pairedDevice.name}
            statusText="Détection en direct YOLOv8 & v11 active"
          />
        )}

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
