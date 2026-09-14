import React, { useState, useRef, useEffect } from 'react';
import { deviceService } from '../services/deviceService';
import { 
  MicIcon, 
  VolumeIcon, 
  VolumeXIcon, 
  SirenIcon, 
  WrenchIcon 
} from './icons';
import './DeviceLiveControls.css';

export interface DeviceLike {
  id: number;
  device_id: string;
  name: string;
  is_online?: boolean;
  is_maintenance_mode?: boolean;
  maintenance_until?: string | null;
  alarm_active?: boolean;
}

export interface DeviceLiveControlsProps {
  device: DeviceLike;
  onDeviceUpdate?: (updated: Partial<DeviceLike>) => void;
}

const parseUtcDate = (raw?: string | null): Date | null => {
  if (!raw) return null;
  const iso = raw.endsWith('Z') || raw.includes('+') ? raw : `${raw}Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

export const DeviceLiveControls: React.FC<DeviceLiveControlsProps> = ({ device, onDeviceUpdate }) => {
  // Push-to-Talk (Parler)
  const [isRecording, setIsRecording] = useState(false);
  const [talkFeedback, setTalkFeedback] = useState<string | null>(null);
  const [isSendingAudio, setIsSendingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Écoute à distance
  const [isListening, setIsListening] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Sirène d'alarme
  const [isAlarmActive, setIsAlarmActive] = useState(device.alarm_active || false);
  const [isAlarmLoading, setIsAlarmLoading] = useState(false);

  // Mode Travaux
  const [isMaintenance, setIsMaintenance] = useState(device.is_maintenance_mode || false);
  const [isMaintenanceLoading, setIsMaintenanceLoading] = useState(false);
  const maintenanceHours = 2;

  useEffect(() => {
    setIsAlarmActive(device.alarm_active || false);
    setIsMaintenance(device.is_maintenance_mode || false);
  }, [device]);

  // Arrêter l'écoute si le composant est démonté
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    };
  }, []);

  // --- 1. Push-to-Talk (Parler à distance) ---
  const startRecording = async () => {
    try {
      setTalkFeedback(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      let options: MediaRecorderOptions = {};
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { mimeType: 'audio/webm;codecs=opus' };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          options = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' };
        }
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const chosenType = mediaRecorder.mimeType || options.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: chosenType });
        if (audioBlob.size > 0) {
          setIsSendingAudio(true);
          setTalkFeedback("Transmission au haut-parleur...");
          try {
            await deviceService.speakToDevice(device.device_id, audioBlob);
            setTalkFeedback("Diffusé sur la sortie Pi (Jack 3.5mm / HDMI). Branchez une enceinte.");
            setTimeout(() => setTalkFeedback(null), 5500);
          } catch (err: any) {
            setTalkFeedback("Erreur: " + err.message);
            setTimeout(() => setTalkFeedback(null), 5000);
          } finally {
            setIsSendingAudio(false);
          }
        }
        // Fermer les pistes micro
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setTalkFeedback("Enregistrement en cours... Parlez maintenant");
    } catch (err: any) {
      setTalkFeedback("Micro inaccessible: " + (err.message || "autorisez l'accès micro"));
      setTimeout(() => setTalkFeedback(null), 5000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // --- 2. Écoute à distance (Microphone Raspberry Pi) ---
  const toggleListening = async () => {
    if (isListening) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.src = "";
      }
      setIsListening(false);
      setTalkFeedback(null);
    } else {
      const audioUrl = deviceService.getAudioStreamUrl(device.device_id);
      setTalkFeedback("Vérification du micro sur le Pi...");
      try {
        const check = await fetch(audioUrl, { method: 'HEAD' });
        if (!check.ok) {
          const errData = await check.json().catch(() => ({}));
          setTalkFeedback(errData.detail || "Aucun micro USB branché sur le Pi. Connectez un micro USB.");
          setTimeout(() => setTalkFeedback(null), 6000);
          return;
        }
      } catch {
        setTalkFeedback("Aucun micro USB détecté sur le Raspberry Pi. Branchez un micro USB.");
        setTimeout(() => setTalkFeedback(null), 6000);
        return;
      }

      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = audioUrl;
        audioPlayerRef.current.play().then(() => {
          setIsListening(true);
          setTalkFeedback("Écoute audio active");
        }).catch(() => {
          setTalkFeedback("Micro indisponible (branchez un micro USB sur le Pi)");
          setIsListening(false);
          setTimeout(() => setTalkFeedback(null), 5000);
        });
      }
    }
  };

  // --- 3. Sirène d'alarme ---
  const handleToggleAlarm = async () => {
    setIsAlarmLoading(true);
    const action = isAlarmActive ? 'stop' : 'start';
    try {
      const res = await deviceService.triggerAlarm(device.device_id, action, 15);
      setIsAlarmActive(res.alarm_active);
      onDeviceUpdate?.({ alarm_active: res.alarm_active });
    } catch (err: any) {
      alert("Erreur alarme : " + err.message);
    } finally {
      setIsAlarmLoading(false);
    }
  };

  // --- 4. Mode Travaux (Pause détection) ---
  const handleToggleMaintenance = async (customHours?: number) => {
    setIsMaintenanceLoading(true);
    const nextState = !isMaintenance;
    const hours = customHours !== undefined ? customHours : maintenanceHours;
    try {
      const res = await deviceService.toggleMaintenance(
        device.device_id, 
        nextState, 
        nextState ? (hours > 0 ? hours : undefined) : undefined
      );
      setIsMaintenance(res.is_maintenance_mode);
      onDeviceUpdate?.({ 
        is_maintenance_mode: res.is_maintenance_mode,
        maintenance_until: res.maintenance_until 
      });
    } catch (err: any) {
      alert("Erreur Mode Travaux : " + err.message);
    } finally {
      setIsMaintenanceLoading(false);
    }
  };

  return (
    <div className="device-live-controls">
      {/* Lecteur audio masqué pour l'écoute */}
      <audio ref={audioPlayerRef} style={{ display: 'none' }} />

      {/* Bandeau d'état Mode Travaux actif */}
      {isMaintenance && (
        <div className="maintenance-active-banner">
          <WrenchIcon size={16} className="wrench-pulse" />
          <div className="maintenance-banner-text">
            <strong>MODE TRAVAUX ACTIF</strong>
            <span>Flux occulté (écran noir) · Zéro détection · Zéro e-mail {device.maintenance_until && parseUtcDate(device.maintenance_until) ? `(jusqu'à ${parseUtcDate(device.maintenance_until)!.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})` : ''}</span>
          </div>
          <button
            type="button"
            className="maintenance-resume-btn"
            onClick={() => handleToggleMaintenance()}
            disabled={isMaintenanceLoading}
            title="Rétablir la surveillance normale et la caméra"
          >
            Rétablir
          </button>
        </div>
      )}

      {/* Command Pad 2x2 Ergonomique */}
      <div className="action-pad-grid">
        {/* BOUTON 1 : Push-to-Talk (Parler) */}
        <button
          type="button"
          className={`pad-btn ptt-btn ${isRecording ? 'recording' : ''} ${isSendingAudio ? 'sending' : ''}`}
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
          onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
          disabled={isSendingAudio}
          title="Maintenez appuyé pour parler via le haut-parleur (Jack 3.5mm)"
        >
          <div className="pad-btn-icon-wrap">
            <MicIcon size={17} />
            {isRecording && <div className="ptt-pulse-ring" />}
          </div>
          <div className="pad-btn-content">
            <span className="pad-btn-title">
              {isRecording ? "En direct..." : isSendingAudio ? "Envoi..." : "Interphone"}
            </span>
            <span className="pad-btn-hint">
              {isRecording ? "Relâcher pour diffuser" : "Maintenir (Sortie Jack)"}
            </span>
          </div>
        </button>

        {/* BOUTON 2 : Écouter le microphone du Pi */}
        <button
          type="button"
          className={`pad-btn listen-btn ${isListening ? 'active' : ''}`}
          onClick={toggleListening}
          title={isListening ? "Couper l'écoute audio" : "Écouter le micro en direct (Micro USB requis)"}
        >
          <div className="pad-btn-icon-wrap">
            {isListening ? <VolumeXIcon size={17} /> : <VolumeIcon size={17} />}
          </div>
          <div className="pad-btn-content">
            <span className="pad-btn-title">
              {isListening ? "Écoute ON" : "Écouter Direct"}
            </span>
            <span className="pad-btn-hint">
              {isListening ? "Flux connecté" : "Micro USB requis"}
            </span>
          </div>
        </button>

        {/* BOUTON 3 : Sirène d'Alarme d'Urgence */}
        <button
          type="button"
          className={`pad-btn alarm-btn ${isAlarmActive ? 'active' : ''}`}
          onClick={handleToggleAlarm}
          disabled={isAlarmLoading}
          title={isAlarmActive ? "Arrêter la sirène" : "Déclencher l'alarme sonore (15s)"}
        >
          <div className="pad-btn-icon-wrap">
            <SirenIcon size={17} className={isAlarmActive ? 'siren-spin' : ''} />
          </div>
          <div className="pad-btn-content">
            <span className="pad-btn-title">
              {isAlarmActive ? "Arrêter Sirène" : "Sirène 15s"}
            </span>
            <span className="pad-btn-hint">
              {isAlarmActive ? "Sonnerie en cours" : "Dissuasion"}
            </span>
          </div>
        </button>

        {/* BOUTON 4 : Mode Travaux / Pause Surveillance (1 clic immédiat) */}
        <button
          type="button"
          className={`pad-btn maintenance-btn ${isMaintenance ? 'active' : ''}`}
          onClick={() => handleToggleMaintenance()}
          disabled={isMaintenanceLoading}
          title={isMaintenance ? "Désactiver le mode travaux et rétablir la caméra" : "Activer le Mode Travaux (écran noir, zéro détection, zéro e-mail)"}
        >
          <div className="pad-btn-icon-wrap">
            <WrenchIcon size={17} />
          </div>
          <div className="pad-btn-content">
            <span className="pad-btn-title">
              {isMaintenance ? "Travaux ACTIF" : "Mode Travaux"}
            </span>
            <span className="pad-btn-hint">
              {isMaintenance ? "Écran noir · Pause" : "Occulter & Couper"}
            </span>
          </div>
        </button>
      </div>

      {/* Feedback Push-to-Talk */}
      {talkFeedback && (
        <div className={`talk-feedback-pill ${talkFeedback.includes('Diffusé') ? 'success' : talkFeedback.includes('Erreur') ? 'error' : ''}`}>
          <span>{talkFeedback}</span>
        </div>
      )}
    </div>
  );

};
