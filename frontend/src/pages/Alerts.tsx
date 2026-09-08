import React, { useState, useEffect } from 'react';
import { FlameIcon, WarningIcon, ChevronRightIcon } from '../components/icons';
import { FireAlertModal, type AlertRecord } from '../components/FireAlertModal';
import './Alerts.css';

export const Alerts: React.FC = () => {
  const [active, setActive] = useState<AlertRecord | null>(null);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const res = await fetch(`${apiUrl}/alerts/`);
        if (res.ok) {
          const data = await res.json();
          // Formater la date pour l'affichage (ex: 21 juillet 2026, 18:05)
          const formattedData = data.map((alert: any) => {
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
              ...alert,
              date: formattedDate,
              image_url: fullImageUrl,
            };
          });
          setAlerts(formattedData);
        }
      } catch (err) {
        console.error("Erreur lors de la récupération des alertes", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">ALERTES</h1>
      </div>

      {loading ? (
        <p className="alerts-empty">Chargement des alertes...</p>
      ) : alerts.length === 0 ? (
        <p className="alerts-empty">Aucune alerte pour le moment.</p>
      ) : (
        <div className="alerts-list">
          {alerts.map((rec) => (
            <button className="alert-row" key={rec.id} onClick={() => setActive(rec)}>
              <div className={`alert-row-icon ${rec.status === 'fire' ? 'badge-fire' : 'badge-warn'}`}>
                {rec.status === 'fire' ? <FlameIcon size={18} /> : <WarningIcon size={18} />}
              </div>
              <div className="alert-row-content">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong>{rec.location}</strong>
                  {rec.image_url && <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>📷 Photo</span>}
                </div>
                <span>{rec.date}</span>
              </div>
              <ChevronRightIcon size={18} className="alert-row-chevron" />
            </button>
          ))}
        </div>
      )}

      {active && (
        <FireAlertModal 
          record={active} 
          onClose={() => setActive(null)} 
          imageUrl={active.image_url} 
          confidence={active.confidence} 
        />
      )}
    </div>
  );
};
