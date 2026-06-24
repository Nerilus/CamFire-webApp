import React, { useState } from 'react';
import { DownloadIcon, ShareIcon, FlameIcon, CheckCircleIcon, WarningIcon } from '../components/icons';
import { scanHistory, type ScanStatus } from '../services/mockData';
import './History.css';

const filters: { key: 'all' | ScanStatus | 'shared'; label: string }[] = [
  { key: 'all', label: 'TOUS' },
  { key: 'fire', label: 'INCENDIES' },
  { key: 'warn', label: 'FAUSSES ALERTES' },
  { key: 'shared', label: 'PARTAGÉS' },
];

const statusMeta: Record<ScanStatus, { label: string; badge: string; Icon: typeof FlameIcon }> = {
  fire: { label: 'FEU', badge: 'badge-fire', Icon: FlameIcon },
  safe: { label: 'SÛR', badge: 'badge-safe', Icon: CheckCircleIcon },
  warn: { label: 'ALERTE', badge: 'badge-warn', Icon: WarningIcon },
};

export const History: React.FC = () => {
  const [filter, setFilter] = useState<'all' | ScanStatus | 'shared'>('all');

  const items = filter === 'all' || filter === 'shared' ? scanHistory : scanHistory.filter((r) => r.status === filter);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">HISTORIQUE</h1>
        <button className="btn btn-dark pdf-btn">
          <DownloadIcon size={15} /> PDF
        </button>
      </div>

      <div className="history-filters">
        {filters.map((f) => (
          <button
            key={f.key}
            className={`history-filter${filter === f.key ? ' active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="timeline">
        {items.map((rec) => {
          const meta = statusMeta[rec.status];
          return (
            <div className="timeline-item" key={rec.id}>
              <div className={`timeline-icon ${meta.badge}`}>
                <meta.Icon size={16} />
              </div>
              <div className="timeline-content">
                <div className="timeline-top">
                  <span className={`badge ${meta.badge}`}>{meta.label}</span>
                  <ShareIcon size={15} className="timeline-share" />
                </div>
                <strong className="timeline-location">{rec.location}</strong>
                <span className="timeline-date">{rec.date}</span>
                {rec.confidence !== undefined && (
                  <div className="confidence">
                    <span className="confidence-label">CONFIANCE</span>
                    <div className="confidence-bar">
                      <div
                        className={`confidence-fill ${rec.status === 'fire' ? 'high' : 'mid'}`}
                        style={{ width: `${rec.confidence}%` }}
                      />
                    </div>
                    <span className="confidence-value">{rec.confidence}%</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
