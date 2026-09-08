import React, { useEffect, useRef, useState } from 'react';
import { XIcon, MaximizeIcon, MinimizeIcon, CameraIcon } from './icons';
import './VideoModal.css';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamUrl: string;
  cameraName?: string;
  statusText?: string;
}

export const VideoModal: React.FC<VideoModalProps> = ({
  isOpen,
  onClose,
  streamUrl,
  cameraName = 'Caméra de Surveillance',
  statusText = 'Analyse IA YOLO active',
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

        <div className="video-modal-body">
          {streamUrl ? (
            <img
              src={streamUrl}
              alt="Flux caméra agrandi"
              className="video-modal-img"
            />
          ) : (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔒</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>Flux vidéo indisponible</div>
              <p style={{ fontSize: '13px', marginTop: '6px' }}>Aucun appareil connecté à votre compte.</p>
            </div>
          )}
        </div>

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
