import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, MinusIcon, GlobeIcon, ChevronRightIcon } from '../components/icons';
import { emergencyContacts } from '../services/mockData';
import { useAuth } from '../context/AuthContext';
import './Settings.css';

type Sensitivity = 'low' | 'medium' | 'high';

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [autoScan, setAutoScan] = useState(true);
  const [interval, setIntervalValue] = useState(60);
  const [sensitivity, setSensitivity] = useState<Sensitivity>('high');
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">RÉGLAGES</h1>
      </div>

      <section className="settings-section">
        <h2 className="settings-section-title">SCAN AUTOMATIQUE</h2>
        <div className="settings-row">
          <div className="settings-row-text">
            <strong>Scan automatique activé</strong>
            <span>Analyse en arrière-plan automatiquement</span>
          </div>
          <button className={`toggle${autoScan ? ' on' : ''}`} onClick={() => setAutoScan((v) => !v)}>
            <span className="knob" />
          </button>
        </div>
        <div className="settings-row">
          <div className="settings-row-text">
            <strong>Intervalle de scan</strong>
            <span>Toutes les {interval}s</span>
          </div>
          <div className="stepper">
            <button onClick={() => setIntervalValue((v) => Math.max(10, v - 10))}>
              <MinusIcon size={14} />
            </button>
            <span>{interval}</span>
            <button onClick={() => setIntervalValue((v) => Math.min(300, v + 10))}>
              <PlusIcon size={14} />
            </button>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">SENSIBILITÉ DES ALERTES</h2>
        <div className="segmented">
          {(['low', 'medium', 'high'] as Sensitivity[]).map((s) => (
            <button
              key={s}
              className={`segmented-item${sensitivity === s ? ' active' : ''}`}
              onClick={() => setSensitivity(s)}
            >
              {s === 'low' ? 'FAIBLE' : s === 'medium' ? 'MOYENNE' : 'ÉLEVÉE'}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">NOTIFICATIONS</h2>
        <div className="settings-row">
          <div className="settings-row-text">
            <strong>Notifications push</strong>
          </div>
          <button className={`toggle${notifications ? ' on' : ''}`} onClick={() => setNotifications((v) => !v)}>
            <span className="knob" />
          </button>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-header">
          <h2 className="settings-section-title">CONTACTS D'URGENCE</h2>
          <button className="settings-add">
            <PlusIcon size={13} /> AJOUTER
          </button>
        </div>
        <div className="contacts-list">
          {emergencyContacts.map((c) => (
            <div className="contact-row" key={c.id}>
              <div className="contact-avatar">{c.name.charAt(0)}</div>
              <div className="contact-info">
                <strong>{c.name}</strong>
                <span>{c.phone}</span>
              </div>
              <span className="contact-role">{c.role}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">LANGUE</h2>
        <button className="settings-row link-row">
          <GlobeIcon size={18} />
          <span className="settings-row-text-inline">Français</span>
          <ChevronRightIcon size={18} className="link-row-chevron" />
        </button>
      </section>

      <button
        className="btn btn-dark logout-btn"
        onClick={() => {
          logout();
          navigate('/auth');
        }}
      >
        Se déconnecter
      </button>
    </div>
  );
};
