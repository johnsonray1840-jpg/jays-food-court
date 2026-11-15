/**
 * Client-Side Notification & PWA Manager for Jay's Food Court
 * Handles:
 * - Service Worker registration
 * - Browser Notification permission requests
 * - Local notifications for new messages, incoming calls, and missed calls
 * - Audio chimes / rings (using Web Audio API synthesizers so no missing external audio assets crash)
 * - Safe fallbacks when browser is backgrounded or notifications are denied
 */

class NotificationManager {
  private hasPermission: boolean = false;
  private audioCtx: AudioContext | null = null;
  private ringtoneInterval: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  private async init() {
    // 1. Register Service Worker if supported
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch (err) {
        console.warn('[PWA] Service worker registration failed:', err);
      }
    }

    // 2. Check Notification Permission
    if ('Notification' in window) {
      this.hasPermission = Notification.permission === 'granted';
    }
  }

  /**
   * Request notification permission from the user
   */
  public async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.hasPermission = permission === 'granted';
      return this.hasPermission;
    } catch (err) {
      console.warn('[PWA] Permission request error:', err);
      return false;
    }
  }

  /**
   * Play an audible chime using Web Audio API (Chime, Ring, or Alert)
   */
  private playTone(type: 'message' | 'ring' | 'missed') {
    if (typeof window === 'undefined') return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (type === 'message') {
        // High, pleasant double chime (880Hz -> 1320Hz)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'ring') {
        // Dual-tone phone ring (440Hz / 480Hz warble)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(480, now + 0.1);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === 'missed') {
        // Descending alert tone (660Hz -> 440Hz)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.linearRampToValueAtTime(440, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) {
      // Audio autoplay policy might block if no user interaction yet
    }
  }

  /**
   * Start ringing loop for incoming call
   */
  public startIncomingRingtone() {
    this.stopIncomingRingtone();
    this.playTone('ring');
    this.ringtoneInterval = setInterval(() => {
      this.playTone('ring');
    }, 2000);
  }

  /**
   * Stop incoming call ringing loop
   */
  public stopIncomingRingtone() {
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
  }

  /**
   * Notify for a newly delivered message
   */
  public notifyNewMessage(senderName: string, content: string, orderCode: string) {
    this.playTone('message');

    // Only display browser notification if tab is hidden / backgrounded
    if (typeof document !== 'undefined' && document.hidden && this.hasPermission) {
      try {
        new Notification(`Message from ${senderName}`, {
          body: content.length > 80 ? content.substring(0, 77) + '...' : content,
          icon: '/favicon.ico',
          tag: `jfc-msg-${orderCode}`,
          data: { url: `/?track=${orderCode}` }
        });
      } catch (e) {
        console.warn('[PWA] Notification display failed:', e);
      }
    }
  }

  /**
   * Notify for incoming voice call
   */
  public notifyIncomingCall(callerName: string, orderCode: string) {
    this.startIncomingRingtone();

    if (typeof document !== 'undefined' && document.hidden && this.hasPermission) {
      try {
        new Notification(`Incoming Call from ${callerName}`, {
          body: `Order #${orderCode} • Tap to answer in Jay's Food Court`,
          icon: '/favicon.ico',
          tag: `jfc-call-${orderCode}`,
          requireInteraction: true,
          data: { url: `/?track=${orderCode}` }
        });
      } catch (e) {
        console.warn('[PWA] Call notification display failed:', e);
      }
    }
  }

  /**
   * Notify for a missed voice call
   */
  public notifyMissedCall(callerName: string, orderCode: string) {
    this.stopIncomingRingtone();
    this.playTone('missed');

    if (this.hasPermission) {
      try {
        new Notification(`Missed Call: ${callerName}`, {
          body: `You missed a call regarding Order #${orderCode}.`,
          icon: '/favicon.ico',
          tag: `jfc-missed-${orderCode}`,
          data: { url: `/?track=${orderCode}` }
        });
      } catch (e) {
        console.warn('[PWA] Missed call notification display failed:', e);
      }
    }
  }
}

export const notificationManager = new NotificationManager();
