import React, { useRef, useState } from 'react';
import { useMedia, hashFile } from '../context/MediaContext';
import { FireAlertModal } from '../components/FireAlertModal';
import { UploadIcon, FlameIcon, VideoIcon, XIcon, CheckCircleIcon, WarningIcon, ClockIcon } from '../components/icons';
import { scanHistory } from '../services/mockData';
import { scanService } from '../services/scanService';
import './Gallery.css';

export const Gallery: React.FC = () => {
  const { items, addMedia, updateMediaStatus, removeMedia } = useMedia();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentMediaId, setCurrentMediaId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'photo' | 'video' | null>(null);
  const [analysisData, setAnalysisData] = useState<{ fire_detected: boolean, confidence: number, gradcam_base64?: string | null } | null>(null);
  const [alreadyAnalyzed, setAlreadyAnalyzed] = useState(false);
  const [alertImage, setAlertImage] = useState<{ url: string; confidence?: number } | null>(null);

  const mediaLabel = previewType === 'video' ? 'vidéo' : 'photo';

  const processFile = async (file: File) => {
    setSelectedFile(file);
    setPreviewType(file.type.startsWith('video') ? 'video' : 'photo');

    const id = await hashFile(file);
    const existing = items.find((m) => m.id === id);

    if (existing) {
      // Même contenu d'image déjà présent (quelle que soit la méthode d'import) :
      // on réutilise son entrée sans la déplacer ni la dupliquer.
      setPreviewUrl(existing.url);
      setCurrentMediaId(existing.id);
      if (existing.status !== 'pending') {
        setAnalysisData({ fire_detected: existing.status === 'fire', confidence: existing.confidence ?? 0 });
        setAlreadyAnalyzed(true);
      } else {
        setAnalysisData(null);
        setAlreadyAnalyzed(false);
      }
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setAnalysisData(null);
    setAlreadyAnalyzed(false);
    const newId = addMedia(file.type.startsWith('video') ? 'video' : 'photo', url, file, id);
    setCurrentMediaId(newId);
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
    setCurrentMediaId(null);
    setPreviewUrl(null);
    setPreviewType(null);
    setAnalysisData(null);
    setAlreadyAnalyzed(false);
  };

  const extractFrameFromVideo = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.playsInline = true;
      
      video.onloadeddata = () => {
        // Avancer la vidéo à 1 seconde (ou au quart) pour éviter une image noire au tout début
        video.currentTime = Math.min(1, video.duration * 0.25 || 0);
      };
      
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Impossible d'extraire l'image"));
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(video.src);
          if (blob) resolve(blob);
          else reject(new Error("Erreur de conversion de l'image"));
        }, 'image/jpeg', 0.9);
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error("Erreur lors du chargement de la vidéo"));
      };
    });
  };

  const handleAnalyze = async () => {
    const fileToAnalyze = selectedFile ?? items[0]?.file ?? null;
    const mediaId = currentMediaId ?? items[0]?.id ?? null;
    if (!fileToAnalyze) {
      alert("Veuillez d'abord importer une photo ou une vidéo !");
      return;
    }
    setAnalyzing(true);
    try {
      let finalFile: Blob = fileToAnalyze;
      
      // Si c'est une vidéo, on extrait une image (frame) pour l'envoyer à l'IA
      if (fileToAnalyze.type.startsWith('video/')) {
        finalFile = await extractFrameFromVideo(fileToAnalyze as File);
      }
      
      const res = await scanService.predictImage(finalFile);
      setAnalysisData(res);
      setResult(res.fire_detected);
      if (mediaId) updateMediaStatus(mediaId, res.fire_detected ? 'fire' : 'safe', res.confidence);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'analyse par l'IA");
    } finally {
      setAnalyzing(false);
    }
  };

  const recentStatusBadge: Record<string, { label: string; className: string; Icon: React.FC<{ size?: number }> }> = {
    pending: { label: 'NON ANALYSÉE', className: 'badge-pending', Icon: ClockIcon },
    fire: { label: 'DANGER', className: 'badge-fire', Icon: WarningIcon },
    safe: { label: 'SÛR', className: 'badge-safe', Icon: CheckCircleIcon },
  };

  const recentCaptures = items.map((m) => ({
    key: m.id,
    thumb: m.url,
    isVideo: m.type === 'video',
    status: m.status,
    badge: recentStatusBadge[m.status].label,
    badgeClass: recentStatusBadge[m.status].className,
    BadgeIcon: recentStatusBadge[m.status].Icon,
    time: new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    location: 'Nouvelle capture',
    removable: true,
    onRemove: () => removeMedia(m.id),
    onView: () => setAlertImage({ url: m.url, confidence: m.confidence }),
  }));

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

          {alreadyAnalyzed && !analyzing && (
            <div className="gallery-already-analyzed">
              <ClockIcon size={13} />
              <span>Photo déjà analysée, résultat conservé.</span>
              <button type="button" onClick={() => setAlreadyAnalyzed(false)}>
                Réanalyser quand même
              </button>
            </div>
          )}
        </div>
      )}

      <div className="gallery-recent-header">
        <span className="gallery-section-title">CAPTURES RÉCENTES</span>
        <span className="gallery-count">{recentCaptures.length} élément{recentCaptures.length > 1 ? 's' : ''}</span>
      </div>

      <div className="gallery-grid">
        {recentCaptures.map((c) => (
          <div
            className={`gallery-card${c.status === 'fire' ? ' gallery-card-clickable' : ''}`}
            key={c.key}
            onClick={c.status === 'fire' ? c.onView : undefined}
            role={c.status === 'fire' ? 'button' : undefined}
            tabIndex={c.status === 'fire' ? 0 : undefined}
          >
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
              {c.removable && (
                <button
                  className="gallery-card-remove"
                  onClick={(e) => { e.stopPropagation(); c.onRemove(); }}
                  aria-label="Supprimer la capture"
                >
                  <XIcon size={12} />
                </button>
              )}
            </div>
            <span className={`badge ${c.badgeClass} gallery-card-badge`}>
              <c.BadgeIcon size={11} />
              {c.badge}
            </span>
            <div className="gallery-card-meta">
              <strong>{c.time}</strong>
              <span>{c.location}</span>
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn-flame gallery-analyze-btn" onClick={handleAnalyze} disabled={analyzing || !previewUrl || alreadyAnalyzed}>
        {analyzing
          ? 'ANALYSE EN COURS…'
          : alreadyAnalyzed
            ? 'DÉJÀ ANALYSÉE'
            : `ANALYSER LA ${previewType === 'video' ? 'VIDÉO' : 'PHOTO'}`}
      </button>

      {(result || alertImage) && (
        <FireAlertModal
          record={scanHistory[0]}
          onClose={() => { setResult(false); setAlertImage(null); }}
          imageUrl={(alertImage ? alertImage.url : analysisData?.gradcam_base64) || null}
          confidence={alertImage ? alertImage.confidence : analysisData?.confidence}
        />
      )}
    </div>
  );
};
