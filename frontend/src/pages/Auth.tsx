import React, { useState } from 'react';
import { authService } from '../services/authService';

export const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

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
        await authService.login(email, password);
        setSuccess("Connexion réussie ! Redirection...");
        // Logique de redirection ou de mise à jour d'état global ici (ex: window.location.reload())
      } else {
        // Flux Inscription
        await authService.register(email, password);
        setSuccess("Compte créé avec succès ! Vous pouvez vous connecter.");
        setIsLogin(true); // Bascule automatique sur l'écran de login
        setConfirmPassword('');
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* En-tête de l'application */}
        <div style={styles.header}>
          <div style={styles.logoContainer}>
            <span style={styles.logoIcon}>🔥</span>
          </div>
          <h1 style={styles.title}>CamFire</h1>
          <p style={styles.subtitle}>Système Intelligent de Télésurveillance</p>
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
    maxWidth: '400px',
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
    gap: '18px',
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
  input: {
    backgroundColor: '#1c1c26',
    border: '1px solid #2d2d3d',
    borderRadius: '8px',
    padding: '12px 14px',
    fontSize: '15px',
    color: '#ffffff',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
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
    marginTop: '8px',
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
    marginTop: '24px',
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