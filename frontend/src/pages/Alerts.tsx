import React, { useState, useEffect } from 'react';
import { SmokeIcon, WarningIcon, ChevronRightIcon, CalendarIcon, ClockIcon } from '../components/icons';
import { FireAlertModal, type AlertRecord } from '../components/FireAlertModal';
import { formatAlertItem, groupAlertsByDate } from '../utils/dateGrouping';
import { API_URL } from '../config/api';
import './Alerts.css';

export const Alerts: React.FC = () => {
  const [active, setActive] = useState<AlertRecord | null>(null);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch(`${API_URL}/alerts/`);
        if (res.ok) {
          const data = await res.json();
          const formattedData: AlertRecord[] = data.map((alert: any) => formatAlertItem(alert, API_URL));
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

  const groupedAlerts = groupAlertsByDate(alerts);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">ALERTES</h1>
      </div>

      {loading ? (
        <p className="alerts-empty">Chargement des alertes...</p>
      ) : groupedAlerts.length === 0 ? (
        <p className="alerts-empty">Aucune alerte pour le moment.</p>
      ) : (
        <div className="alerts-date-groups">
          {groupedAlerts.map((group) => (
            <div className="alerts-date-group" key={group.dateKey}>
              <div className="date-group-header">
                <div className="date-group-pill">
                  <CalendarIcon size={15} className="date-group-icon" />
                  <span className="date-group-title">{group.label}</span>
                  {group.subLabel && <span className="date-group-sub">({group.subLabel})</span>}
                </div>
                <span className="date-group-badge">
                  {group.items.length} alerte{group.items.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="alerts-list">
                {group.items.map((rec) => (
                  <button className="alert-row" key={rec.id} onClick={() => setActive(rec)}>
                    <div className={`alert-row-icon ${rec.status === 'fire' ? 'badge-fire' : 'badge-warn'}`}>
                      {rec.status === 'fire' ? <SmokeIcon size={18} /> : <WarningIcon size={18} />}
                    </div>
                    <div className="alert-row-content">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong>{rec.location}</strong>
                        {rec.image_url && (
                          <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                            Photo
                          </span>
                        )}
                      </div>
                      <span className="alert-row-time">
                        <ClockIcon size={12} style={{ display: 'inline', verticalAlign: '-1px', marginRight: '4px' }} />
                        {rec.formattedTime ? `À ${rec.formattedTime}` : rec.date}
                        {rec.coords && ` • ${rec.coords}`}
                      </span>
                    </div>
                    <ChevronRightIcon size={18} className="alert-row-chevron" />
                  </button>
                ))}
              </div>
            </div>
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
