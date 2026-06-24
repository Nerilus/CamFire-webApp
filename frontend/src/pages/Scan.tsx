import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlashIcon, RefreshIcon, GalleryIcon, VideoIcon } from '../components/icons';
import { FireAlertModal } from '../components/FireAlertModal';
import { scanHistory } from '../services/mockData';
import './Scan.css';

export const Scan: React.FC = () => {
  const navigate = useNavigate();
  const [analyzing, setAnalyzing] = useState(false);
  const [fireDetected, setFireDetected] = useState(false);

  const handleCapture = () => {
    if (analyzing) return;
    setAnalyzing(true);
    setTimeout(() => {
      setAnalyzing(false);
      setFireDetected(true);
    }, 1400);
  };

  return (
    <div className="scan-page">
      <div className="scan-topbar">
        <button className="scan-icon-btn">
          <FlashIcon size={18} />
        </button>
        <span className="scan-mode-label">ARRIÈRE · SCAN IA</span>
        <button className="scan-icon-btn">
          <RefreshIcon size={18} />
        </button>
      </div>

      <div className="scan-viewfinder">
        <span className="corner tl" />
        <span className="corner tr" />
        <span className="corner bl" />
        <span className="corner br" />
        <p className="scan-hint">{analyzing ? 'ANALYSE EN COURS…' : 'POINTEZ VERS LA SCÈNE'}</p>

        <div className={`scan-status-pill ${analyzing ? 'analyzing' : 'safe'}`}>
          <span className="dot" />
          {analyzing ? 'ANALYSE EN COURS' : 'AUCUN FEU DÉTECTÉ'}
        </div>
      </div>

      <div className="scan-controls">
        <button className="scan-side-btn" onClick={() => navigate('/historique')}>
          <GalleryIcon size={22} />
        </button>
        <button className="scan-shutter" onClick={handleCapture} disabled={analyzing} aria-label="Scanner">
          <span />
        </button>
        <button className="scan-side-btn">
          <VideoIcon size={22} />
        </button>
      </div>

      {fireDetected && <FireAlertModal record={scanHistory[0]} onClose={() => setFireDetected(false)} />}
    </div>
  );
};
