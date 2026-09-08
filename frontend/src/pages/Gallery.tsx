import React, { useRef, useState, useEffect } from 'react';
import { useMedia, hashFile } from '../context/MediaContext';
import { FireAlertModal } from '../components/FireAlertModal';
import { UploadIcon, XIcon, CheckCircleIcon, WarningIcon, ClockIcon } from '../components/icons';
import { captureService, type CaptureItem } from '../services/captureService';
import { scanService } from '../services/scanService';
import './Gallery.css';

export const Gallery: React.FC = () => {
  const { items, addMedia, updateMediaStatus } = useMedia();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dbCaptures, setDbCaptures] = useState<CaptureItem[]>([]);
  const [loadingCaptures, setLoadingCaptures] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [isDragOver, setIsDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentMediaId, setCurrentMediaId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'photo' | 'video' | null>(null);
  const [analysisData, setAnalysisData] = useState<{ fire_detected: boolean, confidence: number, gradcam_base64?: string | null } | null>(null);
  const [alreadyAnalyzed, setAlreadyAnalyzed] = useState(false);
  const [alertImage, setAlertImage] = useState<{ url: string; confidence?: number; title?: string } | null>(null);

  const loadCaptures = async () => {
    try {
      const caps = await captureService.getCaptures();
      setDbCaptures(caps);
    } catch (e) {
      console.error('Erreur chargement captures:', e);
    } finally {
      setLoadingCaptures(false);
    }
  };

  useEffect(() => {
    loadCaptures();
    // Rafraîchissement périodique (toutes les 6 secondes) pour afficher les photos dès qu'une personne est détectée en direct
    const interval = setInterval(loadCaptures, 6000);
    return () => clearInterval(interval);
  }, []);

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
      const hasFire = res.detections && res.detections.some((d: any) => d.class !== 'person');
      const maxConf = (res.detections && res.detections.length > 0)
        ? Math.max(...res.detections.map((d: any) => d.confidence))
        : 0;

      setAnalysisData({ fire_detected: hasFire, confidence: maxConf, gradcam_base64: res.image_base64 });
      setResult(hasFire);
      if (mediaId) updateMediaStatus(mediaId, hasFire ? 'fire' : 'safe', maxConf);

      // Recharger les captures réelles enregistrées sur le serveur
      loadCaptures();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'analyse par l'IA");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteDbCapture = async (id: number) => {
    try {
      const ok = await captureService.deleteCapture(id);
      if (ok) {
        setDbCaptures(prev => prev.filter(c => c.id !== id));
      }
    } catch (e) {
      console.error('Erreur suppression capture:', e);
    }
  };

  const handleClearAllCaptures = async () => {
    if (!window.confirm("Voulez-vous supprimer toutes les captures enregistrées ?")) return;
    try {
      await Promise.all(dbCaptures.map(c => captureService.deleteCapture(c.id)));
      setDbCaptures([]);
    } catch (e) {
      console.error('Erreur vidage captures:', e);
    }
  };

  // Filtrer les captures réelles
  const filteredDbCaptures = dbCaptures.filter((c) => {
    if (filterType === 'all') return true;
    return c.detection_type === filterType;
  });

  return (
    <div className="page gallery-page">
      <div className="page-header">
        <h1 className="page-title">GALERIE DE SURVEILLANCE</h1>
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
          <strong>{isDragOver ? 'Déposez ici !' : 'Importer une photo / vidéo pour analyse IA'}</strong>
          <span>JPEG · PNG · MP4 · MOV</span>
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

      {previewUrl && (
        <button 
          className="btn btn-flame gallery-analyze-btn" 
          onClick={handleAnalyze} 
          disabled={analyzing || !previewUrl || alreadyAnalyzed}
          style={{ marginBottom: '24px' }}
        >
          {analyzing
            ? 'ANALYSE EN COURS…'
            : alreadyAnalyzed
              ? 'DÉJÀ ANALYSÉE'
              : `ANALYSER LA ${previewType === 'video' ? 'VIDÉO' : 'PHOTO'}`}
        </button>
      )}

      {/* Onglets de filtrage des captures réelles */}
      <div className="history-filters" style={{ marginBottom: '16px' }}>
        <button 
          className={`history-filter ${filterType === 'all' ? 'active' : ''}`}
          onClick={() => setFilterType('all')}
        >
          TOUTES ({dbCaptures.length})
        </button>
        <button 
          className={`history-filter ${filterType === 'person' ? 'active' : ''}`}
          onClick={() => setFilterType('person')}
        >
          👤 PERSONNES ({dbCaptures.filter(c => c.detection_type === 'person').length})
        </button>
        <button 
          className={`history-filter ${filterType === 'fire' ? 'active' : ''}`}
          onClick={() => setFilterType('fire')}
        >
          🔥 FEU ({dbCaptures.filter(c => c.detection_type === 'fire').length})
        </button>
        <button 
          className={`history-filter ${filterType === 'manual' ? 'active' : ''}`}
          onClick={() => setFilterType('manual')}
        >
          📁 MANUELLES ({dbCaptures.filter(c => c.detection_type === 'manual').length})
        </button>
      </div>

      <div className="gallery-recent-header">
        <span className="gallery-section-title">PHOTOS & CAPTURES DÉTECTÉES EN TEMPS RÉEL</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="gallery-count">
            {filteredDbCaptures.length} capture{filteredDbCaptures.length > 1 ? 's' : ''}
          </span>
          {filteredDbCaptures.length > 0 && (
            <button
              onClick={handleClearAllCaptures}
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: 600
              }}
              title="Vider toutes les captures"
            >
              Tout effacer
            </button>
          )}
        </div>
      </div>

      {loadingCaptures ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-faint)' }}>
          Chargement des captures de surveillance...
        </div>
      ) : filteredDbCaptures.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '36px 20px', 
          background: 'var(--surface)', 
          border: '1px dashed var(--border)', 
          borderRadius: '16px',
          color: 'var(--text-faint)' 
        }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>📷</div>
          <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>Aucune capture pour le moment</strong>
          <span style={{ fontSize: '12px' }}>
            Dès qu'une personne ou un feu est détecté par le Raspberry Pi, la photo prise apparaîtra ici automatiquement.
          </span>
        </div>
      ) : (
        <div className="gallery-grid">
          {filteredDbCaptures.map((c) => {
            const isPerson = c.detection_type === 'person';
            const isFire = c.detection_type === 'fire';
            const dateObj = new Date(c.created_at);
            const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const dateStr = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

            const badgeClass = isFire ? 'badge-fire' : isPerson ? 'badge-warn' : 'badge-safe';
            const badgeLabel = isFire ? 'FEU DÉTECTÉ' : isPerson ? 'PERSONNE DÉTECTÉE' : 'SÛR';
            const IconComponent = isFire ? WarningIcon : isPerson ? WarningIcon : CheckCircleIcon;

            return (
              <div
                className="gallery-card gallery-card-clickable"
                key={c.id}
                onClick={() => setAlertImage({ 
                  url: c.image_url, 
                  confidence: c.confidence, 
                  title: `${badgeLabel} (${c.location || 'Site'})` 
                })}
                role="button"
                tabIndex={0}
              >
                <div className="gallery-card-thumb">
                  <img src={c.image_url} alt={`Capture ${c.detection_type}`} loading="lazy" />
                  <button
                    className="gallery-card-remove"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      handleDeleteDbCapture(c.id); 
                    }}
                    aria-label="Supprimer la capture"
                    title="Supprimer définitivement cette photo"
                  >
                    <XIcon size={12} />
                  </button>
                </div>
                <span className={`badge ${badgeClass} gallery-card-badge`}>
                  <IconComponent size={11} />
                  {badgeLabel} {c.confidence ? `${Math.round(c.confidence)}%` : ''}
                </span>
                <div className="gallery-card-meta">
                  <strong>{dateStr} à {timeStr}</strong>
                  <span>{c.location || 'Raspberry 4'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal d'aperçu d'alerte / preuve photo */}
      {(result || alertImage) && (
        <FireAlertModal
          record={{
            id: 'real-alert',
            status: alertImage?.title?.includes('FEU') ? 'fire' : 'warn',
            location: alertImage?.title || 'Surveillance CamFire - Détection IA',
            date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
            coords: '46.2276°N 2.2137°E',
            confidence: alertImage?.confidence ? Math.round(alertImage.confidence) : 90
          }}
          onClose={() => { setResult(false); setAlertImage(null); }}
          imageUrl={(alertImage ? alertImage.url : analysisData?.gradcam_base64) || null}
          confidence={alertImage?.confidence ? (alertImage.confidence > 1 ? alertImage.confidence / 100 : alertImage.confidence) : analysisData?.confidence}
        />
      )}
    </div>
  );
};
