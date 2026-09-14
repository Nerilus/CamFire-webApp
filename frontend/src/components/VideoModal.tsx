import React, { useEffect, useRef, useState } from 'react';
import { XIcon, MaximizeIcon, MinimizeIcon, CameraIcon, LockIcon, WrenchIcon } from './icons';
import { DeviceLiveControls, type DeviceLike } from './DeviceLiveControls';
import './VideoModal.css';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamUrl: string;
  cameraName?: string;
  statusText?: string;
  device?: DeviceLike | null;
  onDeviceUpdate?: (updated: Partial<DeviceLike>) => void;
}

export const VideoModal: React.FC<VideoModalProps> = ({
  isOpen,
  onClose,
  streamUrl,
  cameraName = 'Caméra de Surveillance',
  statusText = 'Surveillance continue active',
  device,
  onDeviceUpdate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          onClose();
        }
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isOpen, onClose]);

  const toggleBrowserFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Erreur plein écran:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="video-modal-backdrop" onClick={onClose}>
      <div
        ref={containerRef}
        className="video-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="video-modal-header">
          <div className="video-modal-title-group">
            <div className="video-modal-badge">
              <span className="live-pulse"></span>
              EN DIRECT
            </div>
            <div className="video-modal-title">{cameraName}</div>
          </div>

          <div className="video-modal-actions">
            <button
              className="video-modal-btn"
              onClick={toggleBrowserFullscreen}
              title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran complet'}
            >
              {isFullscreen ? <MinimizeIcon size={18} /> : <MaximizeIcon size={18} />}
            </button>
            <button
              className="video-modal-btn video-modal-close"
              onClick={onClose}
              title="Fermer (Échap)"
            >
              <XIcon size={18} />
            </button>
          </div>
        </div>

        <div className="video-modal-body" style={{ position: 'relative' }}>
          {device?.is_maintenance_mode && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: '#090d16',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              zIndex: 3,
              color: '#f8fafc',
              textAlign: 'center',
              padding: '24px'
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(234, 179, 8, 0.15)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#eab308'
              }}>
                <WrenchIcon size={28} />
              </div>
              <strong style={{ fontSize: '18px', letterSpacing: '0.5px' }}>MODE TRAVAUX ACTIF</strong>
              <span style={{ fontSize: '13px', color: '#94a3b8', maxWidth: '380px', lineHeight: 1.5 }}>
                Écran noir de protection de la vie privée. La détection IA, les e-mails d'alerte et les notifications sont suspendus.
              </span>
              <span style={{
                fontSize: '12px',
                color: '#eab308',
                background: 'rgba(234, 179, 8, 0.1)',
                padding: '4px 12px',
                borderRadius: '20px',
                border: '1px solid rgba(234, 179, 8, 0.25)'
              }}>
                {device.maintenance_until ? `Jusqu'à ${new Date(device.maintenance_until).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'Surveillance en pause'}
              </span>
            </div>
          )}

          {streamUrl ? (
            <img
              src={streamUrl}
              alt="Flux caméra agrandi"
              className="video-modal-img"
            />
          ) : (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', color: '#f87171' }}>
                <LockIcon size={36} />
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>Flux vidéo indisponible</div>
              <p style={{ fontSize: '13px', marginTop: '6px' }}>Aucun appareil connecté à votre compte.</p>
            </div>
          )}
        </div>

        {device && (
          <div className="video-modal-controls-wrap">
            <DeviceLiveControls device={device} onDeviceUpdate={onDeviceUpdate} />
          </div>
        )}

        <div className="video-modal-footer">
          <div className="video-modal-info-chip">
            <CameraIcon size={14} />
            <span>{statusText}</span>
          </div>
          <div>Qualité: 640x480 (Fluidité Temps Réel)</div>
        </div>
      </div>
    </div>
  );
};
