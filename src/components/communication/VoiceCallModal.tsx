'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  PhoneCall,
  Volume2,
  VolumeX,
  Shield,
  Loader2,
  WifiOff,
  AlertCircle
} from 'lucide-react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { ActiveCall } from '@/hooks/useOrderCommunication';

interface VoiceCallModalProps {
  call: ActiveCall | null;
  userRole: 'customer' | 'rider';
  counterpartName: string;
  onEndCall: (callId: string, durationSeconds: number, endReason?: string) => void;
  onStatusChange?: (status: ActiveCall['status']) => void;
}

export function VoiceCallModal({
  call,
  userRole,
  counterpartName,
  onEndCall,
  onStatusChange
}: VoiceCallModalProps) {
  const [callState, setCallState] = useState<'initiating' | 'ringing' | 'connecting' | 'connected' | 'reconnecting' | 'ended' | 'failed'>('initiating');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [duration, setDuration] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Initiating secure connection...');
  const [audioError, setAudioError] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const ringTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const durationRef = useRef<number>(0);
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);
  const manualHangupRef = useRef<boolean>(false);
  const hasConnectedRef = useRef<boolean>(false);
  const isSpeakerOnRef = useRef<boolean>(true);

  const onEndCallRef = useRef(onEndCall);
  const onStatusChangeRef = useRef(onStatusChange);
  const callRef = useRef(call);

  useEffect(() => {
    callRef.current = call;
  }, [call]);

  useEffect(() => {
    onEndCallRef.current = onEndCall;
  }, [onEndCall]);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    isSpeakerOnRef.current = isSpeakerOn;
  }, [isSpeakerOn]);

  // Format call duration MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isCaller = call?.caller_role === userRole;

  const clearAudioElements = useCallback(() => {
    audioElementsRef.current.forEach((el) => {
      try {
        el.pause();
        el.remove();
      } catch {
        // Ignore cleanup errors
      }
    });
    audioElementsRef.current = [];
  }, []);

  // Cleanup & Hangup handler
  const handleHangup = useCallback(
    (reason: string = 'normal_hangup') => {
      manualHangupRef.current = true;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }

      const finalDuration = durationRef.current;

      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      clearAudioElements();

      setCallState('ended');
      if (callRef.current) {
        onEndCallRef.current(callRef.current.id, finalDuration, reason);
      }
    },
    [clearAudioElements]
  );

  // Reflect remote callee acceptance for the caller while waiting for WebRTC participant join
  useEffect(() => {
    if (!call || hasConnectedRef.current) return;
    if (isCaller && call.status === 'accepted') {
      setCallState('connecting');
      setStatusMessage('Call accepted, connecting audio...');
    }
  }, [call, isCaller]);

  const callId = call?.id;
  const callToken = call?.token;
  const callLivekitUrl = call?.livekit_url;
  const callOrderCode = call?.order_code;

  // Connect to LiveKit Room
  useEffect(() => {
    if (!callId || !callOrderCode) return;

    let room: Room | null = null;
    let isCleanedUp = false;

    manualHangupRef.current = false;
    hasConnectedRef.current = false;
    durationRef.current = 0;
    startTimeRef.current = null;
    setDuration(0);
    setAudioError(null);
    setIsMuted(false);

    if (isCaller) {
      setCallState('ringing');
      setStatusMessage(
        userRole === 'customer' ? 'Ringing courier phone...' : 'Ringing customer phone...'
      );

      // Caller ringing timeout (cancel after 45s if callee never joins)
      ringTimeoutRef.current = setTimeout(() => {
        if (!hasConnectedRef.current && !manualHangupRef.current && !isCleanedUp) {
          handleHangup('timeout_no_answer');
        }
      }, 45000);
    } else {
      setCallState('connecting');
      setStatusMessage('Connecting audio...');
    }

    const attachAudioTrack = (track: Track) => {
      if (track.kind !== Track.Kind.Audio) return;
      const el = track.attach() as HTMLAudioElement;
      el.autoplay = true;
      el.muted = !isSpeakerOnRef.current;
      audioElementsRef.current.push(el);
      document.body.appendChild(el);
      el.play().catch(() => {
        // Browsers may defer autoplay until startAudio() resolves
      });
    };

    const markTwoWayConnected = () => {
      if (isCleanedUp || hasConnectedRef.current) return;
      hasConnectedRef.current = true;
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }

      setCallState('connected');
      setStatusMessage('Connected');
      startTimeRef.current = Date.now();
      onStatusChangeRef.current?.('connected');

      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          if (startTimeRef.current) {
            const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
            durationRef.current = elapsed;
            setDuration(elapsed);
          }
        }, 1000);
      }
    };

    const connectToRoom = async (token: string, wsUrl: string) => {
      try {
        if (!isCaller) {
          setCallState('connecting');
          setStatusMessage('Establishing encrypted voice channel...');
        }
        setAudioError(null);

        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error('Voice calling requires microphone support in a secure (HTTPS) browser.');
        }

        // Verify microphone permission and release temporary probe stream immediately
        try {
          const probeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          probeStream.getTracks().forEach((t) => t.stop());
        } catch {
          throw new Error('Microphone permission denied. Please allow microphone access to talk.');
        }

        if (isCleanedUp) return;

        room = new Room({
          adaptiveStream: true,
          dynacast: true,
          audioCaptureDefaults: {
            autoGainControl: true,
            echoCancellation: true,
            noiseSuppression: true
          }
        });

        roomRef.current = room;

        room.on(RoomEvent.Connected, async () => {
          if (isCleanedUp || !room) return;

          // Enable local microphone on join and resume browser audio output
          try {
            await room.localParticipant.setMicrophoneEnabled(true);
          } catch (micErr) {
            console.warn('[Voice] Unable to enable microphone:', micErr);
          }
          await room.startAudio().catch(() => {});

          // Attach any already-published remote audio tracks
          room.remoteParticipants.forEach((participant) => {
            participant.audioTrackPublications.forEach((pub) => {
              if (pub.track) {
                attachAudioTrack(pub.track);
              }
            });
          });

          // Only transition to two-way 'connected' once counterpart is present (or when callee joins)
          if (!isCaller || room.remoteParticipants.size > 0) {
            markTwoWayConnected();
          } else {
            setCallState('ringing');
            setStatusMessage(
              userRole === 'customer' ? 'Ringing courier phone...' : 'Ringing customer phone...'
            );
          }
        });

        room.on(RoomEvent.ParticipantConnected, () => {
          if (isCleanedUp) return;
          markTwoWayConnected();
        });

        room.on(RoomEvent.ParticipantDisconnected, () => {
          if (isCleanedUp || manualHangupRef.current) return;
          if (hasConnectedRef.current) {
            handleHangup('normal_hangup');
          }
        });

        room.on(RoomEvent.Reconnecting, () => {
          if (isCleanedUp) return;
          setCallState('reconnecting');
          setStatusMessage('Reconnecting voice stream...');
        });

        room.on(RoomEvent.Reconnected, () => {
          if (isCleanedUp) return;
          if (hasConnectedRef.current) {
            setCallState('connected');
            setStatusMessage('Connected');
          }
        });

        room.on(RoomEvent.Disconnected, () => {
          if (!isCleanedUp && !manualHangupRef.current) {
            handleHangup(hasConnectedRef.current ? 'normal_hangup' : 'connection_error');
          }
        });

        // Remote Audio track subscription
        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            attachAudioTrack(track);
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          const detached = track.detach();
          detached.forEach((el) => {
            el.remove();
            audioElementsRef.current = audioElementsRef.current.filter((a) => a !== el);
          });
        });

        await room.connect(wsUrl, token);
      } catch (err: any) {
        if (isCleanedUp) return;
        console.error('[Voice] LiveKit connection error:', err);
        setAudioError(err.message || 'Unable to connect to audio room.');
        setCallState('failed');
      }
    };

    // Caller receives token from POST /calls; callee fetches token via POST /calls/token upon accept
    if (callToken) {
      const livekitUrl = callLivekitUrl || process.env.NEXT_PUBLIC_LIVEKIT_URL || '';
      if (!livekitUrl) {
        setAudioError('Voice server URL is not configured.');
        setCallState('failed');
      } else {
        connectToRoom(callToken, livekitUrl);
      }
    } else {
      fetch(`/api/orders/${encodeURIComponent(callOrderCode)}/calls/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Communication-Role': userRole
        },
        body: JSON.stringify({ callId })
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Failed to obtain voice token');
          }
          return data;
        })
        .then((data) => {
          if (isCleanedUp) return;
          if (data.token && data.livekit_url) {
            connectToRoom(data.token, data.livekit_url);
          } else {
            throw new Error(data.error || 'Voice token response incomplete');
          }
        })
        .catch((err) => {
          if (isCleanedUp) return;
          setAudioError(err.message || 'Failed to obtain voice token');
          setCallState('failed');
        });
    }

    return () => {
      isCleanedUp = true;
      manualHangupRef.current = true;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }
      if (room) room.disconnect();
      clearAudioElements();
      roomRef.current = null;
    };
  }, [callId, callToken, callLivekitUrl, callOrderCode, isCaller, userRole, handleHangup, clearAudioElements]);

  // Toggle Mute
  const toggleMute = async () => {
    if (!roomRef.current) return;
    try {
      const newMuted = !isMuted;
      await roomRef.current.localParticipant.setMicrophoneEnabled(!newMuted);
      setIsMuted(newMuted);
    } catch (e) {
      console.error('[Voice] Mute toggle error:', e);
    }
  };

  // Toggle Speaker output
  const toggleSpeaker = () => {
    const nextSpeaker = !isSpeakerOn;
    setIsSpeakerOn(nextSpeaker);
    audioElementsRef.current.forEach((el) => {
      el.muted = !nextSpeaker;
    });
  };

  if (!call) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#17140D] text-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-zinc-800 flex flex-col items-center text-center space-y-6">

        {/* Privacy & Order Header */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[10px] font-bold text-brand-gold">
          <Shield className="w-3 h-3 text-brand-gold" />
          <span>Masked Audio Call • Order #{call.order_code}</span>
        </div>

        {/* Counterpart Avatar */}
        <div className="relative my-2">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-brand-gold to-amber-300 text-zinc-950 flex items-center justify-center font-black text-3xl shadow-xl">
            {counterpartName.charAt(0).toUpperCase()}
          </div>
          {callState === 'connected' && (
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500 animate-ping opacity-30"></div>
          )}
          {(callState === 'ringing' || callState === 'initiating') && (
            <div className="absolute inset-0 rounded-full border-4 border-brand-gold animate-pulse opacity-40"></div>
          )}
        </div>

        {/* Counterpart Info & State */}
        <div className="space-y-1.5">
          <h3 className="text-xl font-extrabold text-white">{counterpartName}</h3>
          <p className="text-xs text-brand-gold font-medium">
            {userRole === 'customer' ? 'Dedicated Courier' : 'Customer'}
          </p>

          <div className="pt-2">
            {callState === 'connected' ? (
              <span className="text-base font-mono font-bold text-emerald-400">
                {formatTime(duration)}
              </span>
            ) : callState === 'reconnecting' ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-amber-400">
                <WifiOff className="w-3.5 h-3.5 animate-pulse" />
                {statusMessage}
              </span>
            ) : callState === 'failed' ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-rose-400">
                <AlertCircle className="w-3.5 h-3.5" />
                {audioError || 'Connection failed'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-zinc-300">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-gold" />
                {statusMessage}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-5 pt-2">
          {/* Mute Toggle */}
          <button
            type="button"
            onClick={toggleMute}
            disabled={callState !== 'connected'}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            className={`w-13 h-13 rounded-full flex items-center justify-center transition active:scale-90 ${
              isMuted
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                : 'bg-zinc-800 text-white hover:bg-zinc-700 disabled:opacity-40'
            }`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* End Call / Cancel Button */}
          <button
            type="button"
            onClick={() =>
              handleHangup(
                callState === 'failed'
                  ? 'connection_error'
                  : hasConnectedRef.current
                  ? 'normal_hangup'
                  : 'caller_cancelled'
              )
            }
            className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition active:scale-90 shadow-lg shadow-rose-900/40"
            title={hasConnectedRef.current ? 'End Call' : 'Cancel Call'}
          >
            <PhoneOff className="w-7 h-7" />
          </button>

          {/* Speaker Toggle */}
          <button
            type="button"
            onClick={toggleSpeaker}
            disabled={callState !== 'connected'}
            title={isSpeakerOn ? 'Mute speaker output' : 'Enable speaker output'}
            className={`w-13 h-13 rounded-full flex items-center justify-center transition active:scale-90 ${
              !isSpeakerOn
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-zinc-800 text-white hover:bg-zinc-700 disabled:opacity-40'
            }`}
          >
            {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>

      </div>
    </div>
  );
}

interface IncomingCallModalProps {
  call: ActiveCall | null;
  counterpartName: string;
  onAccept: (call: ActiveCall) => void;
  onDecline: (callId: string) => void;
}

export function IncomingCallModal({
  call,
  counterpartName,
  onAccept,
  onDecline
}: IncomingCallModalProps) {
  if (!call) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#17140D] text-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-zinc-800 flex flex-col items-center text-center space-y-6">

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[10px] font-bold text-brand-gold">
          <PhoneCall className="w-3 h-3 text-emerald-400 animate-bounce" />
          <span>INCOMING VOICE CALL</span>
        </div>

        <div className="relative my-2">
          <div className="w-24 h-24 rounded-full bg-brand-gold text-zinc-950 flex items-center justify-center font-black text-3xl shadow-xl">
            {counterpartName.charAt(0).toUpperCase()}
          </div>
          <div className="absolute inset-0 rounded-full border-4 border-brand-gold animate-ping opacity-35"></div>
        </div>

        <div className="space-y-1">
          <h3 className="text-xl font-extrabold text-white">{counterpartName}</h3>
          <p className="text-xs text-zinc-400">
            Order #{call.order_code} • In-App Voice Call
          </p>
        </div>

        {/* Accept / Decline actions */}
        <div className="flex items-center justify-center gap-8 pt-3">
          <button
            type="button"
            onClick={() => onDecline(call.id)}
            className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition active:scale-90 shadow-md"
            title="Decline"
          >
            <PhoneOff className="w-6 h-6" />
          </button>

          <button
            type="button"
            onClick={() => onAccept(call)}
            className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition active:scale-90 shadow-lg shadow-emerald-900/40"
            title="Accept Call"
          >
            <PhoneCall className="w-7 h-7" />
          </button>
        </div>

      </div>
    </div>
  );
}
