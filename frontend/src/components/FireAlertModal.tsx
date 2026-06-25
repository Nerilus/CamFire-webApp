import React, { useState } from 'react';
import { FlameIcon, XIcon, CheckCircleIcon, EyeIcon, UsersIcon, PhoneIcon, SendIcon } from './icons';
import type { ScanRecord } from '../services/mockData';
import './FireAlertModal.css';

interface Props {
  record: ScanRecord;
  onClose: () => void;
  imageUrl?: string | null;
  confidence?: number;
}

export const FireAlertModal: React.FC<Props> = ({ record, onClose, imageUrl, confidence }) => {
  const [showFullImage, setShowFullImage] = useState(false);

  return (
    <>
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
          {record.coords} · Conf : {confidence !== undefined ? Math.round(confidence * 100) : record.confidence}%
        </span>
      </div>

      <div className="fire-modal-sent">
        <CheckCircleIcon size={16} /> Alerte envoyée avec succès
      </div>

      <div 
        className="fire-modal-evidence" 
        onClick={() => { if (imageUrl) setShowFullImage(true); }}
        style={{ cursor: imageUrl ? 'pointer' : 'default' }}
      >
        <div className="fire-modal-evidence-thumb">
          {imageUrl ? (
            <img src={imageUrl} alt="Preuve Grad-CAM" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
          ) : (
            <FlameIcon size={22} />
          )}
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
      <a href="tel:18" className="fire-modal-btn btn-pompiers" style={{ textDecoration: 'none' }}>
        <PhoneIcon size={18} /> APPELER LE 18 — POMPIERS
      </a>
      <button className="fire-modal-btn btn-report">
        <SendIcon size={18} /> ENVOYER LE RAPPORT
      </button>
      </div>
      </div>
      
      {showFullImage && imageUrl && (
        <div 
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowFullImage(false)}
        >
          <img 
            src={imageUrl} 
            alt="Grad-CAM en grand" 
            style={{ maxWidth: '95%', maxHeight: '95%', objectFit: 'contain', borderRadius: '12px' }} 
          />
          <button 
            style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', color: 'white', width: '40px', height: '40px', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={(e) => { e.stopPropagation(); setShowFullImage(false); }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
};
