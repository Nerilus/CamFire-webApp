import React, { useState } from 'react';
import { FlameIcon, WarningIcon, ChevronRightIcon } from '../components/icons';
import { FireAlertModal } from '../components/FireAlertModal';
import { scanHistory, type ScanRecord } from '../services/mockData';
import './Alerts.css';

export const Alerts: React.FC = () => {
  const [active, setActive] = useState<ScanRecord | null>(null);
  const alerts = scanHistory.filter((r) => r.status === 'fire' || r.status === 'warn');

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">ALERTES</h1>
      </div>

      {alerts.length === 0 ? (
        <p className="alerts-empty">Aucune alerte pour le moment.</p>
      ) : (
        <div className="alerts-list">
          {alerts.map((rec) => (
            <button className="alert-row" key={rec.id} onClick={() => setActive(rec)}>
              <div className={`alert-row-icon ${rec.status === 'fire' ? 'badge-fire' : 'badge-warn'}`}>
                {rec.status === 'fire' ? <FlameIcon size={18} /> : <WarningIcon size={18} />}
              </div>
              <div className="alert-row-content">
                <strong>{rec.location}</strong>
                <span>{rec.date}</span>
              </div>
              <ChevronRightIcon size={18} className="alert-row-chevron" />
            </button>
          ))}
        </div>
      )}

      {active && <FireAlertModal record={active} onClose={() => setActive(null)} />}
    </div>
  );
};
