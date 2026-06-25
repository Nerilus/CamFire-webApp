import React, { useRef, useState } from 'react';
import { useMedia } from '../context/MediaContext';
import { FireAlertModal } from '../components/FireAlertModal';
import { UploadIcon, FlameIcon, VideoIcon, XIcon, CheckCircleIcon, WarningIcon } from '../components/icons';
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
  const [isDragOver, setIsDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'photo' | 'video' | null>(null);
  const [analysisData, setAnalysisData] = useState<{ fire_detected: boolean, confidence: number, gradcam_base64?: string | null } | null>(null);

  const mediaLabel = previewType === 'video' ? 'vidéo' : 'photo';

  const processFile = (file: File) => {
    setSelectedFile(file);
    setAnalysisData(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setPreviewType(file.type.startsWith('video') ? 'video' : 'photo');
    addMedia(file.type.startsWith('video') ? 'video' : 'photo', url, file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleRemovePreview = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setPreviewType(null);
    setAnalysisData(null);
  };

  const handleAnalyze = async () => {
    // Si l'état local a été perdu (ex: changement de page puis retour),
    // on retombe sur le dernier média importé conservé dans le contexte partagé.
    const fileToAnalyze = selectedFile ?? items[0]?.file ?? null;
    if (!fileToAnalyze) {
      alert("Veuillez d'abord importer une photo ou une vidéo !");
      return;
    }
    setAnalyzing(true);
    try {
      const res = await scanService.predictImage(fileToAnalyze);
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

      {!previewUrl ? (
        <button
          className={`gallery-dropzone${isDragOver ? ' drag-over' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <UploadIcon size={26} />
          <strong>{isDragOver ? 'Déposez ici !' : 'Déposer ou appuyer pour importer une photo/vidéo'}</strong>
          <span>JPEG · MP4 · MOV</span>
        </button>
      ) : (
        <div className={`gallery-preview-card${analyzing ? ' is-analyzing' : ''}${analysisData ? (analysisData.fire_detected ? ' is-danger' : ' is-safe') : ''}`}>
          <button className="gallery-preview-remove" onClick={handleRemovePreview} aria-label="Retirer le média">
            <XIcon size={16} />
          </button>

          <div className="gallery-preview-media">
            {previewType === 'video' ? (
              <video src={previewUrl} muted playsInline autoPlay loop />
            ) : (
              <img src={analysisData?.gradcam_base64 || previewUrl} alt="Aperçu" />
            )}
            {analyzing && (
              <div className="gallery-scan-overlay">
                <div className="gallery-scan-beam" />
              </div>
            )}
          </div>

          <div className="gallery-preview-status">
            {analyzing ? (
              <>
                <span className="gallery-spinner" />
                <span>Analyse de la {mediaLabel} en cours…</span>
              </>
            ) : analysisData ? (
              analysisData.fire_detected ? (
                <>
                  <WarningIcon size={16} />
                  <span>Danger détecté ({Math.round(analysisData.confidence * 100)}%)</span>
                </>
              ) : (
                <>
                  <CheckCircleIcon size={16} />
                  <span>Aucun danger détecté</span>
                </>
              )
            ) : (
              <span>{previewType === 'video' ? 'Vidéo' : 'Photo'} prête à être analysée</span>
            )}
          </div>
        </div>
      )}

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

      <button className="btn btn-flame gallery-analyze-btn" onClick={handleAnalyze} disabled={analyzing || !previewUrl}>
        {analyzing ? 'ANALYSE EN COURS…' : `ANALYSER LA ${previewType === 'video' ? 'VIDÉO' : 'PHOTO'}`}
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
