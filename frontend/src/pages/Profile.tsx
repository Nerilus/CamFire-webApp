import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { deviceService, type Device } from '../services/deviceService';
import { SettingsIcon, RadioIcon } from '../components/icons';
import './Profile.css';

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [loadingProfile, setLoadingProfile] = useState(false);

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

  useEffect(() => {
    loadUserProfile();
    loadDevices();
  }, []);

  const loadUserProfile = async () => {
    try {
      const user = await authService.getMe();
      setFirstname(user.firstname || '');
      setLastname(user.lastname || '');
      setEmail(user.email || '');
    } catch (e) {
      console.error(e);
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
                  <span className="device-status-badge">● Connecté (Sécurisé)</span>
                </div>

                <div className="device-details-row">
                  <span>Protocole : <strong>Chiffrement propriétaire</strong></span>
                  <span>Lié le : {dev.paired_at ? new Date(dev.paired_at).toLocaleDateString('fr-FR') : 'Récemment'}</span>
                </div>

                <button 
                  type="button" 
                  className="device-unpair-btn"
                  onClick={() => handleOpenUnpairModal(dev.device_id)}
                >
                  Dissocier cet appareil
                </button>
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
            <form onSubmit={handleConfirmUnpair} className="profile-form">
              <div className="profile-form-group">
                <label>Mot de passe du compte</label>
                <input 
                  type="password" 
                  value={unpairPassword} 
                  onChange={(e) => setUnpairPassword(e.target.value)} 
                  placeholder="••••••••" 
                  required 
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button 
                  type="button" 
                  className="btn btn-dark" 
                  style={{ flex: 1 }} 
                  onClick={() => setShowUnpairModal(false)}
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="btn" 
                  style={{ flex: 1, background: '#ef4444' }} 
                  disabled={isUnpairing}
                >
                  {isUnpairing ? 'En cours...' : 'Dissocier'}
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
    </div>
  );
};
