import React, { useState, useEffect } from 'react';
import { DownloadIcon, ShareIcon, FlameIcon, CheckCircleIcon, WarningIcon } from '../components/icons';
import type { ScanStatus, ScanRecord } from '../services/mockData';
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
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('http://localhost:8000/alerts/');
        if (res.ok) {
          const data = await res.json();
          const formattedData = data.map((alert: any) => {
            const dateObj = new Date(alert.date);
            const formattedDate = dateObj.toLocaleDateString('fr-FR', {
              day: 'numeric', month: 'long', year: 'numeric',
              hour: '2-digit', minute: '2-digit'
            });
            return {
              ...alert,
              date: formattedDate
            };
          });
          setHistory(formattedData);
        }
      } catch (err) {
        console.error("Erreur lors de la récupération de l'historique", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const items = filter === 'all' || filter === 'shared' ? history : history.filter((r) => r.status === filter);

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
        {loading ? (
          <p className="alerts-empty">Chargement de l'historique...</p>
        ) : items.length === 0 ? (
          <p className="alerts-empty">Aucun historique disponible.</p>
        ) : (
          items.map((rec) => {
            const meta = statusMeta[rec.status as ScanStatus] || statusMeta['safe'];
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
          })
        )}
      </div>
    </div>
  );
};

