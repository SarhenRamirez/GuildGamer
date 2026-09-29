import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import type { VoiceParticipant } from '../lib/types';
import { connectNamespace } from '../realtime/RealtimeContext';

type Target = { sessionId: string } | { roomId: string };
type Signal = { type: 'offer' | 'answer'; sdp: string } | { candidate: RTCIceCandidateInit };
type Ack<T = void> = { ok: true; data?: T } | { ok: false; error: string };

interface Peer {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  pendingCandidates: RTCIceCandidateInit[];
}

const SPEAKING_THRESHOLD = 0.035;

export function useVoice(target: Target) {
  const { token } = useAuth();
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [participants, setParticipants] = useState<Record<string, VoiceParticipant>>({});
  const [selfId, setSelfId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [pushToTalk, setPushToTalk] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef(new Map<string, Peer>());
  const iceRef = useRef<RTCIceServer[]>([]);
  const cleanupRef = useRef<(() => void) | null>(null);
  const stateRef = useRef({ muted: false, deafened: false, pushToTalk: false, talking: false });
  const targetKey = JSON.stringify(target);

  const applyMic = useCallback(() => {
    const s = stateRef.current;
    const live = !s.muted && !s.deafened && (!s.pushToTalk || s.talking);
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = live));
  }, []);

  const emitState = (patch: Partial<Pick<VoiceParticipant, 'muted' | 'deafened' | 'speaking'>>) =>
    socketRef.current?.emit('voice:state', patch);

  const closePeer = (socketId: string) => {
    const peer = peersRef.current.get(socketId);
    if (!peer) return;
    peer.pc.close();
    peer.audio.srcObject = null;
    peersRef.current.delete(socketId);
  };

  const createPeer = (remoteId: string) => {
    const pc = new RTCPeerConnection({ iceServers: iceRef.current });
    const audio = new Audio();
    audio.autoplay = true;
    audio.muted = stateRef.current.deafened;
    const peer: Peer = { pc, audio, pendingCandidates: [] };
    peersRef.current.set(remoteId, peer);

    streamRef.current?.getTracks().forEach((t) => pc.addTrack(t, streamRef.current!));
    pc.onicecandidate = (e) => {
      if (e.candidate) socketRef.current?.emit('voice:signal', { to: remoteId, data: { candidate: e.candidate.toJSON() } });
    };
    pc.ontrack = (e) => {
      audio.srcObject = e.streams[0];
      void audio.play().catch(() => {});
    };
    return peer;
  };

  const handleSignal = async ({ from, data }: { from: string; data: Signal }) => {
    const peer = peersRef.current.get(from) ?? createPeer(from);
    const { pc } = peer;
    if ('candidate' in data) {
      if (pc.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {});
      else peer.pendingCandidates.push(data.candidate);
      return;
    }
    await pc.setRemoteDescription({ type: data.type, sdp: data.sdp });
    for (const c of peer.pendingCandidates.splice(0)) await pc.addIceCandidate(c).catch(() => {});
    if (data.type === 'offer') {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current?.emit('voice:signal', { to: from, data: { type: 'answer', sdp: answer.sdp } });
    }
  };

  const leave = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    socketRef.current?.emit('voice:leave');
    socketRef.current?.disconnect();
    socketRef.current = null;
    for (const id of [...peersRef.current.keys()]) closePeer(id);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setConnected(false);
    setParticipants({});
    setSelfId(null);
  }, []);

  const join = useCallback(async () => {
    if (!token || socketRef.current) return;
    setError('');
    setConnecting(true);
    try {
      const [stream, ice] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }),
        api.get<{ iceServers: RTCIceServer[] }>('/voice/ice-servers'),
      ]);
      streamRef.current = stream;
      iceRef.current = ice.iceServers;
      applyMic();

      const socket = connectNamespace('/voice', token);
      socketRef.current = socket;
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve());
        socket.once('connect_error', reject);
      });

      socket.on('voice:peer-joined', (p: VoiceParticipant) => {
        setParticipants((cur) => ({ ...cur, [p.socketId]: p }));
        createPeer(p.socketId);
      });
      socket.on('voice:peer-left', ({ socketId }: { socketId: string }) => {
        closePeer(socketId);
        setParticipants(({ [socketId]: _, ...rest }) => rest);
      });
      socket.on('voice:state', (p: VoiceParticipant) => setParticipants((cur) => ({ ...cur, [p.socketId]: p })));
      socket.on('voice:signal', (s) => void handleSignal(s));
      socket.on('voice:closed', () => {
        setError('El canal de voz se ha cerrado');
        leave();
      });
      socket.on('disconnect', () => setConnected(false));

      const ack: Ack<{ self: VoiceParticipant; peers: VoiceParticipant[] }> = await socket.emitWithAck('voice:join', target);
      if (!ack.ok) throw new Error(ack.error);
      const { self, peers } = ack.data!;
      setSelfId(self.socketId);
      setParticipants(Object.fromEntries([self, ...peers].map((p) => [p.socketId, p])));
      emitState({ muted: stateRef.current.muted, deafened: stateRef.current.deafened });

      for (const p of peers) {
        const { pc } = createPeer(p.socketId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('voice:signal', { to: p.socketId, data: { type: 'offer', sdp: offer.sdp } });
      }

      cleanupRef.current = watchSpeaking(stream, (speaking) => emitState({ speaking }));
      setConnected(true);
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Necesitamos permiso para usar tu micrófono'
          : e instanceof Error
            ? e.message
            : 'No se pudo conectar al canal de voz';
      setError(msg);
      leave();
    } finally {
      setConnecting(false);
    }
  }, [token, targetKey, leave, applyMic]);

  const toggleMute = () => {
    const next = !stateRef.current.muted;
    stateRef.current.muted = next;
    setMuted(next);
    applyMic();
    emitState({ muted: next });
  };

  const toggleDeafen = () => {
    const next = !stateRef.current.deafened;
    stateRef.current.deafened = next;
    setDeafened(next);
    peersRef.current.forEach((p) => (p.audio.muted = next));
    applyMic();
    emitState({ deafened: next, muted: next || stateRef.current.muted });
  };

  const togglePushToTalk = () => {
    stateRef.current.pushToTalk = !stateRef.current.pushToTalk;
    setPushToTalk(stateRef.current.pushToTalk);
    applyMic();
  };

  useEffect(() => {
    if (!pushToTalk || !connected) return;
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    const down = (e: KeyboardEvent) => {
      if (e.code === 'KeyV' && !e.repeat && !typing(e)) {
        stateRef.current.talking = true;
        applyMic();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'KeyV') {
        stateRef.current.talking = false;
        applyMic();
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [pushToTalk, connected, applyMic]);

  useEffect(() => leave, [targetKey, leave]);

  return {
    connected,
    connecting,
    error,
    participants: Object.values(participants),
    selfId,
    muted,
    deafened,
    pushToTalk,
    join,
    leave,
    toggleMute,
    toggleDeafen,
    togglePushToTalk,
  };
}

function watchSpeaking(stream: MediaStream, onChange: (speaking: boolean) => void) {
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const data = new Float32Array(analyser.fftSize);
  let speaking = false;
  let quietSince = 0;

  const timer = setInterval(() => {
    const track = stream.getAudioTracks()[0];
    analyser.getFloatTimeDomainData(data);
    const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);
    const loud = !!track?.enabled && rms > SPEAKING_THRESHOLD;
    if (loud) quietSince = Date.now();
    const now = loud || Date.now() - quietSince < 400;
    if (now !== speaking) {
      speaking = now;
      onChange(now);
    }
  }, 100);

  return () => {
    clearInterval(timer);
    void ctx.close();
  };
}
