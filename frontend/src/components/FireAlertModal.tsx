import React from 'react';
import { FlameIcon, XIcon, CheckCircleIcon, EyeIcon, UsersIcon, PhoneIcon, SendIcon } from './icons';
import type { ScanRecord } from '../services/mockData';
import './FireAlertModal.css';

interface Props {
  record: ScanRecord;
  onClose: () => void;
}

export const FireAlertModal: React.FC<Props> = ({ record, onClose }) => (
  <div className="fire-modal-overlay">
    <div className="fire-modal">
      <div className="fire-modal-top">
        <span className="live-alert">
          <span className="live-dot" /> ALERTE EN DIRECT
        </span>
        <button className="fire-modal-close" onClick={onClose} aria-label="Fermer">
          <XIcon size={20} />
        </button>
      </div>

      <div className="fire-modal-icon">
        <FlameIcon size={56} />
      </div>
      <h1 className="fire-modal-title">
        INCENDIE
        <br />
        DÉTECTÉ
      </h1>

      <div className="fire-modal-location">
        <strong>{record.location}</strong>
        <span>
          {record.coords} · Conf : {record.confidence}%
        </span>
      </div>

      <div className="fire-modal-sent">
        <CheckCircleIcon size={16} /> Alerte envoyée avec succès
      </div>

      <div className="fire-modal-evidence">
        <div className="fire-modal-evidence-thumb">
          <FlameIcon size={22} />
        </div>
        <div className="fire-modal-evidence-text">
          <span>Preuve capturée</span>
          <span className="fire-modal-evidence-date">{record.date}</span>
        </div>
        <EyeIcon size={18} />
      </div>

      <button className="fire-modal-btn btn-neighbors">
        <UsersIcon size={18} /> ALERTER LES VOISINS
      </button>
      <button className="fire-modal-btn btn-pompiers">
        <PhoneIcon size={18} /> APPELER LE 18 — POMPIERS
      </button>
      <button className="fire-modal-btn btn-report">
        <SendIcon size={18} /> ENVOYER LE RAPPORT
      </button>
    </div>
  </div>
);
