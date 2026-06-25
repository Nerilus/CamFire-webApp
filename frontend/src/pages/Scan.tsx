import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlashIcon, RefreshIcon, GalleryIcon, VideoIcon } from '../components/icons';
import { FireAlertModal } from '../components/FireAlertModal';
import { scanHistory } from '../services/mockData';
import { useMedia } from '../context/MediaContext';
import './Scan.css';

import { usePrediction } from '../services/usePrediction';

type FacingMode = 'environment' | 'user';

export const Scan: React.FC = () => {
  const navigate = useNavigate();
  const { addMedia } = useMedia();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [facingMode, setFacingMode] = useState<FacingMode>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [fireDetected, setFireDetected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const { analyze } = usePrediction();

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

  const handleCapturePhoto = () => {
    if (analyzing || isRecording) return;
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

    // setAnalyzing(true);
    // setTimeout(() => {
    //   setAnalyzing(false);
    //   setFireDetected(true);
    // }, 1400);
    setAnalyzing(true);
    canvas.toBlob(async (blob) => {
    if (!blob) { setAnalyzing(false); return; }
    const result = await analyze({ file: blob, filename: 'capture.jpg' });
    setAnalyzing(false);
    if (result?.isFire) setFireDetected(true);
      }, 'image/jpeg', 0.9);
      
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
      setIsRecording(true);
    } else {
      recorderRef.current?.stop();
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
        {cameraError ? (
          <p className="scan-hint scan-error">{cameraError}</p>
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
        {!cameraError && (
          <p className="scan-hint">{analyzing ? 'ANALYSE EN COURS…' : 'POINTEZ VERS LA SCÈNE'}</p>
        )}

        <div className={`scan-status-pill ${isRecording ? 'recording' : analyzing ? 'analyzing' : 'safe'}`}>
          <span className="dot" />
          {isRecording ? 'ENREGISTREMENT…' : analyzing ? 'ANALYSE EN COURS' : 'AUCUN FEU DÉTECTÉ'}
        </div>
      </div>

      <div className="scan-controls">
        <button className="scan-side-btn" onClick={() => navigate('/galerie')}>
          <GalleryIcon size={22} />
        </button>
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
          onClick={handleToggleRecording}
          disabled={!!cameraError}
          aria-label={isRecording ? 'Arrêter l’enregistrement' : 'Démarrer l’enregistrement vidéo'}
        >
          <VideoIcon size={22} />
        </button>
      </div>

      {capturedUrl && !fireDetected && (
        <div className="scan-preview-toast">Média capturé avec succès</div>
      )}

      {fireDetected && <FireAlertModal record={scanHistory[0]} onClose={() => setFireDetected(false)} />}
    </div>
  );
};
