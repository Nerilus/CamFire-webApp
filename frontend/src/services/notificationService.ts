/**
 * CamFire Web Push & Audio Emergency Alerts Service
 * Permet d'envoyer des notifications locales ou push et de jouer une alerte sonore
 */

class NotificationService {
  private hasPermission = false;
  private audioCtx: AudioContext | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.hasPermission = Notification.permission === 'granted';
    }
  }

  /**
   * Demande la permission d'afficher des notifications à l'utilisateur
   */
  async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.hasPermission = permission === 'granted';
      return this.hasPermission;
    } catch {
      return false;
    }
  }

  isPermissionGranted(): boolean {
    return this.hasPermission;
  }

  /**
   * Joue une tonalité de bip d'alerte tactique via l'AudioContext du navigateur
   */
  playEmergencyChime() {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      // Bip 1
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now); // La
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.15);

      // Bip 2 (plus aigu)
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1200, now + 0.18);
      gain2.gain.setValueAtTime(0.35, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.4);
    } catch (e) {
      console.warn("Impossible de jouer le signal sonore d'urgence :", e);
    }
  }

  /**
   * Déclenche une notification système avec vibration et son
   */
  notifyEmergency(title: string, body: string, icon = '/logo.svg') {
    this.playEmergencyChime();

    // Vibration sur smartphone Android
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 300]);
    }

    if (this.hasPermission && 'Notification' in window) {
      try {
        new Notification(title, {
          body,
          icon,
          tag: 'camfire-emergency',
          requireInteraction: true,
        });
      } catch (e) {
        console.warn("Notification error:", e);
      }
    }
  }
}

export const notificationService = new NotificationService();
