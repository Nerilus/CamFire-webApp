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
  const [maintenanceHours, setMaintenanceHours] = useState<number>(2);
  const [isMaintenanceLoading, setIsMaintenanceLoading] = useState(false);

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

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size > 0) {
          setIsSendingAudio(true);
          setTalkFeedback("Transmission au haut-parleur...");
          try {
            await deviceService.speakToDevice(device.device_id, audioBlob);
            setTalkFeedback("✓ Diffusé sur le Raspberry Pi !");
            setTimeout(() => setTalkFeedback(null), 3500);
          } catch (err: any) {
            setTalkFeedback("Erreur: " + err.message);
            setTimeout(() => setTalkFeedback(null), 4000);
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
      setTalkFeedback("Micro inaccessible: " + (err.message || "autorisez l'accès"));
      setTimeout(() => setTalkFeedback(null), 4000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // --- 2. Écoute à distance (Microphone Raspberry Pi) ---
  const toggleListening = () => {
    if (isListening) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.src = "";
      }
      setIsListening(false);
    } else {
      const audioUrl = deviceService.getAudioStreamUrl(device.device_id);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = audioUrl;
        audioPlayerRef.current.play().catch(e => {
          console.warn("Écoute audio:", e);
        });
      }
      setIsListening(true);
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
  const handleToggleMaintenance = async () => {
    setIsMaintenanceLoading(true);
    const nextState = !isMaintenance;
    try {
      const res = await deviceService.toggleMaintenance(
        device.device_id, 
        nextState, 
        nextState ? (maintenanceHours > 0 ? maintenanceHours : undefined) : undefined
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
            <strong>Mode Travaux actif</strong>
            <span>Détection incendie et alertes suspendues pour éviter les faux positifs.</span>
          </div>
        </div>
      )}

      <div className="controls-grid">
        {/* BOUTON 1 : Push-to-Talk (Parler) */}
        <div className="control-card talk-card">
          <div className="control-header">
            <span className="control-tag">Interphone vocal</span>
            {isRecording && <span className="recording-dot">● En direct</span>}
          </div>
          
          <button
            type="button"
            className={`control-btn ptt-btn ${isRecording ? 'recording' : ''} ${isSendingAudio ? 'sending' : ''}`}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
            onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
            disabled={isSendingAudio}
            title="Maintenez appuyé pour parler"
          >
            <div className="ptt-icon-wrapper">
              <MicIcon size={22} />
              {isRecording && <div className="ptt-pulse-ring" />}
            </div>
            <div className="ptt-labels">
              <strong>{isRecording ? "Relâchez pour envoyer" : isSendingAudio ? "Envoi en cours..." : "Maintenir pour parler"}</strong>
              <span>Diffuse votre voix sur le Pi</span>
            </div>
          </button>

          {talkFeedback && (
            <div className={`talk-feedback ${talkFeedback.includes('✓') ? 'success' : talkFeedback.includes('Erreur') ? 'error' : ''}`}>
              {talkFeedback}
            </div>
          )}
        </div>

        {/* BOUTON 2 : Écouter le microphone du Pi */}
        <div className="control-card">
          <div className="control-header">
            <span className="control-tag">Ambiance sonore</span>
            {isListening && <span className="listening-badge">En écoute</span>}
          </div>

          <button
            type="button"
            className={`control-btn listen-btn ${isListening ? 'active' : ''}`}
            onClick={toggleListening}
          >
            {isListening ? <VolumeXIcon size={20} /> : <VolumeIcon size={20} />}
            <div className="btn-text-block">
              <strong>{isListening ? "Couper l'écoute" : "Écouter en direct"}</strong>
              <span>{isListening ? "Flux audio connecté" : "Micro USB du Raspberry Pi"}</span>
            </div>
          </button>
        </div>

        {/* BOUTON 3 : Sirène d'Alarme d'Urgence */}
        <div className="control-card alarm-card">
          <div className="control-header">
            <span className="control-tag">Sécurité & Dissuasion</span>
            {isAlarmActive && <span className="alarm-flashing-tag">🚨 SIRÈNE ACTIVE</span>}
          </div>

          <button
            type="button"
            className={`control-btn alarm-btn ${isAlarmActive ? 'danger-active' : ''}`}
            onClick={handleToggleAlarm}
            disabled={isAlarmLoading}
          >
            <SirenIcon size={20} className={isAlarmActive ? 'siren-spin' : ''} />
            <div className="btn-text-block">
              <strong>{isAlarmActive ? "Arrêter la sirène" : "Déclencher l'alarme"}</strong>
              <span>{isAlarmActive ? "Son strident en cours" : "Sirène 15s sur le Pi"}</span>
            </div>
          </button>
        </div>

        {/* BOUTON 4 : Mode Travaux / Pause Surveillance */}
        <div className="control-card maintenance-card">
          <div className="control-header">
            <span className="control-tag">Chantier & Bricolage</span>
            <span className={`maintenance-status-pill ${isMaintenance ? 'active' : 'inactive'}`}>
              {isMaintenance ? "Suspendu" : "Surveillance ON"}
            </span>
          </div>

          <div className="maintenance-body">
            <div className="maintenance-toggle-row">
              <button
                type="button"
                className={`control-btn maintenance-btn ${isMaintenance ? 'active' : ''}`}
                onClick={handleToggleMaintenance}
                disabled={isMaintenanceLoading}
              >
                <WrenchIcon size={18} />
                <div className="btn-text-block">
                  <strong>{isMaintenance ? "Reprendre surveillance" : "Activer Mode Travaux"}</strong>
                  <span>{isMaintenance ? "Cliquez pour réactiver l'IA" : "Ignore poussière et fumée"}</span>
                </div>
              </button>
            </div>

            {!isMaintenance && (
              <div className="maintenance-duration-row">
                <span className="duration-label">Durée :</span>
                <div className="duration-options">
                  {[1, 2, 4, 8].map(h => (
                    <button
                      key={h}
                      type="button"
                      className={`duration-chip ${maintenanceHours === h ? 'selected' : ''}`}
                      onClick={() => setMaintenanceHours(h)}
                    >
                      {h}h
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`duration-chip ${maintenanceHours === 0 ? 'selected' : ''}`}
                    onClick={() => setMaintenanceHours(0)}
                    title="Jusqu'à réactivation manuelle"
                  >
                    Max
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
