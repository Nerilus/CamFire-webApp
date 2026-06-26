import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { SettingsIcon } from '../components/icons';
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

  useEffect(() => {
    loadUserProfile();
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

      <section className="profile-section">
        <h2 className="profile-section-title">SÉCURITÉ</h2>
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
