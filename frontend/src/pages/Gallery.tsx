import React, { useRef, useState } from 'react';
import { useMedia } from '../context/MediaContext';
import { FireAlertModal } from '../components/FireAlertModal';
import { UploadIcon, FlameIcon, VideoIcon } from '../components/icons';
import { scanHistory, type ScanStatus } from '../services/mockData';
import { scanService } from '../services/scanService';
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisData, setAnalysisData] = useState<{fire_detected: boolean, confidence: number, gradcam_base64?: string | null} | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setAnalysisData(null);
    const url = URL.createObjectURL(file);
    addMedia(file.type.startsWith('video') ? 'video' : 'photo', url);
    e.target.value = '';
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      alert("Veuillez d'abord importer un fichier !");
      return;
    }
    setAnalyzing(true);
    try {
      const res = await scanService.predictImage(selectedFile);
      setAnalysisData(res);
      setResult(res.fire_detected);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'analyse par l'IA");
    } finally {
      setAnalyzing(false);
    }
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
        {recentCaptures.map((c, i) => {
          let thumb = c.thumb;
          let badge = c.badge;
          let badgeClass = c.badgeClass;

          // Si c'est le fichier qu'on vient d'analyser (le plus récent)
          if (i === 0 && analysisData) {
            if (analysisData.gradcam_base64) thumb = analysisData.gradcam_base64;
            badge = analysisData.fire_detected ? `DANGER (${Math.round(analysisData.confidence * 100)}%)` : 'SÛR';
            badgeClass = analysisData.fire_detected ? 'badge-fire' : 'badge-safe';
          }

          return (
            <div className="gallery-card" key={c.key} onClick={() => {
              if (i === 0 && analysisData && analysisData.fire_detected) {
                setResult(true);
              }
            }} style={{ cursor: (i === 0 && analysisData && analysisData.fire_detected) ? 'pointer' : 'default' }}>
              <div className="gallery-card-thumb">
                {thumb ? (
                  c.isVideo ? <video src={thumb} muted playsInline /> : <img src={thumb} alt="Capture" />
                ) : (
                  <FlameIcon size={22} className="gallery-card-placeholder" />
                )}
                {c.isVideo && (
                  <span className="gallery-video-badge">
                    <VideoIcon size={12} />
                  </span>
                )}
                <span className={`badge ${badgeClass} gallery-card-badge`}>{badge}</span>
              </div>
              <div className="gallery-card-meta">
                <strong>{c.time}</strong>
                <span>{c.location}</span>
              </div>
            </div>
          );
        })}
      </div>

      <button className="btn btn-flame gallery-analyze-btn" onClick={handleAnalyze} disabled={analyzing}>
        {analyzing ? 'ANALYSE EN COURS…' : 'ANALYSER'}
      </button>

      {result && (
        <FireAlertModal 
          record={scanHistory[0]} 
          onClose={() => setResult(false)} 
          imageUrl={analysisData?.gradcam_base64 || null}
          confidence={analysisData?.confidence}
        />
      )}
    </div>
  );
};
