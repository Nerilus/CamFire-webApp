import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { deviceService, type Device } from '../services/deviceService';
import { ticketService, type Ticket } from '../services/ticketService';
import { SettingsIcon, RadioIcon, ShieldCheckIcon, ShieldAlertIcon, LockIcon, KeyIcon, CopyIcon, CheckIcon } from '../components/icons';
import './Profile.css';


export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Sécurité & 2FA
  const [is2FAEnabled, setIs2FAEnabled] = useState<boolean>(true);
  const [loading2FA, setLoading2FA] = useState<boolean>(false);
  const [twoFAMsg, setTwoFAMsg] = useState({ type: '', text: '' });

  // Modal désactivation sécurisée 2FA
  const [showDisable2FAModal, setShowDisable2FAModal] = useState<boolean>(false);
  const [disable2FACode, setDisable2FACode] = useState<string>('');
  const [disable2FAEmail, setDisable2FAEmail] = useState<string>('');
  const [isDisabling2FA, setIsDisabling2FA] = useState<boolean>(false);
  const [disable2FAError, setDisable2FAError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState({ type: '', text: '' });
  const [loadingPwd, setLoadingPwd] = useState(false);

  // Appareils Raspberry Pi
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceMsg, setDeviceMsg] = useState({ type: '', text: '' });

  // Modal dissociation sécurisée
  const [showUnpairModal, setShowUnpairModal] = useState(false);
  const [targetUnpairDeviceId, setTargetUnpairDeviceId] = useState('');
  const [unpairPassword, setUnpairPassword] = useState('');
  const [isUnpairing, setIsUnpairing] = useState(false);

  // Modal nouveau code d'appairage (pour propriétaire)
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [targetDeviceIdForCode, setTargetDeviceIdForCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [loadingCode, setLoadingCode] = useState(false);

  // Tickets
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  useEffect(() => {
    loadUserProfile();
    loadDevices();
    loadTickets();
  }, []);

  const loadTickets = async () => {
    setLoadingTickets(true);
    try {
      const data = await ticketService.getMyTickets();
      setTickets(data);
    } catch (e) {
      console.error("Erreur chargement des tickets", e);
    } finally {
      setLoadingTickets(false);
    }
  };

  const loadUserProfile = async () => {
    try {
      const user = await authService.getMe();
      setFirstname(user.firstname || '');
      setLastname(user.lastname || '');
      setEmail(user.email || '');
      if (user.is_2fa_enabled !== undefined) {
        setIs2FAEnabled(user.is_2fa_enabled);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggle2FA = async () => {
    setTwoFAMsg({ type: '', text: '' });
    if (is2FAEnabled) {
      // Pour désactiver : demande préalable d'un code OTP par e-mail
      setLoading2FA(true);
      setDisable2FAError(null);
      setDisable2FACode('');
      try {
        const res = await authService.requestDisable2FA();
        setDisable2FAEmail(res.emailMasked || email);
        setShowDisable2FAModal(true);
      } catch (err: any) {
        setTwoFAMsg({ type: 'error', text: err.message || "Impossible d'envoyer le code de vérification." });
      } finally {
        setLoading2FA(false);
      }
    } else {
      // Pour activer : activation directe sécurisée
      setLoading2FA(true);
      try {
        const updated = await authService.enable2FA();
        setIs2FAEnabled(updated);
        setTwoFAMsg({ type: 'success', text: "Double authentification activée avec succès !" });
      } catch (err: any) {
        setTwoFAMsg({ type: 'error', text: err.message || "Erreur lors de l'activation." });
      } finally {
        setLoading2FA(false);
      }
    }
  };

  const handleConfirmDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disable2FACode.trim()) return;
    setIsDisabling2FA(true);
    setDisable2FAError(null);
    try {
      const updated = await authService.confirmDisable2FA(disable2FACode);
      setIs2FAEnabled(updated);
      setShowDisable2FAModal(false);
      setTwoFAMsg({ type: 'success', text: "Double authentification désactivée avec succès." });
    } catch (err: any) {
      setDisable2FAError(err.message || "Code incorrect ou expiré.");
    } finally {
      setIsDisabling2FA(false);
    }
  };

  const handleResendDisableCode = async () => {
    setDisable2FAError(null);
    try {
      const res = await authService.requestDisable2FA();
      alert(res.message || "Un nouveau code a été envoyé.");
    } catch (err: any) {
      setDisable2FAError(err.message || "Impossible de renvoyer le code.");
    }
  };

  const loadDevices = async () => {
    try {
      const devs = await deviceService.getMyDevices();
      setDevices(devs);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingProfile(true);
    setProfileMsg({ type: '', text: '' });
    try {
      await authService.updateProfile(firstname, lastname);
      setProfileMsg({ type: 'success', text: 'Profil mis à jour avec succès' });
    } catch (error: any) {
      setProfileMsg({ type: 'error', text: error.message });
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg({ type: '', text: '' });

    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: 'error', text: 'Les mots de passe ne correspondent pas' });
      return;
    }

    setLoadingPwd(true);
    try {
      await authService.updatePassword(currentPassword, newPassword);
      setPwdMsg({ type: 'success', text: 'Mot de passe modifié avec succès' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setPwdMsg({ type: 'error', text: error.message });
    } finally {
      setLoadingPwd(false);
    }
  };


  const handleOpenUnpairModal = (devId: string) => {
    setTargetUnpairDeviceId(devId);
    setUnpairPassword('');
    setShowUnpairModal(true);
  };

  const handleConfirmUnpair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unpairPassword) return;

    setIsUnpairing(true);
    try {
      await deviceService.unpairDevice(targetUnpairDeviceId, unpairPassword);
      setShowUnpairModal(false);
      setDeviceMsg({ type: 'success', text: "L'appareil a été dissocié avec succès de votre compte." });
      loadDevices();
    } catch (err: any) {
      alert(err.message || "Erreur lors de la dissociation.");
    } finally {
      setIsUnpairing(false);
    }
  };

  const handleGenerateNewCode = async (devId: string) => {
    setLoadingCode(true);
    setTargetDeviceIdForCode(devId);
    setCodeCopied(false);
    try {
      const res = await deviceService.refreshPairingCode(devId);
      setGeneratedCode(res.new_pairing_code);
      setShowCodeModal(true);
    } catch (err: any) {
      alert(err.message || "Erreur lors de la génération du code.");
    } finally {
      setLoadingCode(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">MON COMPTE</h1>
        <button 
          onClick={() => navigate('/reglages')} 
          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '8px' }}
          title="Aller aux réglages"
        >
          <SettingsIcon size={24} />
        </button>
      </div>

      {/* Section Appareils Raspberry Pi Liés */}
      <section className="profile-section">
        <h2 className="profile-section-title">MES ÉQUIPEMENTS RASPBERRY PI 4</h2>
        
        {deviceMsg.text && (
          <div className={`profile-msg ${deviceMsg.type}`} style={{ marginBottom: '16px' }}>
            {deviceMsg.text}
          </div>
        )}

        {devices.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {devices.map((dev) => (
              <div key={dev.id} className="device-card">
                <div className="device-card-header">
                  <div>
                    <h3 className="device-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <RadioIcon size={16} />
                      {dev.name}
                    </h3>
                    <span className="device-id-badge">{dev.device_id}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span className={`device-role-badge ${dev.role === 'owner' ? 'role-owner' : 'role-member'}`}>
                      {dev.role === 'owner' ? 'Propriétaire' : 'Membre partagé'}
                    </span>
                    <span className="device-status-badge">● Connecté (Sécurisé)</span>
                  </div>
                </div>

                <div className="device-details-row">
                  <span>Protocole : <strong>Chiffrement propriétaire</strong></span>
                  <span>Lié le : {dev.paired_at ? new Date(dev.paired_at).toLocaleDateString('fr-FR') : 'Récemment'}</span>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {dev.role === 'owner' && (
                    <button
                      type="button"
                      className="device-refresh-btn"
                      onClick={() => handleGenerateNewCode(dev.device_id)}
                      disabled={loadingCode && targetDeviceIdForCode === dev.device_id}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <KeyIcon size={14} />
                      <span>{loadingCode && targetDeviceIdForCode === dev.device_id ? 'Génération...' : "Inviter / Nouveau code"}</span>
                    </button>
                  )}
                  <button 
                    type="button" 
                    className="device-unpair-btn"
                    onClick={() => handleOpenUnpairModal(dev.device_id)}
                  >
                    Dissocier cet appareil
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <div className="device-empty-state">
              Aucun Raspberry Pi n'est actuellement lié à votre compte.
            </div>

            <button 
              type="button" 
              className="btn" 
              style={{ marginTop: '16px', width: '100%' }}
              onClick={() => navigate('/pair')}
            >
              + Lier mon Raspberry Pi
            </button>
          </div>
        )}
      </section>

      {/* Modal Dissociation avec mot de passe */}
      {showUnpairModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '16px', padding: '24px', maxWidth: '400px', width: '100%',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6)'
          }}>
            <h3 style={{ color: '#fff', marginTop: 0 }}>Dissocier l'appareil ?</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '13px', lineHeight: '1.4' }}>
              Pour des raisons de sécurité, veuillez confirmer votre mot de passe pour dissocier l'appareil <strong>{targetUnpairDeviceId}</strong>.
            </p>
            <form onSubmit={handleConfirmUnpair} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '6px' }}>
                  Votre mot de passe actuel
                </label>
                <input 
                  type="password"
                  value={unpairPassword}
                  onChange={(e) => setUnpairPassword(e.target.value)}
                  placeholder="Mot de passe"
                  required
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)',
                    color: '#fff', fontSize: '14px', boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowUnpairModal(false)}
                  style={{ flex: 1 }}
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="btn" 
                  disabled={isUnpairing}
                  style={{ flex: 1, backgroundColor: '#ef4444', borderColor: '#ef4444' }}
                >
                  {isUnpairing ? 'Dissociation...' : 'Confirmer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nouveau Code d'Appairage (Partage Propriétaire) */}
      {showCodeModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '100%',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6)'
          }}>
            <h3 style={{ color: '#fff', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LockIcon size={18} />
              <span>Code d'Appairage Sécurisé</span>
            </h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '13px', lineHeight: '1.5', margin: '0 0 16px 0' }}>
              Un nouveau code valide pendant <strong>24 heures</strong> a été généré pour votre appareil <strong>{targetDeviceIdForCode}</strong>.
            </p>

            <div style={{
              background: '#0d0d12', border: '1px dashed #ff4500', borderRadius: '12px',
              padding: '18px', textAlign: 'center', marginBottom: '16px'
            }}>
              <span style={{
                fontFamily: 'Consolas, monospace', fontSize: '28px', fontWeight: 800,
                color: '#ff5722', letterSpacing: '4px', display: 'block'
              }}>
                {generatedCode}
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', display: 'block' }}>
                Expire dans 24 heures
              </span>
            </div>

            <p style={{ color: 'var(--text-dim)', fontSize: '12px', lineHeight: '1.4', margin: '0 0 20px 0' }}>
              Transmettez ce code à la personne souhaitant associer votre caméra. Dès qu'elle l'aura enregistré, vous recevrez une alerte de sécurité et son compte deviendra membre partagé.
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn"
                onClick={handleCopyCode}
                style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                {codeCopied ? (
                  <>
                    <CheckIcon size={16} />
                    <span>Copié !</span>
                  </>
                ) : (
                  <>
                    <CopyIcon size={16} />
                    <span>Copier le code</span>
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCodeModal(false)}
                style={{ flex: 1 }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Désactivation 2FA sécurisée avec code e-mail */}
      {showDisable2FAModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'var(--surface)', border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '16px', padding: '26px', maxWidth: '420px', width: '100%',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.75)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444'
              }}>
                <ShieldAlertIcon size={22} />
              </div>
              <h3 style={{ color: '#fff', margin: 0, fontSize: '18px' }}>Désactiver la Double Authentification</h3>
            </div>
            
            <p style={{ color: 'var(--text-dim)', fontSize: '13px', lineHeight: '1.5', marginTop: '6px' }}>
              Pour garantir la sécurité de votre compte, saisissez le code à 6 chiffres envoyé à votre adresse e-mail :
            </p>
            <div style={{
              background: 'rgba(0, 210, 255, 0.08)',
              border: '1px solid rgba(0, 210, 255, 0.25)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#38bdf8',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'monospace',
              textAlign: 'center',
              marginBottom: '14px'
            }}>
              {disable2FAEmail}
            </div>

            <form onSubmit={handleConfirmDisable2FA} className="profile-form">
              <div className="profile-form-group">
                <label>Code de confirmation (6 chiffres)</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  maxLength={6}
                  value={disable2FACode} 
                  onChange={(e) => setDisable2FACode(e.target.value.replace(/\D/g, ''))} 
                  placeholder="••••••" 
                  required 
                  autoFocus
                  style={{
                    letterSpacing: '8px',
                    fontSize: '22px',
                    textAlign: 'center',
                    fontWeight: 700,
                    fontFamily: 'Consolas, Monaco, monospace',
                    background: '#12121a',
                    border: '1px solid #38384f',
                    color: '#ff5722'
                  }}
                />
              </div>

              {disable2FAError && (
                <div className="profile-msg error" style={{ fontSize: '12px', padding: '8px', marginTop: '4px' }}>
                  {disable2FAError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                <button
                  type="button"
                  onClick={handleResendDisableCode}
                  style={{
                    background: 'none', border: 'none', color: '#00d2ff', fontSize: '12px',
                    cursor: 'pointer', padding: '4px 0', textDecoration: 'underline'
                  }}
                >
                  Renvoyer un code
                </button>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                <button 
                  type="button" 
                  className="btn btn-dark" 
                  style={{ flex: 1 }} 
                  onClick={() => setShowDisable2FAModal(false)}
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="btn" 
                  style={{ flex: 1, background: '#ef4444' }} 
                  disabled={isDisabling2FA || disable2FACode.length !== 6}
                >
                  {isDisabling2FA ? 'Vérification...' : 'Confirmer la désactivation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Section Informations Personnelles */}
      <section className="profile-section">
        <h2 className="profile-section-title">INFORMATIONS PERSONNELLES</h2>
        <form className="profile-form" onSubmit={handleUpdateProfile}>
          <div className="profile-form-group">
            <label>Adresse Email</label>
            <input type="text" value={email} disabled className="disabled-input" />
          </div>
          <div className="profile-form-group">
            <label>Prénom</label>
            <input
              type="text"
              value={firstname}
              onChange={(e) => setFirstname(e.target.value)}
              placeholder="Votre prénom"
            />
          </div>
          <div className="profile-form-group">
            <label>Nom</label>
            <input
              type="text"
              value={lastname}
              onChange={(e) => setLastname(e.target.value)}
              placeholder="Votre nom"
            />
          </div>

          {profileMsg.text && (
            <div className={`profile-msg ${profileMsg.type}`}>{profileMsg.text}</div>
          )}

          <button type="submit" className="btn" disabled={loadingProfile}>
            {loadingProfile ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>
        </form>
      </section>

      {/* Section Double Authentification (2FA) */}
      <section className="profile-section">
        <h2 className="profile-section-title">DOUBLE AUTHENTIFICATION (2FA PAR EMAIL)</h2>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px',
          background: 'var(--surface-2)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: is2FAEnabled ? 'rgba(0, 210, 255, 0.12)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${is2FAEnabled ? '#00d2ff' : '#ef4444'}`,
              color: is2FAEnabled ? '#00d2ff' : '#ef4444'
            }}>
              <ShieldCheckIcon size={24} />
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: '15px' }}>
                {is2FAEnabled ? 'Protection 2FA Active' : 'Protection 2FA Désactivée'}
              </div>
              <div style={{ color: 'var(--text-dim)', fontSize: '12px', marginTop: '2px' }}>
                {is2FAEnabled 
                  ? 'Un code à 6 chiffres vous est envoyé par e-mail à chaque tentative de connexion.'
                  : 'Votre compte est protégé uniquement par votre mot de passe.'}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn"
            style={{
              background: is2FAEnabled ? 'rgba(239, 68, 68, 0.2)' : 'linear-gradient(135deg, #00b4db 0%, #0083b0 100%)',
              color: is2FAEnabled ? '#f87171' : '#fff',
              border: is2FAEnabled ? '1px solid rgba(239, 68, 68, 0.4)' : 'none',
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: 600
            }}
            disabled={loading2FA}
            onClick={handleToggle2FA}
          >
            {loading2FA ? 'Modification...' : is2FAEnabled ? 'Désactiver' : 'Activer'}
          </button>
        </div>

        {twoFAMsg.text && (
          <div className={`profile-msg ${twoFAMsg.type}`} style={{ marginTop: '12px' }}>
            {twoFAMsg.text}
          </div>
        )}
      </section>

      {/* Section Sécurité Mot de Passe */}
      <section className="profile-section">
        <h2 className="profile-section-title">SÉCURITÉ DU COMPTE</h2>
        <form className="profile-form" onSubmit={handleUpdatePassword}>
          <div className="profile-form-group">
            <label>Mot de passe actuel</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <div className="profile-form-group">
            <label>Nouveau mot de passe</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <div className="profile-form-group">
            <label>Confirmer le nouveau mot de passe</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {pwdMsg.text && (
            <div className={`profile-msg ${pwdMsg.type}`}>{pwdMsg.text}</div>
          )}

          <button type="submit" className="btn btn-dark" disabled={loadingPwd}>
            {loadingPwd ? 'Mise à jour...' : 'Modifier le mot de passe'}
          </button>
        </form>
      </section>

      {/* Section Demandes d'assistance */}
      <section className="profile-section">
        <h2 className="profile-section-title">MES DEMANDES D'ASSISTANCE</h2>
        {loadingTickets ? (
          <div style={{ color: 'var(--text-dim)' }}>Chargement de vos demandes...</div>
        ) : tickets.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
            Aucune demande d'assistance n'a été créée pour le moment.
          </div>
        ) : (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '12px',
            maxHeight: '420px',
            overflowY: 'auto',
            paddingRight: '8px'
          }}>
            {tickets.map(ticket => (
              <div key={ticket.id} style={{ 
                background: 'var(--bg-card)', 
                border: '1px solid var(--border)', 
                borderRadius: '12px', 
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldAlertIcon size={16} color="var(--danger)" />
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>Demande #{ticket.id}</span>
                  </div>
                </div>
                
                <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                  <strong>Localisation :</strong> {ticket.location || 'Inconnue'}
                </div>
                
                {ticket.description && (
                  <div style={{ 
                    fontSize: '13px', 
                    color: '#fff', 
                    background: 'rgba(0,0,0,0.3)', 
                    padding: '10px', 
                    borderRadius: '8px',
                    marginTop: '4px',
                    borderLeft: '2px solid rgba(255,255,255,0.1)',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {ticket.description}
                  </div>
                )}
                
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px', textAlign: 'right' }}>
                  Soumis le : {new Date(ticket.created_at).toLocaleString('fr-FR')}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
