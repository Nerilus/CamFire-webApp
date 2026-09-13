import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  PlusIcon, MinusIcon, GlobeIcon, ChevronRightIcon, TrashIcon, MailIcon,
  ShieldIcon, ActivityIcon, CpuIcon, HardDriveIcon, WifiIcon, BatteryIcon
} from '../components/icons';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { contactService, type EmergencyContact } from '../services/contactService';
import { deviceService, type Device, type DeviceMember } from '../services/deviceService';
import { notificationService } from '../services/notificationService';
import { DeviceLiveControls } from '../components/DeviceLiveControls';
import './Settings.css';

type Sensitivity = 'low' | 'medium' | 'high';

const parseMasks = (raw?: string | null): Array<{ label: string; x: number; y: number; width: number; height: number }> => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [autoScan, setAutoScan] = useState(true);
  const [interval, setIntervalValue] = useState(60);
  const [sensitivity, setSensitivity] = useState<Sensitivity>('high');

  // Contacts d'urgence
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', role: '' });

  // Gestion d'équipe & Accès partagés
  const [ownedDevices, setOwnedDevices] = useState<Device[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ [deviceId: string]: DeviceMember[] }>({});
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamMsg, setTeamMsg] = useState<{ type: string; text: string }>({ type: '', text: '' });

  // Masquage RGPD & Santé Matérielle
  const [newMaskLabel, setNewMaskLabel] = useState('Voie publique');
  const [newMaskPreset, setNewMaskPreset] = useState<'top_right' | 'top_left' | 'bottom_strip' | 'full_left'>('top_right');
  const [isSavingMasks, setIsSavingMasks] = useState(false);
  const [pushPermissionGranted, setPushPermissionGranted] = useState(() => notificationService.isPermissionGranted());
  const [pushFeedbackMsg, setPushFeedbackMsg] = useState('');

  // Alertes E-mail d'Urgence (Photo Snapshot)
  const [emergencyAlertsEnabled, setEmergencyAlertsEnabled] = useState(true);
  const [emergencyAlertEmails, setEmergencyAlertEmails] = useState<string[]>([]);
  const [newEmergencyEmail, setNewEmergencyEmail] = useState('');
  const [savingAlertSettings, setSavingAlertSettings] = useState(false);
  const [testingAlert, setTestingAlert] = useState(false);
  const [alertFeedbackMsg, setAlertFeedbackMsg] = useState<{ type: string; text: string }>({ type: '', text: '' });

  // Modales de confirmation personnalisées
  const [emailToDelete, setEmailToDelete] = useState<string | null>(null);
  const [memberToRevoke, setMemberToRevoke] = useState<{ deviceId: string; userId: number; email: string } | null>(null);
  const [contactToDelete, setContactToDelete] = useState<EmergencyContact | null>(null);

  useEffect(() => {
    loadContacts();
    loadTeamData();
    loadEmergencyAlertSettings();
  }, []);

  const loadContacts = async () => {
    try {
      const data = await contactService.getContacts();
      setContacts(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadTeamData = async () => {
    setTeamLoading(true);
    try {
      const myDevs = await deviceService.getMyDevices();
      const owners = myDevs.filter((d) => d.role === 'owner');
      setOwnedDevices(owners);

      const membersMap: { [deviceId: string]: DeviceMember[] } = {};
      for (const dev of owners) {
        try {
          const members = await deviceService.getDeviceMembers(dev.device_id);
          // Ne conserver que les comptes invités (exclure le propriétaire lui-même)
          membersMap[dev.device_id] = members.filter((m) => m.role !== 'owner');
        } catch {
          membersMap[dev.device_id] = [];
        }
      }
      setTeamMembers(membersMap);
    } catch (e) {
      console.error('Erreur chargement équipe:', e);
    } finally {
      setTeamLoading(false);
    }
  };

  const loadEmergencyAlertSettings = async () => {
    try {
      const settings = await contactService.getEmergencyAlertSettings();
      setEmergencyAlertsEnabled(settings.emergency_alerts_enabled);
      setEmergencyAlertEmails(settings.emergency_alert_emails || []);
    } catch (e) {
      console.error('Erreur chargement alertes email:', e);
    }
  };

  const handleConfirmRevokeMember = async () => {
    if (!memberToRevoke) return;
    const { deviceId, userId, email } = memberToRevoke;
    setMemberToRevoke(null);
    setTeamMsg({ type: '', text: '' });
    try {
      await deviceService.revokeMember(deviceId, userId);
      setTeamMsg({ type: 'success', text: `L'accès de ${email} a été révoqué avec succès.` });
      loadTeamData();
    } catch (err: any) {
      setTeamMsg({ type: 'error', text: err.message || "Échec de la révocation de l'accès." });
    }
  };

  const handleAddPrivacyMask = async (device: Device) => {
    let coords = { x: 0.65, y: 0, width: 0.35, height: 0.4 };
    if (newMaskPreset === 'top_left') {
      coords = { x: 0, y: 0, width: 0.35, height: 0.4 };
    } else if (newMaskPreset === 'bottom_strip') {
      coords = { x: 0, y: 0.75, width: 1.0, height: 0.25 };
    } else if (newMaskPreset === 'full_left') {
      coords = { x: 0, y: 0, width: 0.3, height: 1.0 };
    }

    const currentMasks = parseMasks(device.privacy_masks);
    const newMask = {
      label: newMaskLabel.trim() || 'Zone masquée RGPD',
      ...coords
    };
    const updatedMasks = [...currentMasks, newMask];
    const jsonString = JSON.stringify(updatedMasks);
    setIsSavingMasks(true);
    try {
      await deviceService.updatePrivacyMasks(device.device_id, jsonString);
      setOwnedDevices(prev => prev.map(d => d.id === device.id ? { ...d, privacy_masks: jsonString } : d));
      setTeamMsg({ type: 'success', text: `Zone d'occultation RGPD ajoutée sur ${device.name}.` });
    } catch (err: any) {
      setTeamMsg({ type: 'error', text: err.message || "Erreur lors de la mise à jour des masques RGPD." });
    } finally {
      setIsSavingMasks(false);
    }
  };

  const handleRemovePrivacyMask = async (device: Device, indexToRemove: number) => {
    const currentMasks = parseMasks(device.privacy_masks);
    const updatedMasks = currentMasks.filter((_, i) => i !== indexToRemove);
    const jsonString = JSON.stringify(updatedMasks);
    setIsSavingMasks(true);
    try {
      await deviceService.updatePrivacyMasks(device.device_id, jsonString);
      setOwnedDevices(prev => prev.map(d => d.id === device.id ? { ...d, privacy_masks: jsonString } : d));
      setTeamMsg({ type: 'success', text: `Zone d'occultation RGPD supprimée.` });
    } catch (err: any) {
      setTeamMsg({ type: 'error', text: err.message || "Erreur lors de la suppression du masque." });
    } finally {
      setIsSavingMasks(false);
    }
  };

  const handleEnablePushNotifications = async () => {
    const granted = await notificationService.requestPermission();
    setPushPermissionGranted(granted);
    if (granted) {
      setPushFeedbackMsg("Notifications push activées avec succès !");
    } else {
      setPushFeedbackMsg("Permission des notifications refusée ou non supportée.");
    }
    setTimeout(() => setPushFeedbackMsg(''), 4000);
  };

  const handleTestPushAndAudio = () => {
    notificationService.notifyEmergency(
      "Test CamFire Incendie",
      "Vérification du système d'alerte : sirène audio et notification push opérationnelles !"
    );
    setPushFeedbackMsg("Signal sonore et notification d'urgence déclenchés !");
    setTimeout(() => setPushFeedbackMsg(''), 4000);
  };

  const handleToggleEmergencyAlerts = async () => {
    const newVal = !emergencyAlertsEnabled;
    setEmergencyAlertsEnabled(newVal);
    try {
      await contactService.updateEmergencyAlertSettings(emergencyAlertEmails, newVal);
      setAlertFeedbackMsg({
        type: 'success',
        text: newVal ? "Alertes incendie par e-mail activées." : "Alertes incendie par e-mail désactivées."
      });
    } catch (err: any) {
      setAlertFeedbackMsg({ type: 'error', text: err.message || "Erreur lors de la mise à jour." });
    }
  };

  const handleAddEmergencyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailToAdd = newEmergencyEmail.trim().toLowerCase();
    if (!emailToAdd) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToAdd)) {
      setAlertFeedbackMsg({ type: 'error', text: "Veuillez entrer une adresse e-mail valide." });
      return;
    }
    if (emergencyAlertEmails.some((em) => em.toLowerCase() === emailToAdd)) {
      setAlertFeedbackMsg({ type: 'error', text: "Cette adresse e-mail est déjà dans la liste des destinataires." });
      return;
    }

    const updated = [...emergencyAlertEmails, emailToAdd];
    setSavingAlertSettings(true);
    setAlertFeedbackMsg({ type: '', text: '' });
    try {
      const res = await contactService.updateEmergencyAlertSettings(updated, emergencyAlertsEnabled);
      setEmergencyAlertEmails(res.emergency_alert_emails);
      setNewEmergencyEmail('');
      setAlertFeedbackMsg({ type: 'success', text: `L'adresse e-mail ${emailToAdd} a été ajoutée avec succès.` });
    } catch (err: any) {
      setAlertFeedbackMsg({ type: 'error', text: err.message || "Erreur lors de l'ajout de l'e-mail." });
    } finally {
      setSavingAlertSettings(false);
    }
  };

  const handleConfirmDeleteEmergencyEmail = async () => {
    if (!emailToDelete) return;
    const target = emailToDelete;
    setEmailToDelete(null);
    const updated = emergencyAlertEmails.filter((em) => em.toLowerCase() !== target.toLowerCase());
    setSavingAlertSettings(true);
    setAlertFeedbackMsg({ type: '', text: '' });
    try {
      const res = await contactService.updateEmergencyAlertSettings(updated, emergencyAlertsEnabled);
      setEmergencyAlertEmails(res.emergency_alert_emails);
      setAlertFeedbackMsg({ type: 'success', text: `L'adresse ${target} a été supprimée des alertes.` });
    } catch (err: any) {
      setAlertFeedbackMsg({ type: 'error', text: err.message || "Erreur lors de la suppression de l'e-mail." });
    } finally {
      setSavingAlertSettings(false);
    }
  };

  const handleTestEmergencyAlert = async () => {
    setTestingAlert(true);
    setAlertFeedbackMsg({ type: '', text: '' });
    try {
      const res = await contactService.testEmergencyAlert();
      setAlertFeedbackMsg({ type: 'success', text: res.message });
    } catch (err: any) {
      setAlertFeedbackMsg({ type: 'error', text: err.message || "Erreur lors de l'envoi de l'e-mail de test." });
    } finally {
      setTestingAlert(false);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.name || !newContact.phone || !newContact.role) return;
    try {
      await contactService.addContact(newContact.name, newContact.phone, newContact.role, newContact.email);
      setShowModal(false);
      setNewContact({ name: '', phone: '', email: '', role: '' });
      loadContacts();
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfirmDeleteContact = async () => {
    if (!contactToDelete) return;
    const { id } = contactToDelete;
    setContactToDelete(null);
    try {
      await contactService.deleteContact(id);
      loadContacts();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">RÉGLAGES</h1>
      </div>

      {/* 1. GESTION D'ÉQUIPE & ACCÈS PARTAGÉS */}
      <section className="settings-section">
        <h2 className="settings-section-title">GESTION D'ÉQUIPE & MEMBRES PARTAGÉS</h2>

        {teamMsg.text && (
          <div className={`settings-msg ${teamMsg.type}`}>
            {teamMsg.text}
          </div>
        )}

        {teamLoading ? (
          <div className="team-empty">Chargement des membres de votre équipement...</div>
        ) : ownedDevices.length > 0 ? (
          <div>
            {ownedDevices.map((dev) => {
              const members = teamMembers[dev.device_id] || [];
              return (
                <div key={dev.id} className="team-device-block">
                  <div className="team-device-header">
                    <h3 className="team-device-title">{dev.name}</h3>
                    <span className="team-device-badge">{dev.device_id}</span>
                  </div>

                  {/* TÉLÉMÉTRIE MATÉRIELLE & WATCHDOG IOT */}
                  {(() => {
                    const isOnline = dev.last_seen_at ? (Date.now() - new Date(dev.last_seen_at).getTime()) < 180000 : false;
                    const masks = parseMasks(dev.privacy_masks);
                    return (
                      <>
                      <div className="hardware-telemetry-card">
                        <div className="hardware-telemetry-top">
                          <div className="hardware-status-row">
                            <span className={`hardware-status-dot ${isOnline ? 'online' : 'offline'}`} />
                            <strong style={{ fontSize: '12px', color: isOnline ? '#4ade80' : '#f87171' }}>
                              {isOnline ? 'EN LIGNE · Watchdog Actif' : 'HORS-LIGNE (> 3 min)'}
                            </strong>
                          </div>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            Dernier ping : {dev.last_seen_at ? new Date(dev.last_seen_at).toLocaleTimeString('fr-FR') : 'Inconnu'}
                          </span>
                        </div>

                        {!isOnline && (
                          <div className="watchdog-alert-box">
                            <ActivityIcon size={14} color="#ef4444" />
                            <span>Alerte Watchdog : Ce Raspberry Pi n'émet plus de signal depuis {dev.last_seen_at ? new Date(dev.last_seen_at).toLocaleString('fr-FR') : 'inconnue'}. Vérifiez l'alimentation ou le réseau.</span>
                          </div>
                        )}

                        <div className="hardware-metrics-grid">
                          <div className="hardware-metric-item">
                            <div className="metric-header">
                              <CpuIcon size={14} color="#38bdf8" />
                              <span>Température CPU</span>
                            </div>
                            <strong className="metric-value" style={{ color: (dev.cpu_temp || 0) > 75 ? '#ef4444' : (dev.cpu_temp || 0) > 60 ? '#f59e0b' : '#38bdf8' }}>
                              {dev.cpu_temp ? `${dev.cpu_temp.toFixed(1)}°C` : 'N/A'}
                            </strong>
                          </div>

                          <div className="hardware-metric-item">
                            <div className="metric-header">
                              <HardDriveIcon size={14} color="#a855f7" />
                              <span>Disque Libre</span>
                            </div>
                            <strong className="metric-value" style={{ color: (dev.disk_free_gb !== undefined && dev.disk_free_gb < 2) ? '#ef4444' : '#f8fafc' }}>
                              {dev.disk_free_gb !== undefined ? `${dev.disk_free_gb.toFixed(1)} Go` : 'N/A'}
                            </strong>
                          </div>

                          <div className="hardware-metric-item">
                            <div className="metric-header">
                              <WifiIcon size={14} color="#22c55e" />
                              <span>Réseau (RSSI)</span>
                            </div>
                            <strong className="metric-value">
                              {dev.wifi_rssi !== undefined ? `${dev.wifi_rssi} dBm` : 'N/A'}
                            </strong>
                          </div>

                          <div className="hardware-metric-item">
                            <div className="metric-header">
                              <BatteryIcon size={14} color="#eab308" />
                              <span>Alimentation</span>
                            </div>
                            <strong className="metric-value">
                              {dev.battery_voltage !== undefined ? `${dev.battery_voltage.toFixed(1)} V` : '5.1 V (Secteur)'}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* MASQUAGE DE CONFIDENTIALITÉ RGPD */}
                      <div className="privacy-masking-card">
                        <div className="privacy-masking-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ShieldIcon size={16} color="#38bdf8" />
                            <h4 style={{ margin: 0, fontSize: '13px', color: '#f8fafc' }}>Conformité RGPD & Occultation Vidéo</h4>
                          </div>
                          <span className="privacy-masking-count">
                            {masks.length} zone{masks.length > 1 ? 's' : ''}
                          </span>
                        </div>

                        <p style={{ margin: '6px 0 10px', fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.4 }}>
                          Occultez en noir les voies publiques ou propriétés mitoyennes sur le flux vidéo et les analyses IA conformément à la législation RGPD et CNIL.
                        </p>

                        {masks.length > 0 ? (
                          <div className="privacy-masks-list">
                            {masks.map((mask, idx) => (
                              <div key={idx} className="privacy-mask-item">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: '8px', height: '8px', background: '#38bdf8', borderRadius: '2px' }} />
                                  <span style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 600 }}>{mask.label || `Masque #${idx + 1}`}</span>
                                  <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                                    ({Math.round(mask.width * 100)}% × {Math.round(mask.height * 100)}%)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  className="privacy-mask-delete"
                                  onClick={() => handleRemovePrivacyMask(dev, idx)}
                                  disabled={isSavingMasks}
                                  title="Supprimer ce masque d'occultation"
                                >
                                  <TrashIcon size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: '11.5px', color: '#64748b', fontStyle: 'italic', marginBottom: '10px' }}>
                            Aucune zone d'occultation configurée sur cette caméra.
                          </div>
                        )}

                        <div className="privacy-add-row">
                          <input
                            type="text"
                            className="privacy-label-input"
                            placeholder="Libellé (ex: Voie publique)"
                            value={newMaskLabel}
                            onChange={(e) => setNewMaskLabel(e.target.value)}
                          />
                          <select
                            className="privacy-preset-select"
                            value={newMaskPreset}
                            onChange={(e) => setNewMaskPreset(e.target.value as any)}
                          >
                            <option value="top_right">Angle Haut Droit (35% x 40%)</option>
                            <option value="top_left">Angle Haut Gauche (35% x 40%)</option>
                            <option value="bottom_strip">Bandeau Inférieur (Route au sol)</option>
                            <option value="full_left">Bande Latérale Gauche</option>
                          </select>
                          <button
                            type="button"
                            className="privacy-add-btn"
                            onClick={() => handleAddPrivacyMask(dev)}
                            disabled={isSavingMasks}
                          >
                            <PlusIcon size={13} />
                            <span>Ajouter</span>
                          </button>
                        </div>
                      </div>
                      </>
                    );
                  })()}

                  {members.length > 0 ? (
                    <div className="team-members-list">
                      {members.map((m) => (
                        <div key={m.user_id} className="team-member-row">
                          <div className="team-member-avatar">
                            {(m.firstname ? m.firstname[0] : m.email[0]).toUpperCase()}
                          </div>
                          <div className="team-member-info">
                            <span className="team-member-email">
                              {m.firstname || m.lastname ? `${m.firstname || ''} ${m.lastname || ''} (${m.email})` : m.email}
                            </span>
                            <span className="team-member-date">
                              Associé le : {m.paired_at ? new Date(m.paired_at).toLocaleDateString('fr-FR') : 'Récemment'}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="team-revoke-btn"
                            onClick={() => setMemberToRevoke({ deviceId: dev.device_id, userId: m.user_id, email: m.email })}
                          >
                            Révoquer l'accès
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="team-empty">
                      Aucun membre invité sur cet appareil.
                    </div>
                  )}

                  <div style={{ marginTop: '16px' }}>
                    <DeviceLiveControls
                      device={dev}
                      onDeviceUpdate={(updated) => {
                        setOwnedDevices((prev) =>
                          prev.map((d) => (d.id === dev.id ? { ...d, ...updated } : d))
                        );
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="team-empty" style={{ textAlign: 'left', padding: '14px' }}>
            Vous n'avez aucun équipement en tant que propriétaire. Liez votre Raspberry Pi pour gérer ses accès partagés.
          </div>
        )}
      </section>

      {/* 2. ALERTES E-MAIL D'URGENCE AVEC PHOTO */}
      <section className="settings-section">
        <div className="emergency-header-row">
          <h2 className="settings-section-title" style={{ margin: 0 }}>ALERTES E-MAIL D'URGENCE (PHOTO SNAPSHOT)</h2>
          <span className="emergency-badge-count">
            {emergencyAlertEmails.length} e-mail{emergencyAlertEmails.length > 1 ? 's' : ''}
          </span>
        </div>

        {alertFeedbackMsg.text && (
          <div className={`settings-msg ${alertFeedbackMsg.type}`}>
            {alertFeedbackMsg.text}
          </div>
        )}

        <div className="emergency-box">
          <p className="emergency-desc">
            Recevez un e-mail d'urgence instantané avec la <strong>photo capturée par l'IA</strong> dès qu'un départ de feu est identifié.
          </p>

          <div className="settings-row" style={{ padding: 0, border: 'none', background: 'transparent' }}>
            <div className="settings-row-text">
              <strong>Activer les alertes incendie par e-mail</strong>
              <span>Envoi immédiat avec photo en pièce jointe aux e-mails ci-dessous</span>
            </div>
            <button
              className={`toggle${emergencyAlertsEnabled ? ' on' : ''}`}
              onClick={handleToggleEmergencyAlerts}
              type="button"
            >
              <span className="knob" />
            </button>
          </div>

          {/* LISTE DES ADRESSES EMAIL CONFIGURÉES */}
          <div className="emergency-emails-container">
            <div className="emergency-emails-header">
              <span className="emergency-emails-title">E-mails à contacter en cas d'alerte :</span>
            </div>

            {emergencyAlertEmails.length === 0 ? (
              <div className="emergency-empty-state">
                <MailIcon size={20} style={{ opacity: 0.6, color: '#ff5722' }} />
                <span>Aucune adresse e-mail configurée. Ajoutez un contact ci-dessous pour être prévenu en cas d'incendie.</span>
              </div>
            ) : (
              <div className="emergency-emails-list">
                {emergencyAlertEmails.map((email) => (
                  <div key={email} className="emergency-email-item">
                    <div className="emergency-email-left">
                      <div className="emergency-email-icon-wrapper">
                        <MailIcon size={16} />
                      </div>
                      <div className="emergency-email-info">
                        <span className="emergency-email-address">{email}</span>
                        <span className="emergency-email-badge">Alerte avec photo</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="emergency-delete-btn"
                      onClick={() => setEmailToDelete(email)}
                      disabled={savingAlertSettings}
                      title={`Supprimer ${email} des contacts d'urgence`}
                    >
                      <TrashIcon size={14} />
                      <span>Supprimer</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AJOUTER UNE NOUVELLE ADRESSE */}
          <form onSubmit={handleAddEmergencyEmail} className="emergency-add-section">
            <label className="emergency-input-label">Ajouter une adresse e-mail à contacter :</label>
            <div className="emergency-input-row">
              <input
                type="email"
                className="emergency-input"
                placeholder="ex: secours@domaine.com ou mon.contact@gmail.com"
                value={newEmergencyEmail}
                onChange={(e) => setNewEmergencyEmail(e.target.value)}
              />
              <button
                type="submit"
                className="btn btn-primary emergency-add-btn"
                disabled={savingAlertSettings || !newEmergencyEmail.trim()}
              >
                <PlusIcon size={16} />
                <span>Ajouter</span>
              </button>
            </div>
          </form>

          {/* BOUTON TESTER */}
          <div className="emergency-test-container">
            <button
              type="button"
              className="emergency-test-btn"
              onClick={handleTestEmergencyAlert}
              disabled={testingAlert}
              title="Envoie un e-mail de test à tous les destinataires"
            >
              {testingAlert ? 'Envoi du test en cours...' : 'Tester l\'envoi d\'alerte incendie (e-mail de test)'}
            </button>
          </div>
        </div>
      </section>

      {/* 3. SCAN AUTOMATIQUE */}
      <section className="settings-section">
        <h2 className="settings-section-title">SCAN AUTOMATIQUE</h2>
        <div className="settings-row">
          <div className="settings-row-text">
            <strong>Scan automatique activé</strong>
            <span>Analyse en arrière-plan automatiquement</span>
          </div>
          <button className={`toggle${autoScan ? ' on' : ''}`} onClick={() => setAutoScan((v) => !v)}>
            <span className="knob" />
          </button>
        </div>
        <div className="settings-row">
          <div className="settings-row-text">
            <strong>Intervalle de scan</strong>
            <span>Toutes les {interval}s</span>
          </div>
          <div className="stepper">
            <button onClick={() => setIntervalValue((v) => Math.max(10, v - 10))}>
              <MinusIcon size={14} />
            </button>
            <span>{interval}</span>
            <button onClick={() => setIntervalValue((v) => Math.min(300, v + 10))}>
              <PlusIcon size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* 4. SENSIBILITÉ DES ALERTES */}
      <section className="settings-section">
        <h2 className="settings-section-title">SENSIBILITÉ DES ALERTES</h2>
        <div className="segmented">
          {(['low', 'medium', 'high'] as Sensitivity[]).map((s) => (
            <button
              key={s}
              className={`segmented-item${sensitivity === s ? ' active' : ''}`}
              onClick={() => setSensitivity(s)}
            >
              {s === 'low' ? 'FAIBLE' : s === 'medium' ? 'MOYENNE' : 'ÉLEVÉE'}
            </button>
          ))}
        </div>
      </section>

      {/* 5. NOTIFICATIONS */}
      <section className="settings-section">
        <h2 className="settings-section-title">NOTIFICATIONS & ALERTES SONORES</h2>
        
        {pushFeedbackMsg && (
          <div className="settings-msg success" style={{ marginBottom: '10px' }}>
            {pushFeedbackMsg}
          </div>
        )}

        <div className="settings-row">
          <div className="settings-row-text">
            <strong>Notifications push du navigateur</strong>
            <span>Alertes instantanées avec son et vibration lors d'un départ de feu</span>
          </div>
          {pushPermissionGranted ? (
            <span style={{ fontSize: '12px', color: '#4ade80', fontWeight: 700, padding: '4px 10px', background: 'rgba(34, 197, 94, 0.15)', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
              Autorisées
            </span>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: '11.5px', padding: '6px 12px', height: 'auto' }}
              onClick={handleEnablePushNotifications}
            >
              Autoriser
            </button>
          )}
        </div>

        <div className="settings-row" style={{ marginTop: '8px' }}>
          <div className="settings-row-text">
            <strong>Sirène & Bip d'alerte sonore</strong>
            <span>Tester la tonalité d'urgence Web Audio et la notification push</span>
          </div>
          <button
            type="button"
            className="btn btn-dark"
            style={{ fontSize: '11.5px', padding: '6px 12px', height: 'auto', border: '1px solid rgba(255,255,255,0.2)' }}
            onClick={handleTestPushAndAudio}
          >
            Tester l'alerte
          </button>
        </div>
      </section>

      {/* 6. CONTACTS D'URGENCE */}
      <section className="settings-section">
        <div className="settings-section-header">
          <h2 className="settings-section-title">CONTACTS D'URGENCE</h2>
          <button className="settings-add" onClick={() => setShowModal(true)}>
            <PlusIcon size={13} /> AJOUTER
          </button>
        </div>
        <div className="contacts-list">
          {contacts.map((c) => (
            <div className="contact-row" key={c.id}>
              <div className="contact-avatar">{c.name.charAt(0).toUpperCase()}</div>
              <div className="contact-info">
                <strong>{c.name}</strong>
                <span>{c.phone} {c.email ? `• ${c.email}` : ''}</span>
              </div>
              <span className="contact-role">{c.role}</span>
              <button className="contact-delete-btn" onClick={() => setContactToDelete(c)} title={`Supprimer ${c.name}`}>
                <TrashIcon size={16} />
              </button>
            </div>
          ))}
          {contacts.length === 0 && (
            <div className="contact-empty">Aucun contact d'urgence configuré.</div>
          )}
        </div>
      </section>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Ajouter un contact d'urgence</h3>
            <form onSubmit={handleAddContact} className="modal-form">
              <input
                type="text"
                placeholder="Nom complet"
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="Téléphone (+33 6...)"
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                required
              />
              <input
                type="email"
                placeholder="Adresse e-mail (optionnel)"
                value={newContact.email}
                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
              />
              <input
                type="text"
                placeholder="Rôle (Ex: Voisin, Pompiers, Gardien)"
                value={newContact.role}
                onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                required
              />
              <div className="modal-actions">
                <button type="button" className="btn btn-dark" onClick={() => setShowModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn">
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. LANGUE */}
      <section className="settings-section">
        <h2 className="settings-section-title">LANGUE</h2>
        <button className="settings-row link-row">
          <GlobeIcon size={18} />
          <span className="settings-row-text-inline">Français</span>
          <ChevronRightIcon size={18} className="link-row-chevron" />
        </button>
      </section>

      <button
        className="btn btn-dark logout-btn"
        onClick={() => {
          logout();
          navigate('/auth');
        }}
      >
        Se déconnecter
      </button>

      {/* Modal Confirmation de Suppression d'Email d'Urgence */}
      <ConfirmModal
        isOpen={!!emailToDelete}
        title="Supprimer l'e-mail d'urgence ?"
        message="Cette adresse e-mail ne recevra plus les alertes d'urgence avec la photo capturée par l'IA lors d'un départ de feu."
        itemHighlight={emailToDelete || ''}
        itemIcon={<MailIcon size={16} color="#ff7043" />}
        confirmText="Supprimer l'e-mail"
        cancelText="Annuler"
        isDestructive={true}
        isLoading={savingAlertSettings}
        onConfirm={handleConfirmDeleteEmergencyEmail}
        onClose={() => setEmailToDelete(null)}
      />

      {/* Modal Confirmation de Révocation d'Accès Membre */}
      <ConfirmModal
        isOpen={!!memberToRevoke}
        title="Révoquer l'accès à la caméra ?"
        message="Ce membre ne pourra plus visualiser le flux vidéo de votre Raspberry Pi ni recevoir les alertes associées."
        itemHighlight={memberToRevoke?.email || ''}
        confirmText="Révoquer l'accès"
        cancelText="Annuler"
        isDestructive={true}
        onConfirm={handleConfirmRevokeMember}
        onClose={() => setMemberToRevoke(null)}
      />

      {/* Modal Confirmation de Suppression de Contact */}
      <ConfirmModal
        isOpen={!!contactToDelete}
        title="Supprimer ce contact ?"
        message="Êtes-vous sûr de vouloir supprimer ce contact de votre carnet d'urgence ?"
        itemHighlight={contactToDelete ? `${contactToDelete.name} (${contactToDelete.phone})` : ''}
        confirmText="Supprimer le contact"
        cancelText="Annuler"
        isDestructive={true}
        onConfirm={handleConfirmDeleteContact}
        onClose={() => setContactToDelete(null)}
      />
    </div>
  );
};
