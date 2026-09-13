import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Circle, Polygon, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { 
  FlameIcon, XIcon, RefreshIcon, MaximizeIcon, PinIcon, RadioIcon, ListIcon, 
  FlashIcon, TrashIcon, GpsIcon, PlusIcon, GlobeIcon, WindIcon, DropletIcon, 
  PhoneIcon, CopyIcon, CheckCircleIcon 
} from '../components/icons';
import { VideoModal } from '../components/VideoModal';
import { DeviceLiveControls } from '../components/DeviceLiveControls';
import { fetchZonesWeather } from '../services/weatherService';
import { deviceService, type Device } from '../services/deviceService';
import { siteService, type Site, type SiteCreateInput, type TacticalPoint } from '../services/siteService';
import './Carte.css';

import { API_URL } from '../config/api';

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

// Marqueurs tactiques DFCI (Cuves, Poteaux incendie, Bassins, Accès, Barrières)
const createTacticalIcon = (type: string) => {
  let color = '#0284c7';
  let svg = `<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>`;
  if (type === 'hydrant') {
    color = '#ef4444';
    svg = `<path d="M5 12h14M12 5v14M8 5h8M7 19h10"/>`;
  } else if (type === 'pool') {
    color = '#06b6d4';
    svg = `<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>`;
  } else if (type === 'access_path') {
    color = '#10b981';
    svg = `<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>`;
  } else if (type === 'gate') {
    color = '#f59e0b';
    svg = `<path d="M4 10h16M4 14h16M7 6v12M17 6v12"/>`;
  }

  return L.divIcon({
    className: 'custom-leaflet-tactical-icon',
    html: `
      <div style="width: 28px; height: 28px; background-color: #0d1117; border: 2px solid ${color}; border-radius: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px ${color}88; position: relative;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          ${svg}
        </svg>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

// Conversion coordonnées décimales en DMS sexagésimal (norme pompiers SDIS)
function toDMS(coordinate: number, type: 'lat' | 'lng'): string {
  const absolute = Math.abs(coordinate);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = Math.floor((minutesNotTruncated - minutes) * 60);
  const direction = type === 'lat' ? (coordinate >= 0 ? 'N' : 'S') : (coordinate >= 0 ? 'E' : 'O');
  return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
}

// Calcul mathématique du cône de propagation sous le vent
function computeWindCone(lat: number, lng: number, windDirectionDeg: number, distanceMeters: number, apertureDeg = 46): [number, number][] {
  const downwind = (windDirectionDeg + 180) % 360;
  const startAngle = downwind - apertureDeg / 2;
  const endAngle = downwind + apertureDeg / 2;
  const points: [number, number][] = [[lat, lng]];

  const R = 6371000;
  const latRad = (lat * Math.PI) / 180;
  const numSteps = 7;
  for (let i = 0; i <= numSteps; i++) {
    const angle = startAngle + (i * (endAngle - startAngle)) / numSteps;
    const angleRad = (angle * Math.PI) / 180;
    const dLat = (distanceMeters * Math.cos(angleRad)) / R;
    const dLng = (distanceMeters * Math.sin(angleRad)) / (R * Math.cos(latRad));
    const pLat = lat + (dLat * 180) / Math.PI;
    const pLng = lng + (dLng * 180) / Math.PI;
    points.push([pLat, pLng]);
  }
  points.push([lat, lng]);
  return points;
}

// Marqueur de position de l'utilisateur (GPS)
const createUserLocationIcon = () => {
  return L.divIcon({
    className: 'custom-leaflet-user-icon',
    html: `
      <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; top: 0; left: 0; width: 28px; height: 28px; border-radius: 50%; background: rgba(59, 130, 246, 0.4); animation: pulse-ring 1.5s infinite;"></div>
        <div style="width: 14px; height: 14px; border-radius: 50%; background: #2563eb; border: 2.5px solid #ffffff; box-shadow: 0 0 12px rgba(37, 99, 235, 0.9); position: relative; z-index: 2;"></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

const MapController = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 13, { duration: 1.4 });
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
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
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
  const [newSiteRadius, setNewSiteRadius] = useState<number>(300);
  const [newSiteDeviceId, setNewSiteDeviceId] = useState<number | null>(null);
  const [isSubmittingSite, setIsSubmittingSite] = useState(false);
  const [siteFormError, setSiteFormError] = useState<string | null>(null);

  // Géolocalisation GPS (Téléphone / Ordinateur)
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsSuccess, setGpsSuccess] = useState(false);

  // Type de fond de carte (Sombre ou Satellite) - Aucun API Key requis
  const [mapLayer, setMapLayer] = useState<'dark' | 'satellite'>('dark');

  // Localisation GPS de l'appareil (Téléphone ou Ordinateur)
  const handleLocateUser = (forNewSite: boolean = false) => {
    if (!navigator.geolocation) {
      setGpsError("La géolocalisation GPS n'est pas supportée par votre navigateur.");
      return;
    }

    setIsLocating(true);
    setGpsError(null);
    setGpsSuccess(false);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = parseFloat(position.coords.latitude.toFixed(5));
        const lng = parseFloat(position.coords.longitude.toFixed(5));
        const acc = Math.round(position.coords.accuracy);

        setUserPosition([lat, lng]);
        setGpsAccuracy(acc);
        setGpsSuccess(true);
        setIsLocating(false);

        if (forNewSite || isAddModalOpen) {
          setNewSiteLat(lat);
          setNewSiteLng(lng);
        }
      },
      (error) => {
        setIsLocating(false);
        let msg = "Impossible d'obtenir votre position GPS.";
        if (error.code === error.PERMISSION_DENIED) {
          msg = "Autorisation GPS refusée. Veuillez autoriser la géolocalisation dans les réglages de votre navigateur.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = "Signal GPS indisponible. Vérifiez que la localisation est activée sur votre appareil.";
        } else if (error.code === error.TIMEOUT) {
          msg = "Délai de géolocalisation dépassé. Veuillez réessayer.";
        }
        setGpsError(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  };

  // Sélecteur d'appareil pour association rapide
  const [selectedDeviceIdToAssign, setSelectedDeviceIdToAssign] = useState<number | ''>('');
  const [isAssigningDevice, setIsAssigningDevice] = useState(false);

  // Alertes et météo enrichie (Vent & Direction)
  const [fireAlert, setFireAlert] = useState<{fire: boolean, confidence: number, timestamp: number} | null>(null);
  const [weatherRisk, setWeatherRisk] = useState<{
    temp: number;
    risk: number;
    humidity: number;
    wind_speed: number;
    wind_direction: number;
  } | null>(null);

  // Points d'Intérêt Tactiques DFCI (Cuves, Poteaux, Accès, Barrières)
  const [tacticalPoints, setTacticalPoints] = useState<TacticalPoint[]>([]);
  const [showTacticalPoints, setShowTacticalPoints] = useState(true);
  const [isAddTacticalModalOpen, setIsAddTacticalModalOpen] = useState(false);
  const [newPtName, setNewPtName] = useState('');
  const [newPtType, setNewPtType] = useState<'water_tank' | 'hydrant' | 'pool' | 'access_path' | 'gate'>('water_tank');
  const [newPtCapacity, setNewPtCapacity] = useState<number | ''>(5000);
  const [newPtNotes, setNewPtNotes] = useState('');
  const [isSubmittingTactical, setIsSubmittingTactical] = useState(false);

  // Cône de propagation du vent
  const [showWindCone, setShowWindCone] = useState(true);

  // Fiche d'intervention d'urgence 18/112
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyCopied, setEmergencyCopied] = useState(false);

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

  // Chargement des points tactiques DFCI du site sélectionné
  useEffect(() => {
    if (selectedSiteId) {
      siteService.getTacticalPoints(selectedSiteId)
        .then(setTacticalPoints)
        .catch(() => setTacticalPoints([]));
    } else {
      setTacticalPoints([]);
    }
  }, [selectedSiteId]);

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

  // Chargement météo avec vent et direction
  useEffect(() => {
    const loadWeather = async () => {
      const weatherData = await fetchZonesWeather();
      if (weatherData && weatherData.length > 0) {
        setWeatherRisk({
          temp: weatherData[0].temperature,
          risk: weatherData[0].risk_percentage,
          humidity: weatherData[0].humidity,
          wind_speed: weatherData[0].wind_speed || 18,
          wind_direction: weatherData[0].wind_direction || 45
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
      setNewSiteRadius(300);
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
        radius: 300,
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

  // Ajout d'un point d'intérêt tactique DFCI (eau / accès)
  const handleAddTacticalPoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSiteId || !selectedSite) return;
    setIsSubmittingTactical(true);
    try {
      const offsetLat = (Math.random() - 0.5) * 0.0018;
      const offsetLng = (Math.random() - 0.5) * 0.0018;
      const created = await siteService.createTacticalPoint(selectedSiteId, {
        name: newPtName.trim(),
        point_type: newPtType,
        lat: parseFloat((selectedSite.lat + offsetLat).toFixed(6)),
        lng: parseFloat((selectedSite.lng + offsetLng).toFixed(6)),
        capacity_liters: newPtCapacity === '' ? undefined : Number(newPtCapacity),
        notes: newPtNotes.trim() || undefined
      });
      setTacticalPoints(prev => [...prev, created]);
      setIsAddTacticalModalOpen(false);
      setNewPtName('');
      setNewPtNotes('');
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'ajout du point DFCI.");
    } finally {
      setIsSubmittingTactical(false);
    }
  };

  // Suppression d'un point d'intérêt tactique DFCI
  const handleDeleteTacticalPoint = async (pointId: number) => {
    if (!window.confirm("Supprimer ce point tactique DFCI ?")) return;
    try {
      await siteService.deleteTacticalPoint(pointId);
      setTacticalPoints(prev => prev.filter(p => p.id !== pointId));
    } catch (err: any) {
      alert(err.message || "Erreur lors de la suppression.");
    }
  };

  const selectedSite = sites.find(s => s.id === selectedSiteId);

  return (
    <div className="carte-page">
      {/* HUD Header unifié ergonomique */}
      <div className="carte-hud-header">
        <div className="hud-brand-area">
          <div className="hud-badge">
            <FlameIcon size={15} />
            <span className="hud-badge-title">SURVEILLANCE</span>
            <span className="hud-badge-count">{sites.length}</span>
          </div>
        </div>

        {/* Défilement horizontal des sites (Pillules ergonomiques) */}
        <div className="hud-sites-scroll">
          {sites.map((site) => {
            const isSelected = site.id === selectedSiteId;
            const hasDev = Boolean(site.device_id && site.device);
            return (
              <button
                key={site.id}
                type="button"
                className={`hud-site-pill ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  setSelectedSiteId(site.id);
                  setIsPanelCollapsed(false);
                }}
                title={`Afficher ${site.name} sur le plan`}
              >
                {hasDev ? <RadioIcon size={12} /> : <PinIcon size={12} />}
                <span>{site.name}</span>
                {hasDev && <span className="chip-live-dot" />}
              </button>
            );
          })}
        </div>

        {/* Groupe d'actions rapides du HUD */}
        <div className="hud-actions-group">
          <button
            type="button"
            className="hud-btn-primary"
            onClick={() => {
              if (userPosition) {
                setNewSiteLat(userPosition[0]);
                setNewSiteLng(userPosition[1]);
                setGpsSuccess(true);
              } else {
                setNewSiteLat(46.2276);
                setNewSiteLng(2.2137);
                setGpsSuccess(false);
              }
              setGpsError(null);
              setIsAddModalOpen(true);
            }}
            title="Ajouter un nouveau site de surveillance"
          >
            <PlusIcon size={15} />
            <span className="hide-on-mobile">Ajouter</span>
          </button>

          {/* Bouton Fiche d'Urgence 18 / 112 */}
          <button
            type="button"
            className="hud-btn-emergency"
            onClick={() => setShowEmergencyModal(true)}
            title="Ouvrir la fiche d'intervention d'urgence prête pour les secours (18 / 112)"
          >
            <PhoneIcon size={13} />
            <span>18 / 112</span>
          </button>

          {/* Calque Points DFCI */}
          <button
            type="button"
            className={`hud-btn-icon ${showTacticalPoints ? 'active' : ''}`}
            onClick={() => setShowTacticalPoints(p => !p)}
            title={showTacticalPoints ? "Masquer les réserves d'eau et accès DFCI" : "Afficher les réserves d'eau et accès DFCI"}
          >
            <DropletIcon size={14} />
            <span className="hide-on-mobile" style={{ fontSize: '11px', fontWeight: 700 }}>DFCI</span>
          </button>

          {/* Calque Cône de propagation du vent */}
          <button
            type="button"
            className={`hud-btn-icon ${showWindCone ? 'active' : ''}`}
            onClick={() => setShowWindCone(p => !p)}
            title={showWindCone ? "Masquer le cône de propagation sous le vent" : "Afficher le cône prédictif de propagation"}
          >
            <WindIcon size={14} />
            <span className="hide-on-mobile" style={{ fontSize: '11px', fontWeight: 700 }}>Vent</span>
          </button>

          {sites.length > 0 && (
            <button
              type="button"
              className="hud-btn-icon hide-on-mobile"
              onClick={() => setIsSitesListModalOpen(true)}
              title={`Liste complète (${sites.length} sites)`}
            >
              <ListIcon size={15} />
            </button>
          )}

          <button
            type="button"
            className="hud-btn-icon"
            onClick={() => setMapLayer((prev) => (prev === 'dark' ? 'satellite' : 'dark'))}
            title={mapLayer === 'dark' ? "Passer en vue Satellite" : "Passer en plan Sombre"}
          >
            <GlobeIcon size={15} />
            <span className="hide-on-mobile" style={{ fontSize: '11px', fontWeight: 700 }}>
              {mapLayer === 'dark' ? 'Satellite' : 'Plan'}
            </span>
          </button>

          <button
            type="button"
            className={`hud-btn-icon ${isLocating ? 'locating' : ''}`}
            onClick={() => handleLocateUser(false)}
            title="Centrer la carte sur ma position GPS"
          >
            <GpsIcon size={15} className={isLocating ? 'spinning' : ''} />
          </button>

          <button
            type="button"
            className={`hud-btn-icon ${isRefreshing ? 'spinning' : ''}`}
            onClick={handleRefresh}
            title="Rafraîchir les données"
          >
            <RefreshIcon size={15} />
          </button>
        </div>
      </div>


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
                onClick={() => {
                  if (userPosition) {
                    setNewSiteLat(userPosition[0]);
                    setNewSiteLng(userPosition[1]);
                    setGpsSuccess(true);
                  } else {
                    setNewSiteLat(46.2276);
                    setNewSiteLng(2.2137);
                    setGpsSuccess(false);
                  }
                  setGpsError(null);
                  setIsAddModalOpen(true);
                }}
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
          center={selectedSite ? [selectedSite.lat, selectedSite.lng] : userPosition || [46.2276, 2.2137]} 
          zoom={selectedSite || userPosition ? 13 : 6} 
          style={{ width: '100%', height: '100%', background: '#111118', borderRadius: '16px' }}
          zoomControl={false}
          attributionControl={false}
        >
          {/* Fonds de carte haute définition 100% gratuits et sans clé d'API requise */}
          {mapLayer === 'satellite' ? (
            <>
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
                opacity={0.85}
              />
            </>
          ) : (
            <>
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                maxZoom={16}
              />
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
                maxZoom={16}
                opacity={0.9}
              />
            </>
          )}

          <MapClickHandler onMapClick={handleMapClick} />
          {selectedSite ? (
            <MapController center={[selectedSite.lat, selectedSite.lng]} />
          ) : userPosition ? (
            <MapController center={userPosition} />
          ) : null}

          {/* Marqueur de la position de l'utilisateur (GPS) */}
          {userPosition && (
            <Marker position={userPosition} icon={createUserLocationIcon()}>
              <Tooltip permanent direction="top" offset={[0, -14]} className="site-leaflet-tooltip user-position-tooltip">
                <span>Ma position GPS</span>
              </Tooltip>
            </Marker>
          )}
          
          {/* Prévisualisation en direct du rayon réel sur la carte lors de la création */}
          {isAddModalOpen && (
            <Circle
              center={[newSiteLat, newSiteLng]}
              radius={newSiteRadius}
              pathOptions={{
                color: '#ff5500',
                fillColor: '#ff5500',
                fillOpacity: 0.22,
                weight: 2,
                dashArray: '5, 8'
              }}
            >
              <Tooltip permanent direction="top" offset={[0, -10]} className="site-leaflet-tooltip">
                <span>Périmètre : Rayon {newSiteRadius}m (Diamètre {newSiteRadius * 2}m)</span>
              </Tooltip>
            </Circle>
          )}

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
                  radius={site.radius || 300}
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

          {/* Cône dynamique de propagation du feu sous le vent */}
          {showWindCone && selectedSite && weatherRisk && (
            <Polygon
              positions={computeWindCone(
                selectedSite.lat,
                selectedSite.lng,
                weatherRisk.wind_direction || 45,
                Math.max((selectedSite.radius || 300) * 1.8, (weatherRisk.wind_speed || 15) * 45)
              )}
              pathOptions={{
                color: '#ff4500',
                fillColor: '#ff5500',
                fillOpacity: 0.22,
                weight: 2,
                dashArray: '5, 5'
              }}
            >
              <Tooltip permanent direction="center" className="site-leaflet-tooltip" opacity={0.92}>
                <span>Vent {weatherRisk.wind_speed} km/h • Cône propagation 30 min</span>
              </Tooltip>
            </Polygon>
          )}

          {/* Points d'Intérêt Tactiques DFCI (Cuves, Poteaux, Accès, Barrières) */}
          {showTacticalPoints && tacticalPoints.map((pt) => (
            <Marker key={pt.id} position={[pt.lat, pt.lng]} icon={createTacticalIcon(pt.point_type)}>
              <Tooltip permanent direction="top" offset={[0, -14]} className="site-leaflet-tooltip">
                <span>{pt.name} {pt.capacity_liters ? `(${pt.capacity_liters.toLocaleString()}L)` : ''}</span>
              </Tooltip>
              <Popup className="custom-tactical-popup">
                <div style={{ padding: '6px 4px', minWidth: '170px' }}>
                  <strong style={{ fontSize: '13px', display: 'block', marginBottom: '4px', color: '#f8fafc' }}>{pt.name}</strong>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>
                    Type : {pt.point_type === 'water_tank' ? "Cuve d'eau" : pt.point_type === 'hydrant' ? "Poteau incendie" : pt.point_type === 'pool' ? "Bassin / Piscine" : pt.point_type === 'access_path' ? "Accès Carrossable" : "Barrière DFCI"}
                  </div>
                  {pt.capacity_liters && (
                    <div style={{ fontSize: '11px', color: '#38bdf8', marginBottom: '4px', fontWeight: 600 }}>
                      Capacité : {pt.capacity_liters.toLocaleString()} Litres
                    </div>
                  )}
                  {pt.notes && (
                    <div style={{ fontSize: '11px', color: '#cbd5e1', marginBottom: '8px', background: 'rgba(255,255,255,0.06)', padding: '4px 6px', borderRadius: '4px' }}>
                      {pt.notes}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteTacticalPoint(pt.id)}
                    style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', width: '100%' }}
                  >
                    Supprimer ce point
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Panneau Détails du Site Sélectionné */}
        {selectedSite && (
          <div className={`camera-details-panel ${isPanelCollapsed ? 'collapsed' : ''}`}>
            <div className="panel-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                {!isPanelCollapsed && selectedSite.description && (
                  <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#94a3b8' }}>{selectedSite.description}</p>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  className="panel-toggle-btn"
                  onClick={() => setIsPanelCollapsed((prev) => !prev)}
                  title={isPanelCollapsed ? "Développer les commandes" : "Réduire le panneau"}
                  aria-label={isPanelCollapsed ? "Développer" : "Réduire"}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {isPanelCollapsed ? <polyline points="6 9 12 15 18 9" /> : <polyline points="18 15 12 9 6 15" />}
                  </svg>
                </button>
                <button className="panel-close-btn" onClick={() => setSelectedSiteId(null)} title="Fermer le panneau">
                  <XIcon size={16} />
                </button>
              </div>
            </div>

            {isPanelCollapsed && (
              <div 
                className="panel-collapsed-peek" 
                onClick={() => setIsPanelCollapsed(false)}
                title="Cliquer pour afficher les commandes"
              >
                <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>Commandes réduites</span>
                <span style={{ fontSize: '11px', color: '#ff5722', fontWeight: 700 }}>· Développer</span>
              </div>
            )}
            
            {!isPanelCollapsed && (
              <>

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

            {/* Commandes Temps Réel & Interphone (Push-to-Talk, Micro, Alarme, Mode Travaux) */}
            {selectedSite.device && (
              <div style={{ marginTop: '12px', marginBottom: '14px' }}>
                <DeviceLiveControls
                  device={selectedSite.device}
                  onDeviceUpdate={(updated) => {
                    setSites((prev) =>
                      prev.map((s) =>
                        s.id === selectedSite.id && s.device
                          ? { ...s, device: { ...s.device, ...updated } }
                          : s
                      )
                    );
                  }}
                />
              </div>
            )}

            {/* Statistiques et Météo du site - Bar télémétrie épurée */}
            <div className="panel-telemetry-row">
              <div className="telemetry-pill">
                <span className="telemetry-label">Périmètre</span>
                <strong className="telemetry-value">{selectedSite.radius || 300}m</strong>
                <span className="telemetry-sub">~{((Math.PI * Math.pow(selectedSite.radius || 300, 2)) / 10000).toFixed(1)} ha</span>
              </div>
              <div className="telemetry-pill">
                <span className="telemetry-label">Risque local</span>
                <strong className="telemetry-value" style={{ color: (weatherRisk?.risk || 0) > 60 ? '#ef4444' : (weatherRisk?.risk || 0) > 30 ? '#f59e0b' : '#22c55e' }}>
                  {weatherRisk ? `${weatherRisk.risk}%` : '0%'}
                </strong>
                <span className="telemetry-sub">{(weatherRisk?.risk || 0) > 60 ? 'Critique' : (weatherRisk?.risk || 0) > 30 ? 'Modéré' : 'Faible'}</span>
              </div>
              <div className="telemetry-pill">
                <span className="telemetry-label">Points DFCI</span>
                <strong className="telemetry-value" style={{ color: '#0284c7' }}>
                  {tacticalPoints.length}
                </strong>
                <span className="telemetry-sub">{tacticalPoints.length > 0 ? 'Eau / Accès' : 'Aucun'}</span>
              </div>
              <div className="telemetry-pill">
                <span className="telemetry-label">Dispositif</span>
                <strong className="telemetry-value" style={{ fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedSite.device ? selectedSite.device.name : 'Aucun'}
                </strong>
                <span className="telemetry-sub">{selectedSite.device ? 'Pi 4 Connecté' : 'Non équipé'}</span>
              </div>
            </div>

            {/* Barre d'action inférieure du site */}
            <div className="panel-footer">
              <span className="panel-gps-tag">
                <PinIcon size={12} />
                <span>{selectedSite.lat.toFixed(4)}°N, {selectedSite.lng.toFixed(4)}°E</span>
              </span>
              
              <div className="panel-footer-actions">
                <button
                  type="button"
                  className="btn-action-tactical"
                  onClick={() => setIsAddTacticalModalOpen(true)}
                  title="Ajouter une réserve d'eau ou un accès DFCI pour les secours"
                >
                  <PlusIcon size={12} />
                  <span>Point DFCI</span>
                </button>

                <button 
                  type="button"
                  className="btn-action-secondary"
                  onClick={() => {
                    setSelectedDeviceIdToAssign(selectedSite.device_id || (pairedDevices.length > 0 ? pairedDevices[0].id : ''));
                    setIsAssignModalOpen(true);
                  }}
                  title="Changer le Raspberry Pi associé"
                >
                  {selectedSite.device ? "Modifier" : "Associer"}
                </button>

                <button 
                  type="button"
                  className="btn-action-danger"
                  onClick={() => handleDeleteSite(selectedSite.id)}
                  title="Supprimer ce site du plan"
                >
                  <TrashIcon size={13} />
                </button>
              </div>
            </div>
              </>
            )}

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

              {/* Utilisation de la position GPS du téléphone ou de l'ordinateur */}
              <div className="gps-locate-box">
                <button
                  type="button"
                  className={`gps-locate-btn ${isLocating ? 'locating' : ''}`}
                  onClick={() => handleLocateUser(true)}
                  disabled={isLocating}
                >
                  <GpsIcon size={17} className={isLocating ? 'spinning' : ''} />
                  <span>{isLocating ? 'Acquisition du signal GPS...' : 'Utiliser ma position GPS (Téléphone / PC)'}</span>
                </button>
                {gpsSuccess && gpsAccuracy !== null && (
                  <div className="gps-status-badge success">
                    Position GPS validée : {newSiteLat.toFixed(5)}, {newSiteLng.toFixed(5)} (Précision : ±{gpsAccuracy}m)
                  </div>
                )}
                {gpsError && (
                  <div className="gps-status-badge error">
                    {gpsError}
                  </div>
                )}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="site-input-label" style={{ margin: 0 }}>Rayon de surveillance</label>
                  <span className="site-radius-badge">
                    {newSiteRadius} mètres
                  </span>
                </div>

                {/* Boutons de sélection rapide incluant 300m */}
                <div className="site-radius-selector">
                  {[100, 200, 300, 500, 1000].map(r => (
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

                {/* Curseur de réglage précis */}
                <div className="site-radius-slider-container">
                  <input
                    type="range"
                    min="50"
                    max="2000"
                    step="25"
                    value={newSiteRadius}
                    onChange={(e) => setNewSiteRadius(Number(e.target.value))}
                    className="site-radius-slider"
                  />
                  <div className="site-radius-slider-limits">
                    <span>50m</span>
                    <span className="site-radius-slider-center">Standard : 300m</span>
                    <span>2000m</span>
                  </div>
                </div>

                {/* Métriques réelles au sol calculées dynamiquement */}
                <div className="site-radius-metrics-box">
                  <div className="site-metric-item">
                    <span className="site-metric-title">Diamètre au sol</span>
                    <span className="site-metric-value">{newSiteRadius * 2} m</span>
                  </div>
                  <div className="site-metric-divider" />
                  <div className="site-metric-item">
                    <span className="site-metric-title">Superficie couverte</span>
                    <span className="site-metric-value">
                      ~{((Math.PI * Math.pow(newSiteRadius, 2)) / 10000).toFixed(1)} ha
                    </span>
                  </div>
                  <div className="site-metric-divider" />
                  <div className="site-metric-item">
                    <span className="site-metric-title">Surface exacte</span>
                    <span className="site-metric-value">
                      {Math.round(Math.PI * Math.pow(newSiteRadius, 2)).toLocaleString('fr-FR')} m²
                    </span>
                  </div>
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
                        {site.lat.toFixed(4)}°N, {site.lng.toFixed(4)}°E · Rayon {site.radius || 300}m (~{((Math.PI * Math.pow(site.radius || 300, 2)) / 10000).toFixed(1)} ha)
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

      {/* Modal Ajout Point DFCI Tactique */}
      {isAddTacticalModalOpen && selectedSite && (
        <div className="site-modal-backdrop" onClick={() => setIsAddTacticalModalOpen(false)}>
          <div className="site-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="site-modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8' }}>
                <DropletIcon size={18} />
                <span>Ajouter un Point Tactique DFCI</span>
              </h3>
              <button type="button" className="site-modal-close" onClick={() => setIsAddTacticalModalOpen(false)}>
                <XIcon size={18} />
              </button>
            </div>

            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 16px', lineHeight: 1.5 }}>
              Positionné sur le site <strong>{selectedSite.name}</strong>. Ces repères orientent les secours SDIS et les engins CCF en cas d'intervention pour localiser l'eau et les accès.
            </p>

            <form onSubmit={handleAddTacticalPoint} className="site-form">
              <div className="site-form-group">
                <label>Nom ou référence du point *</label>
                <input
                  type="text"
                  required
                  value={newPtName}
                  onChange={(e) => setNewPtName(e.target.value)}
                  placeholder="Ex: Cuve Béton DFCI 30m³ ou Poteau Rouge #4"
                />
              </div>

              <div className="site-form-group">
                <label>Type d'infrastructure DFCI *</label>
                <select
                  value={newPtType}
                  onChange={(e) => setNewPtType(e.target.value as any)}
                >
                  <option value="water_tank">Cuve d'eau DFCI</option>
                  <option value="hydrant">Poteau incendie (Hydrant)</option>
                  <option value="pool">Bassin naturel / Piscine</option>
                  <option value="access_path">Chemin carrossable CCF / Accès secours</option>
                  <option value="gate">Barrière DFCI / Portail à clé</option>
                </select>
              </div>

              {(newPtType === 'water_tank' || newPtType === 'hydrant' || newPtType === 'pool') && (
                <div className="site-form-group">
                  <label>Capacité estimée (Litres)</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={newPtCapacity}
                    onChange={(e) => setNewPtCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ex: 10000"
                  />
                </div>
              )}

              <div className="site-form-group">
                <label>Instructions d'accès & détails tactiques</label>
                <textarea
                  rows={3}
                  value={newPtNotes}
                  onChange={(e) => setNewPtNotes(e.target.value)}
                  placeholder="Ex: Raccord symétrique Guillemin DN65, code cadenas 3812, accès camion 4x4 uniquement."
                />
              </div>

              <div className="site-modal-actions">
                <button
                  type="submit"
                  disabled={isSubmittingTactical || !newPtName.trim()}
                  className="site-btn-submit"
                >
                  {isSubmittingTactical ? "Enregistrement..." : "Enregistrer le point"}
                </button>
                <button
                  type="button"
                  className="site-btn-cancel"
                  onClick={() => setIsAddTacticalModalOpen(false)}
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Fiche d'Intervention d'Urgence 18 / 112 */}
      {showEmergencyModal && (
        <div className="site-modal-backdrop" onClick={() => setShowEmergencyModal(false)}>
          <div className="site-modal-card emergency-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="site-modal-header" style={{ borderBottomColor: 'rgba(239, 68, 68, 0.3)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
                <PhoneIcon size={20} />
                <span>Fiche d'Urgence SDIS 18 / 112</span>
              </h3>
              <button type="button" className="site-modal-close" onClick={() => setShowEmergencyModal(false)}>
                <XIcon size={18} />
              </button>
            </div>

            {selectedSite ? (
              <div className="emergency-modal-content">
                {/* Boutons d'Appel Immédiat */}
                <div className="emergency-call-row">
                  <a href="tel:18" className="emergency-call-btn btn-18">
                    <PhoneIcon size={20} />
                    <div style={{ textAlign: 'left' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.85, display: 'block' }}>Appel direct</span>
                      <strong style={{ fontSize: '16px' }}>18 · Pompiers</strong>
                    </div>
                  </a>
                  <a href="tel:112" className="emergency-call-btn btn-112">
                    <PhoneIcon size={20} />
                    <div style={{ textAlign: 'left' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.85, display: 'block' }}>Numéro européen</span>
                      <strong style={{ fontSize: '16px' }}>112 · Urgences</strong>
                    </div>
                  </a>
                </div>

                {/* Coordonnées SDIS & Navigation */}
                <div className="emergency-info-section">
                  <div className="emergency-info-header">
                    <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '13px' }}>Site : {selectedSite.name}</span>
                    <span className="emergency-sdis-badge">Format opérationnel SDIS</span>
                  </div>

                  <div className="emergency-coords-grid">
                    <div className="emergency-coord-card">
                      <span className="coord-label">GPS Sexagésimal (DMS)</span>
                      <strong className="coord-val">{toDMS(selectedSite.lat, 'lat')} • {toDMS(selectedSite.lng, 'lng')}</strong>
                    </div>
                    <div className="emergency-coord-card">
                      <span className="coord-label">GPS Décimal</span>
                      <strong className="coord-val">{selectedSite.lat.toFixed(6)}, {selectedSite.lng.toFixed(6)}</strong>
                    </div>
                  </div>

                  <div className="emergency-nav-links">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${selectedSite.lat},${selectedSite.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="emergency-nav-btn"
                    >
                      <GlobeIcon size={14} />
                      <span>Itinéraire Google Maps</span>
                    </a>
                    <a
                      href={`https://waze.com/ul?ll=${selectedSite.lat},${selectedSite.lng}&navigate=yes`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="emergency-nav-btn"
                    >
                      <GpsIcon size={14} />
                      <span>Guidage Waze</span>
                    </a>
                  </div>
                </div>

                {/* Point d'eau DFCI le plus proche */}
                <div className="emergency-tactical-block">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <DropletIcon size={16} color="#38bdf8" />
                    <strong style={{ fontSize: '13px', color: '#e2e8f0' }}>Ressource en eau DFCI la plus proche</strong>
                  </div>
                  {(() => {
                    const waterPts = tacticalPoints.filter(p => p.point_type === 'water_tank' || p.point_type === 'hydrant' || p.point_type === 'pool');
                    if (waterPts.length === 0) {
                      return (
                        <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                          Aucune réserve d'eau DFCI enregistrée sur ce site. Pensez à en ajouter une via le bouton "+ Point DFCI".
                        </p>
                      );
                    }
                    const nearest = [...waterPts].sort((a, b) => {
                      const distA = Math.hypot(a.lat - selectedSite.lat, a.lng - selectedSite.lng);
                      const distB = Math.hypot(b.lat - selectedSite.lat, b.lng - selectedSite.lng);
                      return distA - distB;
                    })[0];
                    const distMeters = Math.round(Math.hypot(nearest.lat - selectedSite.lat, nearest.lng - selectedSite.lng) * 111000);
                    return (
                      <div style={{ background: 'rgba(2, 132, 199, 0.12)', border: '1px solid rgba(2, 132, 199, 0.3)', borderRadius: '8px', padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <strong style={{ fontSize: '13px', color: '#38bdf8' }}>{nearest.name}</strong>
                          <span style={{ fontSize: '11px', background: '#0284c7', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                            ~{distMeters} m
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                          {nearest.point_type === 'water_tank' ? "Cuve d'eau" : nearest.point_type === 'hydrant' ? "Poteau incendie" : "Bassin"}
                          {nearest.capacity_liters ? ` • Capacité : ${nearest.capacity_liters.toLocaleString()} L` : ''}
                        </div>
                        {nearest.notes && (
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>{nearest.notes}</div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Script de transmission CODIS / 18 avec copie 1-clic */}
                {(() => {
                  const waterPts = tacticalPoints.filter(p => p.point_type === 'water_tank' || p.point_type === 'hydrant' || p.point_type === 'pool');
                  const nearest = waterPts.length > 0 ? [...waterPts].sort((a, b) => {
                    const distA = Math.hypot(a.lat - selectedSite.lat, a.lng - selectedSite.lng);
                    const distB = Math.hypot(b.lat - selectedSite.lat, b.lng - selectedSite.lng);
                    return distA - distB;
                  })[0] : null;
                  const distMeters = nearest ? Math.round(Math.hypot(nearest.lat - selectedSite.lat, nearest.lng - selectedSite.lng) * 111000) : null;
                  
                  const dispatchScript = `ALERTE INCENDIE CAMFIRE - TRANSMISSION CODIS 18:
Site : ${selectedSite.name}
GPS DMS : ${toDMS(selectedSite.lat, 'lat')} / ${toDMS(selectedSite.lng, 'lng')}
GPS Décimal : ${selectedSite.lat.toFixed(6)}, ${selectedSite.lng.toFixed(6)}
Vent : ${weatherRisk?.wind_speed ?? 0} km/h (dir ${weatherRisk?.wind_direction ?? 0}°)
Point d'eau : ${nearest ? `${nearest.name} (${nearest.capacity_liters ? nearest.capacity_liters.toLocaleString() + 'L' : 'non précisé'} à ~${distMeters}m)` : 'Non renseigné'}
Lien GPS : https://www.google.com/maps/search/?api=1&query=${selectedSite.lat},${selectedSite.lng}`;

                  return (
                    <div className="emergency-dispatch-box">
                      <div className="dispatch-header">
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>Texte de briefing à dicter aux opérateurs SDIS</span>
                        <button
                          type="button"
                          className={`btn-copy-dispatch ${emergencyCopied ? 'copied' : ''}`}
                          onClick={() => {
                            navigator.clipboard.writeText(dispatchScript);
                            setEmergencyCopied(true);
                            setTimeout(() => setEmergencyCopied(false), 2500);
                          }}
                        >
                          {emergencyCopied ? <CheckCircleIcon size={14} /> : <CopyIcon size={14} />}
                          <span>{emergencyCopied ? 'Fiche copiée !' : 'Copier le briefing'}</span>
                        </button>
                      </div>
                      <pre className="dispatch-pre">{dispatchScript}</pre>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: '20px 0' }}>
                Sélectionnez d'abord un site sur la carte pour générer la fiche d'intervention d'urgence.
              </p>
            )}

            <div className="site-modal-actions" style={{ marginTop: '16px' }}>
              <button
                type="button"
                className="site-btn-cancel"
                style={{ width: '100%', textAlign: 'center' }}
                onClick={() => setShowEmergencyModal(false)}
              >
                Fermer la fiche d'urgence
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
          device={selectedSite.device}
          onDeviceUpdate={(updated) => {
            setSites((prev) =>
              prev.map((s) =>
                s.id === selectedSite.id && s.device
                  ? { ...s, device: { ...s.device, ...updated } }
                  : s
              )
            );
          }}
        />
      )}
    </div>
  );
};
