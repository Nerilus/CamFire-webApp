import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NearbyAlertBanner } from '../components/NearbyAlertBanner';
import { FlameIcon } from '../components/icons';
import './Home.css';

const SCAN_INTERVAL = 60;

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [showAlert, setShowAlert] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(SCAN_INTERVAL - 36);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? SCAN_INTERVAL : s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const progress = secondsLeft / SCAN_INTERVAL;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

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
          <div className="last-scan">
            <span className="last-scan-label">DERNIER SCAN</span>
            <span className="last-scan-value">il y a 2 min · Sûr</span>
          </div>
        </div>

        <div className="scan-now-wrap">
          <button className="scan-now-btn" onClick={() => navigate('/scan')}>
            <FlameIcon size={48} />
            <span>SCANNER</span>
          </button>
        </div>

        <div className="countdown-wrap">
          <svg width="130" height="130" viewBox="0 0 130 130">
            <circle cx="65" cy="65" r={radius} stroke="#1f1f27" strokeWidth="8" fill="none" />
            <circle
              cx="65"
              cy="65"
              r={radius}
              stroke="url(#grad)"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              transform="rotate(-90 65 65)"
            />
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff4500" />
                <stop offset="100%" stopColor="#ff8c00" />
              </linearGradient>
            </defs>
          </svg>
          <div className="countdown-center">
            <span className="countdown-value">{secondsLeft}</span>
            <span className="countdown-unit">SEC</span>
          </div>
        </div>
        <p className="countdown-label">PROCHAIN SCAN AUTOMATIQUE</p>
      </div>
    </div>
  );
};
