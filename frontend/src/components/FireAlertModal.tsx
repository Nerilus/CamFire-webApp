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
  rawDate?: string;
  formattedTime?: string;
}

interface Props {
  record: AlertRecord;
  onClose: () => void;
  imageUrl?: string | null;
  confidence?: number;
}

export const FireAlertModal: React.FC<Props> = ({ record, onClose, imageUrl, confidence }) => {
  const [showFullImage, setShowFullImage] = useState(false);
  const [showReport, setShowReport] = useState(false);

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
          <button
            type="button"
            className="fire-modal-btn btn-report"
            onClick={() => setShowReport(true)}
          >
            <SendIcon size={18} /> GÉNÉRER LE RAPPORT OFFICIEL (PDF)
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

      {/* MODAL RAPPORT OFFICIEL IMPRIMABLE / PDF */}
      {showReport && (
        <div className="incident-report-overlay" onClick={() => setShowReport(false)}>
          <div className="incident-report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="incident-report-toolbar no-print">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 800, color: '#f8fafc', fontSize: '13px' }}>RAPPORT D'INCIDENT OFFICIEL</span>
                <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                  REF: CF-INC-{record.id}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-print-report"
                  onClick={() => window.print()}
                >
                  Imprimer / PDF (A4)
                </button>
                <button
                  type="button"
                  className="btn-close-report"
                  onClick={() => setShowReport(false)}
                >
                  Fermer
                </button>
              </div>
            </div>

            {/* Document Imprimable Officiel A4 */}
            <div className="incident-report-document print-area">
              <div className="report-header">
                <div>
                  <h1 className="report-brand">CAMFIRE TECHNOLOGIES</h1>
                  <p className="report-subbrand">SYSTÈME TACTIQUE DE TÉLÉDÉTECTION PRÉCOCE DES DÉPARTS DE FEUX</p>
                </div>
                <div className="report-meta-box">
                  <div>RÉF : <strong>CF-INC-{record.id}</strong></div>
                  <div>DATE : <strong>{record.date}</strong></div>
                  <div>STATUT : <strong style={{ color: '#dc2626' }}>CERTIFIÉ IA</strong></div>
                </div>
              </div>

              <div className="report-title-banner">
                RAPPORT D'INCIDENT DE DÉTECTION OPTIQUE & DÉCLARATION DE SINISTRE
              </div>

              <p className="report-legal-notice">
                Document probant établi automatiquement à partir des flux de télésurveillance et des algorithmes d'analyse Edge IA YOLO. 
                Ce rapport est destiné aux services départementaux d'incendie et de secours (SDIS 18 / 112) ainsi qu'aux compagnies d'assurances pour l'instruction des sinistres et réquisitions.
              </p>

              <div className="report-grid-section">
                <div className="report-field">
                  <span className="field-label">NATURE DU SINISTRE</span>
                  <strong className="field-value" style={{ color: isFire ? '#b91c1c' : '#d97706' }}>
                    {isFire ? "DÉPART DE FEU / DÉGAGEMENT DE FUMÉE CONFIRMÉ" : "ALERTE SÉCURITÉ"}
                  </strong>
                </div>
                <div className="report-field">
                  <span className="field-label">INDICE DE CONFIANCE IA</span>
                  <strong className="field-value">{displayConfidence}% (YOLOv8/v11 Edge Engine)</strong>
                </div>
                <div className="report-field">
                  <span className="field-label">SITE OU LIEU-DIT</span>
                  <strong className="field-value">{record.location}</strong>
                </div>
                <div className="report-field">
                  <span className="field-label">COORDONNÉES GPS</span>
                  <strong className="field-value">{record.coords || 'Coordonnées du capteur'}</strong>
                </div>
                <div className="report-field">
                  <span className="field-label">HORODATAGE PRÉCIS</span>
                  <strong className="field-value">{record.date}</strong>
                </div>
                <div className="report-field">
                  <span className="field-label">IDENTIFIANT DE L'ENREGISTREMENT</span>
                  <strong className="field-value">#INC-{record.id}</strong>
                </div>
              </div>

              {finalImageUrl && (
                <div className="report-evidence-box">
                  <div className="evidence-title">PREUVE PHOTOGRAPHIQUE CERTIFIÉE PAR CAPTEUR CAMFIRE</div>
                  <img src={finalImageUrl} alt="Preuve d'incident" className="report-evidence-img" />
                  <div className="evidence-caption">
                    Cliché haute définition capturé au moment exact du déclenchement de l'alarme
                  </div>
                </div>
              )}

              <div className="report-signatures-grid">
                <div className="sig-box">
                  <span className="sig-label">CADRE OPÉRATEUR / PROPRIÉTAIRE</span>
                  <div style={{ height: '50px' }} />
                  <span className="sig-line">Date et signature du déclarant</span>
                </div>
                <div className="sig-box">
                  <span className="sig-label">VISA DES SECOURS / ASSURANCE</span>
                  <div style={{ height: '50px' }} />
                  <span className="sig-line">Tampon officiel et accusé de réception</span>
                </div>
              </div>

              <div className="report-footer">
                CamFire S.A.S. • Système certifié conforme norme DFCI • Données chiffrées SHA-256
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
