import { AccessToken, TrackSource } from 'livekit-server-sdk';

export interface VoiceTokenOptions {
  roomName: string;
  participantIdentity: string;
  participantName: string;
  role: 'customer' | 'rider';
  ttlMinutes?: number;
}

export interface VoiceTokenResult {
  token: string;
  serverUrl: string;
  roomName: string;
  expiresAt: string;
  provider: 'livekit' | 'webrtc-p2p';
}

export interface VoiceProvider {
  name: string;
  generateToken(options: VoiceTokenOptions): Promise<VoiceTokenResult>;
}

/**
 * LiveKit Cloud Voice Provider Implementation
 */
export class LiveKitVoiceProvider implements VoiceProvider {
  name = 'livekit';

  private apiKey: string;
  private apiSecret: string;
  private wsUrl: string;

  constructor() {
    this.apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
    this.apiSecret = process.env.LIVEKIT_API_SECRET || 'secret_jfc_communication_livekit_key_2026';
    this.wsUrl = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://jays-food-court-dev.livekit.cloud';
  }

  async generateToken(options: VoiceTokenOptions): Promise<VoiceTokenResult> {
    const { roomName, participantIdentity, participantName, role, ttlMinutes = 30 } = options;

    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: participantIdentity,
      name: participantName,
      ttl: `${ttlMinutes}m`
    });

    // Voice-only permissions (Strictly no video publish, no screen share, audio only)
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
      canPublishSources: [TrackSource.MICROPHONE]
    });

    const token = await at.toJwt();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

    return {
      token,
      serverUrl: this.wsUrl,
      roomName,
      expiresAt,
      provider: 'livekit'
    };
  }
}

// Default singleton voice provider instance
let defaultVoiceProvider: VoiceProvider = new LiveKitVoiceProvider();

export function getVoiceProvider(): VoiceProvider {
  return defaultVoiceProvider;
}

export function setVoiceProvider(provider: VoiceProvider): void {
  defaultVoiceProvider = provider;
}
