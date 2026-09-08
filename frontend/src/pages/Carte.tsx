import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Circle, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { FlameIcon, XIcon, RefreshIcon, MaximizeIcon, PinIcon, RadioIcon, ListIcon, FlashIcon, TrashIcon } from '../components/icons';
import { VideoModal } from '../components/VideoModal';
import { fetchZonesWeather } from '../services/weatherService';
import { deviceService, type Device } from '../services/deviceService';
import { siteService, type Site, type SiteCreateInput } from '../services/siteService';
import './Carte.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Custom Marker Icons for Sites
const createSiteIcon = (hasDevice: boolean, status: 'safe' | 'warn' | 'fire', isSelected: boolean) => {
  const color = !hasDevice ? '#94a3b8' : status === 'fire' ? '#ff3300' : status === 'warn' ? '#ffaa00' : '#00cc66';
  const size = isSelected ? 36 : 28;
  const pulseHtml = isSelected
    ? `<div style="position: absolute; top: 50%; left: 50%; width: 56px; height: 56px; transform: translate(-50%, -50%); border-radius: 50%; border: 2px solid ${color}; animation: pulse-ring 1.2s infinite;"></div>` 
    : '';
  
  const markerSvg = hasDevice
    ? `<svg width="${isSelected ? 16 : 12}" height="${isSelected ? 16 : 12}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.93 19.07A10 10 0 0 1 19.07 4.93M7.76 16.24a6 6 0 0 1 8.48-8.48M10.59 13.41a2 2 0 0 1 2.82-2.82"/><line x1="12" y1="12" x2="12.01" y2="12" stroke-width="3"/></svg>`
    : `<svg width="${isSelected ? 16 : 12}" height="${isSelected ? 16 : 12}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>`;
  
  return L.divIcon({
    className: 'custom-leaflet-icon',
    html: `
      ${pulseHtml}
      <div style="width: ${size}px; height: ${size}px; background-color: #111118; border: 2px solid ${color}; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px ${color}; position: relative; z-index: 2; transition: all 0.3s ease;">
        ${hasDevice ? `<span style="position: absolute; top: -2px; right: -2px; width: 8px; height: 8px; background: ${color}; border-radius: 50%; border: 1.5px solid #111118;"></span>` : ''}
        ${markerSvg}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const MapController = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 12, { duration: 1.5 });
  }, [center, map]);
  return null;
};

// Intercepteur de clics sur la carte pour définir les coordonnées d'un nouveau site
const MapClickHandler = ({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
};

export const Carte: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const siteUrlParam = searchParams.get('site');
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [pairedDevices, setPairedDevices] = useState<Device[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Modales
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isSitesListModalOpen, setIsSitesListModalOpen] = useState(false);

  // Formulaire d'ajout de site
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteDesc, setNewSiteDesc] = useState('');
  const [newSiteLat, setNewSiteLat] = useState<number>(46.2276);
  const [newSiteLng, setNewSiteLng] = useState<number>(2.2137);
  const [newSiteRadius, setNewSiteRadius] = useState<number>(500);
  const [newSiteDeviceId, setNewSiteDeviceId] = useState<number | null>(null);
  const [isSubmittingSite, setIsSubmittingSite] = useState(false);
  const [siteFormError, setSiteFormError] = useState<string | null>(null);

  // Sélecteur d'appareil pour association rapide
  const [selectedDeviceIdToAssign, setSelectedDeviceIdToAssign] = useState<number | ''>('');
  const [isAssigningDevice, setIsAssigningDevice] = useState(false);

  // Alertes et météo
  const [fireAlert, setFireAlert] = useState<{fire: boolean, confidence: number, timestamp: number} | null>(null);
  const [weatherRisk, setWeatherRisk] = useState<{temp: number, risk: number, humidity: number} | null>(null);

  // Chargement initial des sites et des appareils appairés
  const loadSitesAndDevices = async () => {
    try {
      const [userSites, myDevices] = await Promise.all([
        siteService.getSites().catch(() => []),
        deviceService.getMyDevices().catch(() => [])
      ]);

      setSites(userSites);
      setPairedDevices(myDevices);

      if (userSites.length > 0) {
        if (siteUrlParam) {
          const target = userSites.find(s => s.id === Number(siteUrlParam));
          setSelectedSiteId(target ? target.id : userSites[0].id);
        } else {
          setSelectedSiteId((prev) => (prev ? prev : userSites[0].id));
        }
      }

      if (myDevices.length > 0 && !newSiteDeviceId) {
        setNewSiteDeviceId(myDevices[0].id);
      }
    } catch (err) {
      console.error("Erreur chargement données:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadSitesAndDevices();
  }, []);

  useEffect(() => {
    if (siteUrlParam && sites.length > 0) {
      const target = sites.find(s => s.id === Number(siteUrlParam));
      if (target) {
        setSelectedSiteId(target.id);
      }
    }
  }, [siteUrlParam, sites]);

  // Polling du statut incendie IA
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/scan/status`);
        if (res.ok) {
          const data = await res.json();
          setFireAlert(prev => {
            if (data.fire && (!prev || prev.timestamp !== data.timestamp)) {
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification("ALERTE INCENDIE SUR SITE", { 
                  body: `Feu détecté par un Raspberry Pi ! (${data.confidence}%)`,
                  icon: '/favicon.ico'
                });
              }
            }
            return data;
          });
        }
      } catch (err) {
        // Ignorer si offline
      }
    };

    const intervalId = setInterval(checkStatus, 2000);
    return () => clearInterval(intervalId);
  }, []);

  // Chargement météo
  useEffect(() => {
    const loadWeather = async () => {
      const weatherData = await fetchZonesWeather();
      if (weatherData && weatherData.length > 0) {
        setWeatherRisk({
          temp: weatherData[0].temperature,
          risk: weatherData[0].risk_percentage,
          humidity: weatherData[0].humidity
        });
      }
    };
    loadWeather();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadSitesAndDevices();
    setIsRefreshing(false);
  };

  // Clic sur la carte pour définir l'emplacement d'un site
  const handleMapClick = (lat: number, lng: number) => {
    setNewSiteLat(parseFloat(lat.toFixed(5)));
    setNewSiteLng(parseFloat(lng.toFixed(5)));
    setIsAddModalOpen(true);
  };

  // Création d'un nouveau site
  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteName.trim()) {
      setSiteFormError("Veuillez renseigner un nom pour le site.");
      return;
    }

    setSiteFormError(null);
    setIsSubmittingSite(true);
    try {
      const payload: SiteCreateInput = {
        name: newSiteName.trim(),
        description: newSiteDesc.trim() || undefined,
        lat: newSiteLat,
        lng: newSiteLng,
        radius: newSiteRadius,
        device_id: newSiteDeviceId || undefined
      };

      const created = await siteService.createSite(payload);
      setSites(prev => [created, ...prev]);
      setSelectedSiteId(created.id);
      setIsAddModalOpen(false);
      setNewSiteName('');
      setNewSiteDesc('');
    } catch (err: any) {
      setSiteFormError(err.message || "Erreur lors de la création du site.");
    } finally {
      setIsSubmittingSite(false);
    }
  };

  // Amorçage rapide 1-clic : Créer un site pour le Raspberry Pi connecté
  const handleQuickCreateSiteForDevice = async (device: Device) => {
    try {
      const payload: SiteCreateInput = {
        name: `Site ${device.name}`,
        description: `Zone de surveillance principale équipée du Raspberry Pi 4 (${device.device_id})`,
        lat: device.lat || 46.2276,
        lng: device.lng || 2.2137,
        radius: 500,
        device_id: device.id
      };
      const created = await siteService.createSite(payload);
      setSites(prev => [created, ...prev]);
      setSelectedSiteId(created.id);
    } catch (err: any) {
      alert("Erreur: " + err.message);
    }
  };

  // Association d'un Raspberry Pi à un site existant
  const handleAssignDeviceToSite = async () => {
    if (!selectedSiteId) return;
    setIsAssigningDevice(true);
    try {
      const devId = selectedDeviceIdToAssign === '' ? null : Number(selectedDeviceIdToAssign);
      const updated = await siteService.assignDevice(selectedSiteId, devId);
      setSites(prev => prev.map(s => s.id === updated.id ? updated : s));
      setIsAssignModalOpen(false);
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'association.");
    } finally {
      setIsAssigningDevice(false);
    }
  };

  // Suppression d'un site
  const handleDeleteSite = async (siteId: number) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce site du plan ?")) return;
    try {
      await siteService.deleteSite(siteId);
      setSites(prev => prev.filter(s => s.id !== siteId));
      if (selectedSiteId === siteId) {
        setSelectedSiteId(null);
      }
    } catch (err: any) {
      alert(err.message || "Erreur lors de la suppression.");
    }
  };

  const selectedSite = sites.find(s => s.id === selectedSiteId);

  return (
    <div className="carte-page">
      {/* En-tête de la page */}
      <div className="carte-header">
        <div>
          <h1 className="carte-title">SITES SUR LE PLAN</h1>
          <p className="carte-subtitle">
            {loadingData
              ? 'Chargement des sites...'
              : `${sites.length} site${sites.length > 1 ? 's' : ''} sur le plan · ${pairedDevices.length} Raspberry Pi`}
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {sites.length > 0 && (
            <button
              onClick={() => setIsSitesListModalOpen(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                color: '#f8fafc',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '10px',
                padding: '9px 14px',
                fontWeight: 600,
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              title="Ouvrir la liste complète de tous vos sites"
            >
              <ListIcon size={14} />
              <span>Afficher les sites ({sites.length})</span>
            </button>
          )}

          <button
            onClick={() => {
              setNewSiteLat(46.2276);
              setNewSiteLng(2.2137);
              setIsAddModalOpen(true);
            }}
            style={{
              background: 'linear-gradient(135deg, #ff3300 0%, #ff5500 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '9px 16px',
              fontWeight: 700,
              fontSize: '12.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(255, 51, 0, 0.4)'
            }}
          >
            <span>+ Ajouter un site</span>
          </button>

          <button
            className={`carte-refresh-btn ${isRefreshing ? 'spinning' : ''}`}
            onClick={handleRefresh}
            aria-label="Rafraîchir les sites"
          >
            <RefreshIcon size={18} />
          </button>
        </div>
      </div>

      {/* Barre de défilement horizontal des Sites (Chips cliquables) */}
      {sites.length > 0 && (
        <div className="sites-horizontal-bar">
          {sites.map((site) => {
            const isSelected = site.id === selectedSiteId;
            const hasDev = Boolean(site.device_id && site.device);
            return (
              <button
                key={site.id}
                className={`site-chip ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedSiteId(site.id)}
                title={`Afficher ${site.name} sur le plan`}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  {hasDev ? <RadioIcon size={13} /> : <PinIcon size={13} />}
                </span>
                <strong>{site.name}</strong>
                {hasDev && <span className="chip-live-dot" title="Équipé d'un Raspberry Pi" />}
              </button>
            );
          })}
          <button
            className="site-chip add-chip"
            onClick={() => {
              setNewSiteLat(46.2276);
              setNewSiteLng(2.2137);
              setIsAddModalOpen(true);
            }}
          >
            + Nouveau site
          </button>
        </div>
      )}

      {/* Conteneur de la Carte Leaflet */}
      <div className="map-container" style={{ position: 'relative' }}>
        
        {/* Bannière Alerte Incendie */}
        {fireAlert && fireAlert.fire && (
          <div style={{
            position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)',
            backgroundColor: 'rgba(255, 51, 0, 0.95)', color: 'white', padding: '10px 20px',
            borderRadius: '10px', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '10px',
            boxShadow: '0 0 24px rgba(255, 51, 0, 0.7)', animation: 'pulse-ring 2s infinite',
            fontWeight: 'bold', fontSize: '13px', letterSpacing: '0.5px', border: '1px solid #ffaa00'
          }}>
            <FlameIcon size={20} />
            <span>ALERTE INCENDIE IN SITU ({fireAlert.confidence}%)</span>
          </div>
        )}

        {/* État vide : Aucun site sur le plan */}
        {!loadingData && sites.length === 0 && (
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 68, 0, 0.35)',
            borderRadius: '16px',
            padding: '24px 26px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            maxWidth: '400px',
            width: '90%'
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px', color: '#ff4400' }}>
              <PinIcon size={32} />
            </div>
            <div style={{ fontWeight: 800, fontSize: '16px', color: '#f8fafc', letterSpacing: '0.5px' }}>
              AUCUN SITE SUR LE PLAN
            </div>
            <p style={{ color: '#94a3b8', fontSize: '12px', margin: '8px 0 18px', lineHeight: '1.45' }}>
              Positionnez un site sur la carte pour délimiter votre périmètre de surveillance et y associer votre Raspberry Pi.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              {pairedDevices.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleQuickCreateSiteForDevice(pairedDevices[0])}
                  style={{
                    background: 'linear-gradient(135deg, #00cc66 0%, #10b981 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '11px 16px',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <FlashIcon size={14} />
                  <span>Créer un site pour {pairedDevices[0].name}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                style={{
                  background: 'linear-gradient(135deg, #ff3300 0%, #ff5500 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '11px 16px',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(255, 51, 0, 0.35)'
                }}
              >
                + Définir un site manuellement
              </button>
            </div>
          </div>
        )}

        <MapContainer 
          center={selectedSite ? [selectedSite.lat, selectedSite.lng] : [46.2276, 2.2137]} 
          zoom={selectedSite ? 13 : 6} 
          style={{ width: '100%', height: '100%', background: '#1a1a1a', borderRadius: '16px' }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <MapClickHandler onMapClick={handleMapClick} />
          {selectedSite && <MapController center={[selectedSite.lat, selectedSite.lng]} />}
          
          {sites.map((site) => {
            const isSelected = site.id === selectedSiteId;
            const hasDev = Boolean(site.device_id && site.device);
            const status: 'safe' | 'warn' | 'fire' = fireAlert?.fire ? 'fire' : 'safe';
            const color = !hasDev ? '#94a3b8' : status === 'fire' ? '#ff3300' : '#00cc66';

            return (
              <React.Fragment key={site.id}>
                {/* Périmètre circulaire du site sur le plan */}
                <Circle
                  center={[site.lat, site.lng]}
                  radius={site.radius || 500}
                  pathOptions={{
                    color: color,
                    fillColor: color,
                    fillOpacity: isSelected ? 0.22 : 0.08,
                    weight: isSelected ? 3 : 1.5,
                    dashArray: hasDev ? undefined : '6, 6'
                  }}
                  eventHandlers={{
                    click: () => setSelectedSiteId(site.id)
                  }}
                />

                {/* Marqueur du site */}
                <Marker
                  position={[site.lat, site.lng]}
                  icon={createSiteIcon(hasDev, status, isSelected)}
                  eventHandlers={{
                    click: () => setSelectedSiteId(site.id)
                  }}
                >
                  <Tooltip permanent direction="top" offset={[0, -18]} className="site-leaflet-tooltip">
                    <span>{site.name}</span>
                  </Tooltip>
                </Marker>
              </React.Fragment>
            );
          })}
        </MapContainer>

        {/* Panneau Détails du Site Sélectionné */}
        {selectedSite && (
          <div className="camera-details-panel" style={{ zIndex: 1000, position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', width: '92%', maxWidth: '520px' }}>
            <div className="panel-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {selectedSite.name}
                  {selectedSite.device ? (
                    <span style={{ fontSize: '11px', background: 'rgba(0, 204, 102, 0.15)', color: '#00cc66', border: '1px solid rgba(0, 204, 102, 0.3)', padding: '2px 8px', borderRadius: '12px' }}>
                      Équipé
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.3)', padding: '2px 8px', borderRadius: '12px' }}>
                      Non équipé
                    </span>
                  )}
                </h3>
                {selectedSite.description && (
                  <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#94a3b8' }}>{selectedSite.description}</p>
                )}
              </div>
              <button className="panel-close-btn" onClick={() => setSelectedSiteId(null)}>
                <XIcon size={16} />
              </button>
            </div>
            
            {/* Aperçu Vidéo ou Invitation à associer un Raspberry Pi */}
            <div className="panel-preview">
              {selectedSite.device ? (
                <div 
                  className="feed-normal" 
                  style={{ overflow: 'hidden', padding: 0, position: 'relative', cursor: 'pointer', height: '180px' }}
                  onClick={() => setIsVideoModalOpen(true)}
                  title="Agrandir le flux vidéo de ce site"
                >
                  <img 
                    src={deviceService.getSecureStreamUrl(selectedSite.device.device_id)} 
                    alt="Flux en direct du site" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                  <span className="feed-status-tag">EN DIRECT</span>
                  <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.7)', padding: '4px 8px', borderRadius: '6px', fontSize: '10.5px', color: '#fff' }}>
                    {selectedSite.device.name}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsVideoModalOpen(true);
                    }}
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      background: 'rgba(15, 23, 42, 0.85)',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      color: '#fff',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      backdropFilter: 'blur(6px)',
                      cursor: 'pointer',
                      zIndex: 5
                    }}
                  >
                    <MaximizeIcon size={13} />
                    <span>Agrandir</span>
                  </button>
                </div>
              ) : (
                <div 
                  style={{ 
                    height: '180px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    background: '#09090e', 
                    border: '1px dashed #334155', 
                    borderRadius: '10px', 
                    padding: '16px', 
                    textAlign: 'center' 
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px', color: '#94a3b8' }}>
                    <RadioIcon size={28} />
                  </div>
                  <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '13px' }}>SITE NON ÉQUIPÉ DE RASPBERRY PI</div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px', maxWidth: '280px' }}>
                    Associez l'un de vos Raspberry Pi pour activer la télésurveillance et la vidéo en direct sur ce site.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDeviceIdToAssign(pairedDevices.length > 0 ? pairedDevices[0].id : '');
                      setIsAssignModalOpen(true);
                    }}
                    style={{
                      marginTop: '12px',
                      background: 'linear-gradient(135deg, #ff3300 0%, #ff5500 100%)',
                      border: 'none',
                      color: '#fff',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(255, 51, 0, 0.3)'
                    }}
                  >
                    + Associer un Raspberry Pi
                  </button>
                </div>
              )}
            </div>

            {/* Statistiques et Météo du site */}
            <div className="panel-stats">
              <div className="stat-card">
                <span className="stat-label">Équipement</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: selectedSite.device ? '#00cc66' : '#94a3b8' }}>
                  {selectedSite.device ? selectedSite.device.name : 'Aucun'}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Périmètre</span>
                <span className="stat-value safe">{selectedSite.radius}m</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Risque local</span>
                <span className="stat-value safe">{weatherRisk ? `${weatherRisk.risk}%` : '0%'}</span>
              </div>
            </div>

            {/* Barre d'action inférieure du site */}
            <div className="panel-footer">
              <span className="gps-label">
                {selectedSite.lat.toFixed(4)}°N, {selectedSite.lng.toFixed(4)}°E
              </span>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn btn-dark"
                  onClick={() => {
                    setSelectedDeviceIdToAssign(selectedSite.device_id || (pairedDevices.length > 0 ? pairedDevices[0].id : ''));
                    setIsAssignModalOpen(true);
                  }}
                  title="Changer le Raspberry Pi associé"
                >
                  {selectedSite.device ? "Changer d'appareil" : "Associer"}
                </button>

                <button 
                  className="btn"
                  style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                  onClick={() => handleDeleteSite(selectedSite.id)}
                  title="Supprimer ce site du plan"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODALE : Ajouter un nouveau site sur le plan */}
      {isAddModalOpen && (
        <div className="site-modal-backdrop" onClick={() => setIsAddModalOpen(false)}>
          <div className="site-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="site-modal-header">
              <div className="site-modal-title">
                <PinIcon size={18} />
                <span>Nouveau Site de Surveillance</span>
              </div>
              <button className="panel-close-btn" onClick={() => setIsAddModalOpen(false)}>
                <XIcon size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSite} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="site-input-group">
                <label className="site-input-label">Nom du site / Parcelle</label>
                <input
                  type="text"
                  className="site-input"
                  placeholder="Ex: Forêt des Maures - Secteur Sud"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  required
                />
              </div>

              <div className="site-input-group">
                <label className="site-input-label">Description (optionnelle)</label>
                <input
                  type="text"
                  className="site-input"
                  placeholder="Ex: Parcelle de résineux à risque élevé"
                  value={newSiteDesc}
                  onChange={(e) => setNewSiteDesc(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div className="site-input-group" style={{ flex: 1 }}>
                  <label className="site-input-label">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    className="site-input"
                    value={newSiteLat}
                    onChange={(e) => setNewSiteLat(parseFloat(e.target.value))}
                    required
                  />
                </div>
                <div className="site-input-group" style={{ flex: 1 }}>
                  <label className="site-input-label">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    className="site-input"
                    value={newSiteLng}
                    onChange={(e) => setNewSiteLng(parseFloat(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="site-input-group">
                <label className="site-input-label">Rayon de surveillance (mètres)</label>
                <div className="site-radius-selector">
                  {[250, 500, 1000, 2000].map(r => (
                    <button
                      key={r}
                      type="button"
                      className={`site-radius-btn ${newSiteRadius === r ? 'active' : ''}`}
                      onClick={() => setNewSiteRadius(r)}
                    >
                      {r}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Sélecteur de Raspberry Pi */}
              <div className="site-input-group">
                <label className="site-input-label">Associer un Raspberry Pi 4</label>
                {pairedDevices.length > 0 ? (
                  <select
                    className="site-input"
                    value={newSiteDeviceId || ''}
                    onChange={(e) => setNewSiteDeviceId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">-- Aucun (Associer plus tard) --</option>
                    {pairedDevices.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.device_id})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', background: '#0d0d14', padding: '10px 12px', borderRadius: '8px', border: '1px solid #28283a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Aucun Raspberry Pi lié.</span>
                    <button type="button" onClick={() => navigate('/pair')} style={{ color: '#ff5500', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '11.5px' }}>
                      Lier un appareil →
                    </button>
                  </div>
                )}
              </div>

              {siteFormError && (
                <div style={{ color: '#f87171', fontSize: '12px', background: 'rgba(239, 68, 68, 0.1)', padding: '8px 12px', borderRadius: '8px' }}>
                  {siteFormError}
                </div>
              )}

              <div className="site-modal-actions">
                <button type="button" className="site-btn-cancel" onClick={() => setIsAddModalOpen(false)}>
                  Annuler
                </button>
                <button type="submit" className="site-btn-submit" disabled={isSubmittingSite}>
                  {isSubmittingSite ? 'Création en cours...' : 'Placer le site sur le plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE : Associer ou Changer le Raspberry Pi du site */}
      {isAssignModalOpen && selectedSite && (
        <div className="site-modal-backdrop" onClick={() => setIsAssignModalOpen(false)}>
          <div className="site-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="site-modal-header">
              <div className="site-modal-title">
                <RadioIcon size={18} />
                <span>Associer un Raspberry Pi</span>
              </div>
              <button className="panel-close-btn" onClick={() => setIsAssignModalOpen(false)}>
                <XIcon size={16} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
              Sélectionnez l'équipement matériel qui assurera la surveillance du site <strong>{selectedSite.name}</strong> :
            </p>

            <div className="site-input-group">
              <label className="site-input-label">Appareil Raspberry Pi</label>
              {pairedDevices.length > 0 ? (
                <select
                  className="site-input"
                  value={selectedDeviceIdToAssign}
                  onChange={(e) => setSelectedDeviceIdToAssign(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">-- Dissocier (Aucun équipement) --</option>
                  {pairedDevices.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.device_id})
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ padding: '12px', background: '#0d0d14', borderRadius: '10px', color: '#94a3b8', fontSize: '12px' }}>
                  Vous n'avez aucun Raspberry Pi associé à votre compte.
                </div>
              )}
            </div>

            <div className="site-modal-actions">
              <button type="button" className="site-btn-cancel" onClick={() => setIsAssignModalOpen(false)}>
                Fermer
              </button>
              <button
                type="button"
                className="site-btn-submit"
                disabled={isAssigningDevice}
                onClick={handleAssignDeviceToSite}
              >
                {isAssigningDevice ? 'Enregistrement...' : 'Valider l\'association'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE : Afficher la liste complète des sites */}
      {isSitesListModalOpen && (
        <div className="site-modal-backdrop" onClick={() => setIsSitesListModalOpen(false)}>
          <div className="site-modal-card" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
            <div className="site-modal-header">
              <div className="site-modal-title">
                <ListIcon size={18} />
                <span>Vos Sites de Surveillance ({sites.length})</span>
              </div>
              <button className="panel-close-btn" onClick={() => setIsSitesListModalOpen(false)}>
                <XIcon size={16} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
              Consultez vos sites répertoriés sur le plan, vérifiez leur équipement Raspberry Pi et accédez à leur flux direct :
            </p>

            <div className="sites-list-container">
              {sites.map((site) => {
                const isSelected = site.id === selectedSiteId;
                const hasDev = Boolean(site.device_id && site.device);

                return (
                  <div
                    key={site.id}
                    className={`site-card-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedSiteId(site.id);
                      setIsSitesListModalOpen(false);
                    }}
                  >
                    <div className="site-card-info">
                      <div className="site-card-name">
                        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                          {hasDev ? <RadioIcon size={14} /> : <PinIcon size={14} />}
                        </span>
                        <span>{site.name}</span>
                        {hasDev && <span className="chip-live-dot" title="Flux vidéo en direct actif" />}
                      </div>

                      <div className="site-card-meta">
                        {site.lat.toFixed(4)}°N, {site.lng.toFixed(4)}°E · Rayon {site.radius}m
                      </div>

                      <div style={{ marginTop: '4px' }}>
                        {hasDev ? (
                          <span style={{
                            fontSize: '11px',
                            background: 'rgba(0, 204, 102, 0.15)',
                            color: '#00cc66',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontWeight: 700
                          }}>
                            Équipé : {site.device?.name || site.device?.device_id}
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '11px',
                            background: 'rgba(148, 163, 184, 0.12)',
                            color: '#94a3b8',
                            padding: '2px 8px',
                            borderRadius: '6px'
                          }}>
                            Non équipé
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="site-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDeviceIdToAssign(site.device_id || '');
                          setSelectedSiteId(site.id);
                          setIsSitesListModalOpen(false);
                          setIsAssignModalOpen(true);
                        }}
                        style={{
                          background: hasDev ? 'rgba(0, 204, 102, 0.15)' : 'rgba(255, 68, 0, 0.15)',
                          color: hasDev ? '#00cc66' : '#ff5500',
                          border: `1px solid ${hasDev ? 'rgba(0, 204, 102, 0.3)' : 'rgba(255, 68, 0, 0.3)'}`,
                          borderRadius: '8px',
                          padding: '7px 12px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {hasDev ? 'Gérer caméra' : '+ Lier caméra'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSite(site.id)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.12)',
                          color: '#f87171',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          borderRadius: '8px',
                          padding: '7px 10px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Supprimer ce site"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="site-modal-actions">
              <button
                type="button"
                className="site-btn-submit"
                onClick={() => {
                  setIsSitesListModalOpen(false);
                  setIsAddModalOpen(true);
                }}
              >
                + Ajouter un nouveau site
              </button>
              <button type="button" className="site-btn-cancel" onClick={() => setIsSitesListModalOpen(false)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Plein Écran pour la Vidéo */}
      {selectedSite?.device && (
        <VideoModal
          isOpen={isVideoModalOpen}
          onClose={() => setIsVideoModalOpen(false)}
          streamUrl={deviceService.getSecureStreamUrl(selectedSite.device.device_id)}
          cameraName={`${selectedSite.name} · ${selectedSite.device.name}`}
          statusText="Surveillance IA continue YOLOv8 & v11"
        />
      )}
    </div>
  );
};
