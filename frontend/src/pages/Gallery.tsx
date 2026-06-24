import React, { useRef, useState } from 'react';
import { useMedia } from '../context/MediaContext';
import { FireAlertModal } from '../components/FireAlertModal';
import { UploadIcon, FlameIcon, VideoIcon } from '../components/icons';
import { scanHistory, type ScanStatus } from '../services/mockData';
import './Gallery.css';

const statusBadge: Record<ScanStatus, string> = {
  fire: 'DANGER',
  safe: 'SÛR',
  warn: 'ALERTE',
};

export const Gallery: React.FC = () => {
  const { items, addMedia } = useMedia();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    addMedia(file.type.startsWith('video') ? 'video' : 'photo', url);
    e.target.value = '';
  };

  const handleAnalyze = () => {
    setAnalyzing(true);
    setTimeout(() => {
      setAnalyzing(false);
      setResult(true);
    }, 1400);
  };

  const recentCaptures = [
    ...items.map((m) => ({
      key: m.id,
      thumb: m.url,
      isVideo: m.type === 'video',
      badge: 'EN ATTENTE',
      badgeClass: 'badge-warn',
      time: new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      location: 'Nouvelle capture',
    })),
    ...scanHistory.map((r) => ({
      key: r.id,
      thumb: null,
      isVideo: false,
      badge: statusBadge[r.status],
      badgeClass: `badge-${r.status === 'fire' ? 'fire' : r.status === 'safe' ? 'safe' : 'warn'}`,
      time: r.date.split(', ')[1] ?? r.date,
      location: r.location.split(',').pop()?.trim() ?? r.location,
    })),
  ].slice(0, 6);

  return (
    <div className="page gallery-page">
      <div className="page-header">
        <h1 className="page-title">IMPORTER UN MÉDIA</h1>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <button className="gallery-dropzone" onClick={() => fileInputRef.current?.click()}>
        <UploadIcon size={26} />
        <strong>Déposer ou appuyer pour importer une photo/vidéo</strong>
        <span>JPEG · MP4 · MOV</span>
      </button>

      <div className="gallery-recent-header">
        <span className="gallery-section-title">CAPTURES RÉCENTES</span>
        <span className="gallery-count">{recentCaptures.length} élément{recentCaptures.length > 1 ? 's' : ''}</span>
      </div>

      <div className="gallery-grid">
        {recentCaptures.map((c) => (
          <div className="gallery-card" key={c.key}>
            <div className="gallery-card-thumb">
              {c.thumb ? (
                c.isVideo ? <video src={c.thumb} muted playsInline /> : <img src={c.thumb} alt="Capture" />
              ) : (
                <FlameIcon size={22} className="gallery-card-placeholder" />
              )}
              {c.isVideo && (
                <span className="gallery-video-badge">
                  <VideoIcon size={12} />
                </span>
              )}
              <span className={`badge ${c.badgeClass} gallery-card-badge`}>{c.badge}</span>
            </div>
            <div className="gallery-card-meta">
              <strong>{c.time}</strong>
              <span>{c.location}</span>
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn-flame gallery-analyze-btn" onClick={handleAnalyze} disabled={analyzing}>
        {analyzing ? 'ANALYSE EN COURS…' : 'ANALYSER'}
      </button>

      {result && <FireAlertModal record={scanHistory[0]} onClose={() => setResult(false)} />}
    </div>
  );
};
