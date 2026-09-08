import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deviceService } from '../services/deviceService';

interface PairDeviceProps {
  onComplete?: () => void;
}

export const PairDevice: React.FC<PairDeviceProps> = ({ onComplete }) => {
  const navigate = useNavigate();
  const [deviceId, setDeviceId] = useState<string>('RPI4-CF-5212DFE3');
  const [pairingCode, setPairingCode] = useState<string>('CF-UJZTAV');
  const [deviceName, setDeviceName] = useState<string>('Raspberry 4');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const finish = () => {
    if (onComplete) {
      onComplete();
    } else {
      navigate('/home', { replace: true });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await deviceService.pairDevice(deviceId, pairingCode, deviceName);
      setSuccess("Raspberry Pi 4 lié avec succès à votre compte !");
      setTimeout(() => {
        finish();
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Échec de l'appairage. Vérifiez vos identifiants matériels.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    finish();
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* En-tête */}
        <div style={styles.header}>
          <div style={styles.logoContainer}>
            <span style={styles.logoIcon}>📡</span>
          </div>
          <h1 style={styles.title}>Lier votre Raspberry Pi</h1>
          <p style={styles.subtitle}>
            Associez votre équipement matériel à votre compte pour activer la surveillance en direct
          </p>
        </div>

        {/* Badge de Sécurité & Multi-Comptes */}
        <div style={styles.securityBanner}>
          <div style={styles.securityText}>
            <strong>Multi-Comptes & Sécurité Cryptographique</strong>
            <p style={{ margin: 0, fontSize: '11.5px', color: '#94a3b8' }}>
              Un même Raspberry Pi peut être connecté à plusieurs comptes (membres d'un même foyer ou équipe) en renseignant son code secret d'appairage.
            </p>
          </div>
        </div>

        {/* Formulaire d'appairage */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Identifiant Matériel (Device ID)</label>
            <input
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="Ex: RPI4-CF-5212DFE3"
              required
              style={styles.inputMono}
            />
            <span style={styles.helperText}>L'identifiant unique de votre processeur Raspberry Pi 4</span>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Code Secret d'Appairage (PIN)</label>
            <input
              type="text"
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value)}
              placeholder="Ex: CF-UJZTAV"
              required
              style={styles.inputMono}
            />
            <span style={styles.helperText}>Clé secrète à usage unique générée sur votre Raspberry Pi</span>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Nom personnalisé de l'appareil</label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="Ex: Raspberry 4 - Forêt Nord"
              style={styles.input}
            />
          </div>

          {error && <div style={styles.errorBox}>{error}</div>}
          {success && <div style={styles.successBox}>{success}</div>}

          <button type="submit" disabled={loading} style={styles.submitBtn}>
            {loading ? 'Validation cryptographique en cours...' : 'Lier mon équipement & Activer la surveillance'}
          </button>
        </form>

        {/* Option pour passer */}
        <div style={styles.skipContainer}>
          <button type="button" onClick={handleSkip} style={styles.skipBtn}>
            Passer cette étape pour le moment →
          </button>
          <span style={styles.skipNotice}>
            Vous pourrez toujours associer votre appareil ultérieurement dans la section <strong>Profil</strong>.
          </span>
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#0d0d12',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '20px 16px',
    boxSizing: 'border-box',
  },
  card: {
    backgroundColor: '#16161e',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '480px',
    padding: '36px 28px',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
    border: '1px solid #28283a',
    boxSizing: 'border-box',
  },
  header: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  logoContainer: {
    display: 'inline-flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    border: '1px solid #38bdf8',
    marginBottom: '14px',
  },
  logoIcon: {
    fontSize: '28px',
  },
  title: {
    color: '#ffffff',
    fontSize: '22px',
    fontWeight: 700,
    margin: '0 0 6px 0',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: '13px',
    margin: 0,
    lineHeight: '1.4',
  },
  securityBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    border: '1px solid rgba(34, 197, 94, 0.25)',
    borderRadius: '10px',
    padding: '12px 14px',
    marginBottom: '24px',
  },
  securityIcon: {
    fontSize: '18px',
    marginTop: '2px',
  },
  securityText: {
    color: '#e2e8f0',
    fontSize: '12.5px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    color: '#cbd5e1',
    fontSize: '13px',
    fontWeight: 600,
  },
  helperText: {
    color: '#64748b',
    fontSize: '11.5px',
  },
  input: {
    backgroundColor: '#1c1c26',
    border: '1px solid #2d2d3d',
    borderRadius: '8px',
    padding: '12px 14px',
    fontSize: '14px',
    color: '#ffffff',
    outline: 'none',
    boxSizing: 'border-box',
  },
  inputMono: {
    backgroundColor: '#111118',
    border: '1px solid #3b3b52',
    borderRadius: '8px',
    padding: '12px 14px',
    fontSize: '14px',
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    letterSpacing: '1px',
    color: '#38bdf8',
    outline: 'none',
    boxSizing: 'border-box',
  },
  submitBtn: {
    background: 'linear-gradient(135deg, #ff4500 0%, #ff8c00 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '14px',
    fontSize: '14.5px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '6px',
    boxShadow: '0 4px 14px rgba(255, 69, 0, 0.35)',
    transition: 'all 0.2s ease',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid #ef4444',
    color: '#f87171',
    borderRadius: '6px',
    padding: '10px',
    fontSize: '13px',
    textAlign: 'center',
  },
  successBox: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid #22c55e',
    color: '#4ade80',
    borderRadius: '6px',
    padding: '10px',
    fontSize: '13px',
    textAlign: 'center',
  },
  skipContainer: {
    textAlign: 'center',
    marginTop: '22px',
    paddingTop: '16px',
    borderTop: '1px solid #232330',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  skipBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    padding: '4px',
    textDecoration: 'underline',
  },
  skipNotice: {
    color: '#64748b',
    fontSize: '11px',
  },
};
