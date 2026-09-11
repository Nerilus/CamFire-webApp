import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { PairDevice } from './PairDevice';
import { FlameIcon } from '../components/icons';

export const Auth: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [signupStep, setSignupStep] = useState<number>(1);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [otpStep, setOtpStep] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>('');


  // Redirection si l'utilisateur arrive sur /auth déjà connecté (sauf s'il est en cours d'appairage à l'étape 2)
  useEffect(() => {
    if (isAuthenticated && signupStep !== 2) {
      navigate('/home', { replace: true });
    }
  }, [isAuthenticated, signupStep, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (!isLogin && password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        // Flux Connexion
        const result = await authService.login(email, password);
        setSuccess(result.message);
        setOtpStep(true);

      } else {
        // Flux Inscription : création du compte, connexion et affichage immédiat de l'étape d'appairage
        await authService.register(email, password);
        await authService.login(email, password);
        setOtpStep(true);
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
        const token = await authService.verifyOtp(email, otpCode);
        login(token);
        if (!isLogin) {
        setSignupStep(2);
    } else {
    navigate('/home', { replace: true });
    }
    } catch (err: any) {
        setError(err.message || 'Code invalide ou expiré.');
    } finally {
        setLoading(false);
    }
  };

    // Écran de vérification OTP (2FA)
  if (otpStep) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.header}>
            <div style={styles.logoContainer}>
              <FlameIcon size={28} />
            </div>
            <h1 style={styles.title}>CamFire</h1>
            <p style={styles.subtitle}>Vérification en deux étapes</p>
          </div>
          <p style={{ color: '#a1a1aa', fontSize: '14px', textAlign: 'center', marginBottom: '20px' }}>
            Un code à 6 chiffres a été envoyé à <strong style={{ color: '#ffffff' }}>{email}</strong>
          </p>
          <form onSubmit={handleVerifyOtp} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Code de vérification</label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                required
                maxLength={6}
                style={{ ...styles.input, ...styles.inputMono, textAlign: 'center', fontSize: '24px', letterSpacing: '8px' }}
              />
            </div>
            {error && <div style={styles.errorBox}>{error}</div>}
            {success && <div style={styles.successBox}>{success}</div>}
            <button type="submit" disabled={loading || otpCode.length !== 6} style={styles.submitBtn}>
              {loading ? 'Vérification...' : 'Vérifier le code'}
            </button>
          </form>
          <div style={styles.toggleContainer}>
            <button
              type="button"
              onClick={() => { setOtpStep(false); setOtpCode(''); setError(null); setSuccess(null); }}
              style={styles.toggleBtn}
            >
              ← Retour
            </button>
          </div>
        </div>
      </div>
    );
  }


  // Affichage direct de la page de liaison Raspberry Pi dès la validation de l'inscription !
  if (!isLogin && signupStep === 2) {
    return <PairDevice onComplete={() => navigate('/home', { replace: true })} />;
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* En-tête de l'application */}
        <div style={styles.header}>
          <div style={styles.logoContainer}>
            <FlameIcon size={28} />
          </div>
          <h1 style={styles.title}>CamFire</h1>
          <p style={styles.subtitle}>Système Intelligent de Télésurveillance Incendie</p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Adresse Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre.nom@adresse.com"
              required
              style={styles.input}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={styles.input}
            />
          </div>

          {!isLogin && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Confirmer le mot de passe</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={styles.input}
              />
            </div>
          )}

          {/* Messages de retour */}
          {error && <div style={styles.errorBox}>{error}</div>}
          {success && <div style={styles.successBox}>{success}</div>}

          {/* Bouton Action Principal */}
          <button type="submit" disabled={loading} style={styles.submitBtn}>
            {loading ? 'Traitement en cours...' : isLogin ? 'Se connecter' : "S'inscrire"}
          </button>
        </form>

        {/* Lien de bascule */}
        <div style={styles.toggleContainer}>
          <span style={styles.toggleText}>
            {isLogin ? "Vous n'avez pas de compte ?" : "Vous avez déjà un compte ?"}
          </span>
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setSignupStep(1);
              setError(null);
              setSuccess(null);
            }}
            style={styles.toggleBtn}
          >
            {isLogin ? "Créer un compte" : "Se connecter"}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- DESIGN STYLES (Modern Cyber Dark / Inferno Palette) ---
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#0d0d12', // Fond ultra-sombre
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '16px',
    boxSizing: 'border-box',
  },
  card: {
    backgroundColor: '#16161e', // Carte grise anthracite texturée
    borderRadius: '16px',
    width: '100%',
    maxWidth: '460px',
    padding: '32px 24px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
    border: '1px solid #232330',
    boxSizing: 'border-box',
  },
  header: {
    textAlign: 'center',
    marginBottom: '28px',
  },
  logoContainer: {
    display: 'inline-flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 69, 0, 0.1)',
    border: '1px solid #ff4500',
    marginBottom: '12px',
  },
  logoIcon: {
    fontSize: '28px',
  },
  title: {
    color: '#ffffff',
    fontSize: '24px',
    fontWeight: 700,
    margin: '0 0 4px 0',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    color: '#71717a',
    fontSize: '13px',
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    color: '#a1a1aa',
    fontSize: '13px',
    fontWeight: 500,
  },
  labelSmall: {
    color: '#94a3b8',
    fontSize: '12px',
    fontWeight: 600,
  },
  input: {
    backgroundColor: '#1c1c26',
    border: '1px solid #2d2d3d',
    borderRadius: '8px',
    padding: '12px 14px',
    fontSize: '14px',
    color: '#ffffff',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  },
  inputMono: {
    backgroundColor: '#12121a',
    border: '1px solid #38384f',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '13px',
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    letterSpacing: '0.8px',
    color: '#38bdf8',
    outline: 'none',
    boxSizing: 'border-box',
  },
  deviceBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    border: '1px solid rgba(255, 69, 0, 0.3)',
    borderRadius: '12px',
    padding: '14px',
    boxSizing: 'border-box',
  },
  deviceBoxHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceCheckboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
  },
  deviceBoxTitle: {
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 600,
  },
  secureBadge: {
    fontSize: '11px',
    fontWeight: 700,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    color: '#4ade80',
    border: '1px solid rgba(34, 197, 94, 0.35)',
    borderRadius: '20px',
    padding: '2px 8px',
  },
  deviceHelpText: {
    color: '#64748b',
    fontSize: '12px',
    margin: 0,
    lineHeight: '1.4',
  },
  submitBtn: {
    background: 'linear-gradient(135deg, #ff4500 0%, #ff8c00 100%)', // Dégradé Inferno
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '14px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '6px',
    boxShadow: '0 4px 12px rgba(255, 69, 0, 0.3)',
    transition: 'opacity 0.2s',
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
  toggleContainer: {
    textAlign: 'center',
    marginTop: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  toggleText: {
    color: '#71717a',
    fontSize: '13px',
  },
  toggleBtn: {
    background: 'none',
    border: 'none',
    color: '#ff8c00',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '4px',
    textDecoration: 'underline',
  },
};