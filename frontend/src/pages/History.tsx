import React, { useState, useEffect } from 'react';
import { DownloadIcon, ShareIcon, FlameIcon, CheckCircleIcon, WarningIcon, EyeIcon } from '../components/icons';
import { FireAlertModal, type AlertRecord } from '../components/FireAlertModal';
import './History.css';

export type ScanStatus = 'fire' | 'safe' | 'warn';

const filters: { key: 'all' | ScanStatus | 'shared'; label: string }[] = [
  { key: 'all', label: 'TOUS' },
  { key: 'fire', label: 'INCENDIES' },
  { key: 'warn', label: 'ALERTES & INTRUSIONS' },
  { key: 'shared', label: 'PARTAGÉS' },
];

const statusMeta: Record<ScanStatus, { label: string; badge: string; Icon: typeof FlameIcon }> = {
  fire: { label: 'FEU', badge: 'badge-fire', Icon: FlameIcon },
  safe: { label: 'SÛR', badge: 'badge-safe', Icon: CheckCircleIcon },
  warn: { label: 'ALERTE', badge: 'badge-warn', Icon: WarningIcon },
};

export const History: React.FC = () => {
  const [filter, setFilter] = useState<'all' | ScanStatus | 'shared'>('all');
  const [history, setHistory] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<AlertRecord | null>(null);

  const fetchHistory = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/alerts/`);
      if (res.ok) {
        const data = await res.json();
        const formattedData: AlertRecord[] = data.map((alert: any) => {
          const dateObj = new Date(alert.date);
          const formattedDate = dateObj.toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          });

          let fullImageUrl = alert.image_url;
          if (fullImageUrl && !fullImageUrl.startsWith('http') && !fullImageUrl.startsWith('data:')) {
            fullImageUrl = `${apiUrl}${fullImageUrl.startsWith('/') ? '' : '/'}${fullImageUrl}`;
          }

          return {
            id: alert.id,
            status: alert.status,
            location: alert.location,
            date: formattedDate,
            confidence: alert.confidence,
            coords: alert.coords || '46.2276°N 2.2137°E',
            image_url: fullImageUrl,
            detection_type: alert.detection_type || (alert.status === 'fire' ? 'fire' : 'person')
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

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 6000);
    return () => clearInterval(interval);
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
              <div 
                className={`timeline-item ${rec.image_url ? 'has-photo' : ''}`} 
                key={rec.id}
                onClick={() => setSelectedAlert(rec)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setSelectedAlert(rec);
                  }
                }}
              >
                <div className={`timeline-icon ${meta.badge}`}>
                  <meta.Icon size={16} />
                </div>
                <div className="timeline-content">
                  <div className="timeline-top">
                    <div className="timeline-top-badges">
                      <span className={`badge ${meta.badge}`}>{meta.label}</span>
                      {rec.image_url && (
                        <span className="timeline-photo-tag">
                          📷 Photo
                        </span>
                      )}
                    </div>
                    <button 
                      type="button"
                      className="timeline-share-btn" 
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        if (navigator.share) {
                          navigator.share({ title: `CamFire: ${rec.location}`, text: `${rec.location} - ${rec.date}` });
                        }
                      }}
                      aria-label="Partager"
                    >
                      <ShareIcon size={15} className="timeline-share" />
                    </button>
                  </div>
                  <strong className="timeline-location">{rec.location}</strong>
                  <span className="timeline-date">{rec.date}</span>

                  {rec.confidence !== undefined && (
                    <div className="confidence">
                      <span className="confidence-label">CONFIANCE</span>
                      <div className="confidence-bar">
                        <div
                          className={`confidence-fill ${rec.status === 'fire' ? 'high' : 'mid'}`}
                          style={{ width: `${rec.confidence > 1 ? rec.confidence : rec.confidence * 100}%` }}
                        />
                      </div>
                      <span className="confidence-value">
                        {Math.round(rec.confidence > 1 ? rec.confidence : rec.confidence * 100)}%
                      </span>
                    </div>
                  )}

                  {rec.image_url && (
                    <div className="timeline-photo-card">
                      <div className="timeline-photo-thumb-wrapper">
                        <img src={rec.image_url} alt="Capture alerte" className="timeline-photo-thumb" />
                        <div className="timeline-photo-overlay">
                          <EyeIcon size={13} /> Voir la photo associée
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedAlert && (
        <FireAlertModal
          record={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          imageUrl={selectedAlert.image_url}
          confidence={selectedAlert.confidence}
        />
      )}
    </div>
  );
};


