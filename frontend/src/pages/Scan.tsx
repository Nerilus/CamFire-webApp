import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlashIcon, RefreshIcon, GalleryIcon, VideoIcon, UploadIcon } from '../components/icons';
import { FireAlertModal } from '../components/FireAlertModal';
import { scanHistory } from '../services/mockData';
import { useMedia } from '../context/MediaContext';
import { scanService } from '../services/scanService';
import './Scan.css';

type FacingMode = 'environment' | 'user';

export const Scan: React.FC = () => {
  const navigate = useNavigate();
  const { addMedia } = useMedia();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [facingMode, setFacingMode] = useState<FacingMode>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [fireDetected, setFireDetected] = useState(false);
  const [confidence, setConfidence] = useState<number>(0);
  const [gradcamImage, setGradcamImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | Blob | null>(null);

  useEffect(() => {
    let active = true;

    const startCamera = async () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setCameraError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        setCameraError(
          "Impossible d'accéder à la caméra. Vérifiez les autorisations de votre navigateur."
        );
      }
    };

    startCamera();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode]);

  const handleFlip = () => {
    setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'));
  };

  const processImageBlob = async (blob: Blob) => {
    setAnalyzing(true);
    setGradcamImage(null);
    try {
      const result = await scanService.predictImage(blob);
      setFireDetected(result.fire_detected);
      setConfidence(result.confidence);
      if (result.gradcam_base64) {
        setGradcamImage(result.gradcam_base64);
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'analyse IA");
    } finally {
      setAnalyzing(false);
      // On ne réinitialise pas selectedFile pour permettre à l'utilisateur de re-voir l'image
    }
  };

  const handleCapturePhoto = async () => {
    if (analyzing || isRecording) return;
    
    // S'il y a un fichier importé en attente, le bouton sert à l'analyser
    if (selectedFile) {
      await processImageBlob(selectedFile);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedUrl(dataUrl);
    addMedia('photo', dataUrl);

    // Convert to Blob and send to AI
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    setSelectedFile(blob);
    await processImageBlob(blob);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setCapturedUrl(url);
      setSelectedFile(file);
      setGradcamImage(null);
      setFireDetected(false);
      setConfidence(0);
      // L'analyse n'est plus automatique, l'utilisateur doit cliquer sur le bouton (shutter)
    }
  };

  const resetScanner = () => {
    setCapturedUrl(null);
    setSelectedFile(null);
    setGradcamImage(null);
    setFireDetected(false);
    setConfidence(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleToggleRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;

    if (!isRecording) {
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setCapturedUrl(url);
        addMedia('video', url);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
      setIsRecording(true);
    } else {
      recorderRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingSeconds(0);
      setIsRecording(false);
    }
  };

  return (
    <div className="scan-page">
      <div className="scan-topbar">
        <button className="scan-icon-btn">
          <FlashIcon size={18} />
        </button>
        <span className="scan-mode-label">{facingMode === 'environment' ? 'ARRIÈRE' : 'AVANT'} · SCAN IA</span>
        <button className="scan-icon-btn" onClick={handleFlip} aria-label="Changer de caméra">
          <RefreshIcon size={18} />
        </button>
      </div>

      <div className="scan-viewfinder">
        {capturedUrl && (
          <button 
            onClick={resetScanner}
            style={{ position: 'absolute', top: '15px', right: '15px', zIndex: 10, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', color: 'white', width: '36px', height: '36px', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Fermer l'image"
          >
            ✕
          </button>
        )}

        {cameraError ? (
          <p className="scan-hint scan-error">{cameraError}</p>
        ) : capturedUrl ? (
          <img 
            src={gradcamImage || capturedUrl} 
            alt="Preview ou Grad-CAM" 
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '16px' }} 
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`scan-video${facingMode === 'user' ? ' mirrored' : ''}`}
          />
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <span className="corner tl" />
        <span className="corner tr" />
        <span className="corner bl" />
        <span className="corner br" />
        {!cameraError && !capturedUrl && (
          <p className="scan-hint">POINTEZ VERS LA SCÈNE</p>
        )}
        {capturedUrl && !analyzing && !fireDetected && confidence === 0 && (
          <p className="scan-hint">APPUYEZ POUR ANALYSER</p>
        )}
        {analyzing && (
          <p className="scan-hint">ANALYSE EN COURS…</p>
        )}

        {isRecording && (
          <div className="scan-timer">
            <span className="scan-timer-dot" />
            {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:{String(recordingSeconds % 60).padStart(2, '0')}
          </div>
        )}

        <div className={`scan-status-pill ${isRecording ? 'recording' : analyzing ? 'analyzing' : 'safe'}`}>
          <span className="dot" />
          {isRecording ? 'ENREGISTREMENT…' : analyzing ? 'ANALYSE IA EN COURS…' : fireDetected ? `FEU DÉTECTÉ (${Math.round(confidence * 100)}%)` : 'SÉCURISÉ'}
        </div>
      </div>

      <div className="scan-controls" style={{ display: 'flex', justifyContent: 'center', gap: '20px', alignItems: 'center', padding: '20px 0' }}>
        <button className="scan-side-btn" onClick={() => fileInputRef.current?.click()} title="Importer depuis l'appareil">
          <UploadIcon size={22} />
        </button>
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileUpload} 
        />
        <button
          className="scan-shutter"
          onClick={handleCapturePhoto}
          disabled={analyzing || isRecording || !!cameraError}
          aria-label="Prendre une photo"
        >
          <span />
        </button>
        <button
          className={`scan-side-btn${isRecording ? ' active-recording' : ''}`}
          onClick={() => navigate('/galerie')}
          title="Aller à la galerie"
        >
          <GalleryIcon size={22} />
        </button>
      </div>

      {capturedUrl && !fireDetected && (
        <div className="scan-preview-toast">Média capturé avec succès</div>
      )}

      {fireDetected && (
        <FireAlertModal 
          record={scanHistory[0]} 
          onClose={() => setFireDetected(false)}
          imageUrl={gradcamImage || capturedUrl}
          confidence={confidence}
        />
      )}
    </div>
  );
};
