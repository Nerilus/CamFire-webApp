import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NearbyAlertBanner } from '../components/NearbyAlertBanner';
import { CheckCircleIcon, FlameIcon, ClockIcon, UsersIcon, ChevronRightIcon, MapIcon } from '../components/icons';
import { scanHistory, emergencyContacts, cameras, type ScanStatus } from '../services/mockData';
import './Home.css';

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

  const incidentsCount = scanHistory.filter((r) => r.status === 'fire').length;
  const recentScans = scanHistory.slice(0, 3);

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

        <div className="home-hero">
          <div className="home-hero-icon">
            <CheckCircleIcon size={28} />
          </div>
          <div className="home-hero-text">
            <strong>Aucun danger détecté</strong>
            <span>Dernier scan il y a 2 min</span>
          </div>
          <button className="btn home-hero-btn" onClick={() => navigate('/scan')}>
            Scanner
          </button>
        </div>

        <div className="home-stats">
          <div className="home-stat-card accent-danger">
            <div className="home-stat-icon"><FlameIcon size={18} /></div>
            <strong>{incidentsCount}</strong>
            <span>Incidents</span>
          </div>
          <div className="home-stat-card accent-info">
            <div className="home-stat-icon"><ClockIcon size={18} /></div>
            <strong>{scanHistory.length}</strong>
            <span>Scans</span>
          </div>
          <div className="home-stat-card accent-violet">
            <div className="home-stat-icon"><UsersIcon size={18} /></div>
            <strong>{emergencyContacts.length}</strong>
            <span>Contacts</span>
          </div>
        </div>

        <button className="home-map-preview" onClick={() => navigate('/carte')}>
          <div className="home-map-preview-canvas">
            {cameras.map((cam) => (
              <span
                key={cam.id}
                className="home-map-dot"
                style={{ left: `${cam.x}%`, top: `${cam.y}%`, background: cameraDotColor[cam.status] }}
              />
            ))}
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
          {recentScans.map((r) => (
            <button
              className={`home-activity-item ${statusMeta[r.status].borderClass}`}
              key={r.id}
              onClick={() => navigate('/historique')}
            >
              <div className="home-activity-info">
                <strong>{r.location}</strong>
                <span>{r.date}</span>
              </div>
              <span className={`badge ${statusMeta[r.status].className}`}>{statusMeta[r.status].label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
