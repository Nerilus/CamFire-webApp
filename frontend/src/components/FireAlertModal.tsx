import React, { useState } from 'react';
import { SmokeIcon, WarningIcon, XIcon, CheckCircleIcon, EyeIcon, UsersIcon, PhoneIcon, SendIcon } from './icons';
import './FireAlertModal.css';

export interface AlertRecord {
  id: string | number;
  status: string;
  location: string;
  date: string;
  confidence?: number;
  coords?: string;
  image_url?: string | null;
  detection_type?: string;
}

interface Props {
  record: AlertRecord;
  onClose: () => void;
  imageUrl?: string | null;
  confidence?: number;
}

export const FireAlertModal: React.FC<Props> = ({ record, onClose, imageUrl, confidence }) => {
  const [showFullImage, setShowFullImage] = useState(false);

  const finalImageUrl = imageUrl || record.image_url;
  const rawConf = confidence !== undefined ? confidence : record.confidence;
  const displayConfidence = rawConf !== undefined
    ? Math.round(rawConf > 1 ? rawConf : rawConf * 100)
    : 95;

  const isFire = record.status === 'fire' || record.detection_type === 'fire' || record.detection_type === 'smoke' || (record.location && (record.location.toLowerCase().includes('feu') || record.location.toLowerCase().includes('fumée')));

  return (
    <>
      <div className="fire-modal-overlay">
        <div className={`fire-modal ${isFire ? 'fire-theme' : 'warn-theme'}`}>
          <div className="fire-modal-top">
            <span className="live-alert">
              <span className="live-dot" /> {isFire ? 'DÉTECTION DE FUMÉE' : 'ALERTE SURVEILLANCE'}
            </span>
            <button className="fire-modal-close" onClick={onClose} aria-label="Fermer">
              <XIcon size={20} />
            </button>
          </div>

          <div className="fire-modal-icon">
            {isFire ? <SmokeIcon size={56} /> : <WarningIcon size={56} />}
          </div>
          <h1 className="fire-modal-title">
            {isFire ? (
              <>
                FUMÉE
                <br />
                DÉTECTÉE
              </>
            ) : (
              <>
                INTRUSION /
                <br />
                ALERTE DÉTECTÉE
              </>
            )}
          </h1>

          <div className="fire-modal-location">
            <strong>{(record.location || '').replace(/\(Feu\)/g, '(Fumée)')}</strong>
            <span>
              {record.coords || '46.2276°N 2.2137°E'} · Conf : {displayConfidence}%
            </span>
          </div>

          <div className="fire-modal-sent">
            <CheckCircleIcon size={16} /> {isFire ? 'Alerte fumée envoyée avec succès' : 'Rapport de sécurité enregistré'}
          </div>

          {/* Preuve photo capturée mise en avant */}
          {finalImageUrl ? (
            <div 
              className="fire-modal-evidence-card" 
              onClick={() => setShowFullImage(true)}
              style={{ cursor: 'pointer' }}
            >
              <div className="fire-modal-img-wrapper">
                <img src={finalImageUrl} alt="Preuve détection" className="fire-modal-full-thumb" />
                <div className="fire-modal-img-zoom-btn">
                  <EyeIcon size={15} /> Agrandir
                </div>
              </div>
              <div className="fire-modal-evidence-footer">
                <span>Preuve capturée par caméra</span>
                <span className="fire-modal-evidence-date">{record.date}</span>
              </div>
            </div>
          ) : (
            <div className="fire-modal-evidence">
              <div className="fire-modal-evidence-thumb">
                {isFire ? <SmokeIcon size={22} /> : <WarningIcon size={22} />}
              </div>
              <div className="fire-modal-evidence-text">
                <span>Alerte sans capture photo</span>
                <span className="fire-modal-evidence-date">{record.date}</span>
              </div>
            </div>
          )}

          <button className="fire-modal-btn btn-neighbors">
            <UsersIcon size={18} /> ALERTER LES VOISINS
          </button>
          {isFire ? (
            <a href="tel:18" className="fire-modal-btn btn-pompiers" style={{ textDecoration: 'none' }}>
              <PhoneIcon size={18} /> APPELER LE 18 — POMPIERS
            </a>
          ) : (
            <a href="tel:17" className="fire-modal-btn btn-pompiers" style={{ textDecoration: 'none' }}>
              <PhoneIcon size={18} /> APPELER LE 17 — POLICE
            </a>
          )}
          <button className="fire-modal-btn btn-report">
            <SendIcon size={18} /> ENVOYER LE RAPPORT
          </button>
        </div>
      </div>
      
      {showFullImage && finalImageUrl && (
        <div 
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowFullImage(false)}
        >
          <img 
            src={finalImageUrl} 
            alt="Preuve en grand" 
            style={{ maxWidth: '95%', maxHeight: '92%', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.8)' }} 
          />
          <button 
            style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: '50%', color: 'white', width: '42px', height: '42px', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={(e) => { e.stopPropagation(); setShowFullImage(false); }}
            aria-label="Fermer"
          >
            <XIcon size={20} />
          </button>
        </div>
      )}
    </>
  );
};
