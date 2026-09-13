import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { PairDevice } from './PairDevice';
import { FlameIcon, ShieldCheckIcon, RefreshIcon } from '../components/icons';

export const Auth: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [isForgotStep, setIsForgotStep] = useState<boolean>(false);
  const [isResetStep, setIsResetStep] = useState<boolean>(false);
  const [resetEmail, setResetEmail] = useState<string>('');
  const [resetCode, setResetCode] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>('');
  const [signupStep, setSignupStep] = useState<number>(1);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  
  // États 2FA
  const [is2FAStep, setIs2FAStep] = useState<boolean>(false);
  const [tempToken, setTempToken] = useState<string>('');
  const [emailMasked, setEmailMasked] = useState<string>('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState<number>(600); // 10 minutes
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [resendLoading, setResendLoading] = useState<boolean>(false);
  const digitInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Redirection si l'utilisateur arrive sur /auth déjà connecté
  useEffect(() => {
    if (isAuthenticated && signupStep !== 2) {
      navigate('/home', { replace: true });
    }
  }, [isAuthenticated, signupStep, navigate]);

  // Décompte de validité du code OTP et cooldown du bouton renvoi
  useEffect(() => {
    if (!is2FAStep) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [is2FAStep]);

  // Focus sur la première case lors du passage au 2FA
  useEffect(() => {
    if (is2FAStep && digitInputsRef.current[0]) {
      digitInputsRef.current[0].focus();
    }
  }, [is2FAStep]);

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
        if (result.requires2FA) {
          setTempToken(result.tempToken || '');
          setEmailMasked(result.emailMasked || email);
          setTimeLeft(result.expiresInSeconds || 600);
          setResendCooldown(30);
          setIs2FAStep(true);
          setOtpDigits(['', '', '', '', '', '']);
          setSuccess("Code de sécurité envoyé par e-mail. Veuillez le renseigner ci-dessous.");
        } else if (result.token) {
          login(result.token);
          setSuccess("Connexion réussie ! Redirection...");
          navigate('/home', { replace: true });
        }
      } else {
        // Flux Inscription : création du compte puis connexion immédiate
        await authService.register(email, password);
        const result = await authService.login(email, password);
        if (result.requires2FA) {
          setTempToken(result.tempToken || '');
          setEmailMasked(result.emailMasked || email);
          setTimeLeft(result.expiresInSeconds || 600);
          setResendCooldown(30);
          setIs2FAStep(true);
          setOtpDigits(['', '', '', '', '', '']);
          setSuccess("Votre compte est créé ! Saisissez le code reçu par e-mail pour finaliser la connexion.");
        } else if (result.token) {
          login(result.token);
          setSignupStep(2);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  // Gestion de la saisie d'un chiffre dans une case
  const handleDigitChange = (index: number, val: string) => {
    // Nettoyage pour ne garder que des chiffres
    const cleanVal = val.replace(/\D/g, '');
    
    // Si l'utilisateur colle une chaîne de plusieurs chiffres
    if (cleanVal.length > 1) {
      const newDigits = [...otpDigits];
      const chars = cleanVal.slice(0, 6).split('');
      chars.forEach((char, i) => {
        if (index + i < 6) newDigits[index + i] = char;
      });
      setOtpDigits(newDigits);
      const nextIndex = Math.min(index + chars.length, 5);
      digitInputsRef.current[nextIndex]?.focus();
      
      // Si les 6 chiffres sont complets, vérification automatique
      if (newDigits.every((d) => d !== '')) {
        verifyCode(newDigits.join(''));
      }
      return;
    }

    const newDigits = [...otpDigits];
    newDigits[index] = cleanVal;
    setOtpDigits(newDigits);

    // Déplacement automatique vers la case suivante
    if (cleanVal && index < 5) {
      digitInputsRef.current[index + 1]?.focus();
    }

    // Auto-soumission si les 6 cases sont remplies
    if (cleanVal && index === 5 && newDigits.every((d) => d !== '')) {
      verifyCode(newDigits.join(''));
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      digitInputsRef.current[index - 1]?.focus();
    }
  };

  const verifyCode = async (codeToVerify?: string) => {
    const code = codeToVerify || otpDigits.join('');
    if (code.length !== 6) {
      setError("Veuillez saisir le code complet à 6 chiffres.");
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const finalToken = await authService.verify2FA(tempToken, code);
      login(finalToken);
      setSuccess("Authentification confirmée ! Redirection...");
      if (!isLogin && signupStep === 1) {
        setSignupStep(2);
      } else {
        navigate('/home', { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Code de vérification invalide.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setError(null);
    setSuccess(null);
    setResendLoading(true);

    try {
      const res = await authService.resend2FA(tempToken);
      setTimeLeft(res.expiresInSeconds || 600);
      setResendCooldown(30);
      setOtpDigits(['', '', '', '', '', '']);
      setSuccess(res.message || "Un nouveau code de sécurité vous a été envoyé.");
      digitInputsRef.current[0]?.focus();
    } catch (err: any) {
      setError(err.message || "Impossible de renvoyer le code.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleBackToAuth = () => {
    setIs2FAStep(false);
    setTempToken('');
    setOtpDigits(['', '', '', '', '', '']);
    setError(null);
    setSuccess(null);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
        await authService.forgotPassword(resetEmail);
        setSuccess("Code envoyé ! Vérifiez votre boîte mail.");
        setIsResetStep(true);
    } catch (err: any) {
        setError(err.message || 'Une erreur est survenue.');
    } finally {
        setLoading(false);
    }
};

const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmNewPassword) {
        setError("Les mots de passe ne correspondent pas.");
        return;
    }
    setLoading(true);
    try {
        await authService.resetPassword(resetEmail, resetCode, newPassword);
        setSuccess("Mot de passe réinitialisé ! Vous pouvez vous connecter.");
        setIsForgotStep(false);
        setIsResetStep(false);
        setResetEmail(''); setResetCode(''); setNewPassword(''); setConfirmNewPassword('');
    } catch (err: any) {
        setError(err.message || 'Code invalide ou expiré.');
    } finally {
        setLoading(false);
    }
};


  // Écran "Mot de passe oublié" — saisie de l'email
  if (isForgotStep && !isResetStep) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.header}>
            <div style={styles.logoContainer}>
              <FlameIcon size={28} />
            </div>
            <h1 style={styles.title}>Mot de passe oublié</h1>
            <p style={styles.subtitle}>Saisissez votre adresse email pour recevoir un code de réinitialisation</p>
          </div>
          <form onSubmit={handleForgotPassword} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Adresse Email</label>
              <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="votre.nom@adresse.com" required style={styles.input} />
            </div>
            {error && <div style={styles.errorBox}>{error}</div>}
            {success && <div style={styles.successBox}>{success}</div>}
            <button type="submit" disabled={loading} style={styles.submitBtn}>
              {loading ? 'Envoi en cours...' : 'Envoyer le code'}
            </button>
          </form>
          <div style={styles.toggleContainer}>
            <button type="button" onClick={() => { setIsForgotStep(false); setError(null); setSuccess(null); }} style={styles.toggleBtn}>
              ← Retour à la connexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Écran "Réinitialisation" — saisie du code + nouveau mot de passe
  if (isResetStep) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.header}>
            <div style={{ ...styles.logoContainer, borderColor: '#00d2ff', backgroundColor: 'rgba(0, 210, 255, 0.1)' }}>
              <ShieldCheckIcon size={28} style={{ color: '#00d2ff' }} />
            </div>
            <h1 style={styles.title}>Nouveau mot de passe</h1>
            <p style={styles.subtitle}>Saisissez le code reçu par email et votre nouveau mot de passe</p>
          </div>
          <form onSubmit={handleResetPassword} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Code de réinitialisation (6 chiffres)</label>
              <input type="text" value={resetCode} onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" required maxLength={6} style={{ ...styles.input, ...styles.inputMono, textAlign: 'center', fontSize: '20px', letterSpacing: '6px' }} />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Nouveau mot de passe</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" required style={styles.input} />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Confirmer le mot de passe</label>
              <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="••••••••" required style={styles.input} />
            </div>
            {error && <div style={styles.errorBox}>{error}</div>}
            {success && <div style={styles.successBox}>{success}</div>}
            <button type="submit" disabled={loading || resetCode.length !== 6} style={{ ...styles.submitBtn, background: 'linear-gradient(135deg, #00b4db 0%, #0083b0 100%)' }}>
              {loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
            </button>
          </form>
          <div style={styles.toggleContainer}>
            <button type="button" onClick={() => { setIsResetStep(false); setError(null); setSuccess(null); }} style={styles.toggleBtn}>
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

  // Formatage du temps restant MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Écran Double Authentification (2FA) */}
        {is2FAStep ? (
          <div>
            <div style={styles.header}>
              <div style={{ ...styles.logoContainer, borderColor: '#00d2ff', backgroundColor: 'rgba(0, 210, 255, 0.1)' }}>
                <ShieldCheckIcon size={30} style={{ color: '#00d2ff' }} />
              </div>
              <h1 style={styles.title}>Double Authentification</h1>
              <p style={styles.subtitle}>
                Pour sécuriser votre compte, un code temporaire à 6 chiffres a été envoyé à :
              </p>
              <div style={styles.emailBadge}>
                {emailMasked}
              </div>
            </div>

            {/* Saisie des 6 chiffres */}
            <div style={styles.otpGrid}>
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => { digitInputsRef.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                  style={{
                    ...styles.otpInput,
                    borderColor: digit ? '#00d2ff' : '#2d2d3d',
                    boxShadow: digit ? '0 0 10px rgba(0, 210, 255, 0.25)' : 'none',
                  }}
                />
              ))}
            </div>

            {/* Timer de péremption */}
            <div style={styles.timerRow}>
              <span>Expiration :</span>
              <strong style={{ color: timeLeft < 60 ? '#ef4444' : '#00d2ff' }}>
                {formatTime(timeLeft)}
              </strong>
            </div>

            {/* Messages de retour */}
            {error && <div style={styles.errorBox}>{error}</div>}
            {success && <div style={styles.successBox}>{success}</div>}

            {/* Bouton de confirmation */}
            <button
              type="button"
              onClick={() => verifyCode()}
              disabled={loading || otpDigits.some((d) => d === '') || timeLeft === 0}
              style={{
                ...styles.submitBtn,
                background: 'linear-gradient(135deg, #00b4db 0%, #0083b0 100%)',
                opacity: loading || otpDigits.some((d) => d === '') || timeLeft === 0 ? 0.6 : 1,
                cursor: loading || otpDigits.some((d) => d === '') || timeLeft === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Vérification en cours...' : 'Confirmer et se connecter'}
            </button>

            {/* Boutons d'action auxiliaires : Renvoyer & Retour */}
            <div style={styles.twoFactorActions}>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || resendLoading}
                style={{
                  ...styles.resendBtn,
                  opacity: resendCooldown > 0 || resendLoading ? 0.5 : 1,
                  cursor: resendCooldown > 0 || resendLoading ? 'not-allowed' : 'pointer',
                }}
              >
                <RefreshIcon size={14} />
                {resendLoading
                  ? 'Envoi...'
                  : resendCooldown > 0
                  ? `Renvoyer un code (${resendCooldown}s)`
                  : 'Renvoyer un code'}
              </button>

              <button
                type="button"
                onClick={handleBackToAuth}
                style={styles.backBtn}
              >
                ← Utiliser un autre compte
              </button>
            </div>
          </div>
        ) : (
          /* Formulaire classique Inscription / Connexion */
          <div>
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

              {isLogin && (
                <div style={{ textAlign: 'right', marginTop: '-8px' }}>
                  <button
                    type="button"
                    onClick={() => { setIsForgotStep(true); setError(null); setSuccess(null); }}
                    style={{ background: 'none', border: 'none', color: '#71717a', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
              )}

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
        )}
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
  emailBadge: {
    display: 'inline-block',
    marginTop: '10px',
    padding: '6px 14px',
    backgroundColor: 'rgba(0, 210, 255, 0.1)',
    border: '1px solid rgba(0, 210, 255, 0.3)',
    borderRadius: '20px',
    color: '#38bdf8',
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: 'Consolas, Monaco, monospace',
    letterSpacing: '0.5px',
  },
  otpGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '10px',
    margin: '22px 0 16px 0',
  },
  otpInput: {
    width: '100%',
    height: '52px',
    backgroundColor: '#12121a',
    border: '2px solid #2d2d3d',
    borderRadius: '10px',
    textAlign: 'center',
    fontSize: '24px',
    fontWeight: 700,
    color: '#ffffff',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'Consolas, Monaco, monospace',
    transition: 'all 0.2s ease',
  },
  timerRow: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#94a3b8',
    marginBottom: '16px',
  },
  twoFactorActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '20px',
    alignItems: 'center',
  },
  resendBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'none',
    border: 'none',
    color: '#00d2ff',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '6px 12px',
    borderRadius: '6px',
    transition: 'opacity 0.2s',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#71717a',
    fontSize: '12px',
    cursor: 'pointer',
    padding: '4px',
    textDecoration: 'none',
    transition: 'color 0.2s',
  },
};