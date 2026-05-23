import { useCallback, useEffect, useRef, useState } from "react";
import { getChatSocket, VoiceParticipant, VoiceSignalPayload } from "@/lib/chat-socket";

type VoiceStatus = "idle" | "joining" | "connected" | "error";

type UseTournamentVoiceRoomOptions = {
  tournamentId: string;
  currentUserId: string;
  enabled: boolean;
};

const parseIceServers = (): RTCIceServer[] => {
  const raw = String(import.meta.env.VITE_VOICE_ICE_SERVERS || "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as RTCIceServer[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return raw
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean)
      .map((urls) => ({ urls }));
  }
};

const createAudioElement = (userId: string, stream: MediaStream) => {
  const audio = document.createElement("audio");
  audio.dataset.voiceUserId = userId;
  audio.autoplay = true;
  audio.setAttribute("playsinline", "true");
  audio.srcObject = stream;
  audio.volume = 1;
  document.body.appendChild(audio);
  audio.play().catch(() => undefined);
  return audio;
};

export const useTournamentVoiceRoom = ({ tournamentId, currentUserId, enabled }: UseTournamentVoiceRoomOptions) => {
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");

  const joinedRef = useRef(false);
  const mutedRef = useRef(false);
  const speakingRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const speakingTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const emitState = useCallback((patch: { muted?: boolean; speaking?: boolean }) => {
    const socket = getChatSocket();
    if (!socket?.connected || !tournamentId || !joinedRef.current) return;
    socket.emit("voice:state", { tournamentId, ...patch });
  }, [tournamentId]);

  const sendSignal = useCallback((to: string, payload: Omit<VoiceSignalPayload, "tournamentId" | "from" | "to">) => {
    const socket = getChatSocket();
    if (!socket?.connected || !tournamentId || !to) return;
    socket.emit("voice:signal", { tournamentId, to, ...payload });
  }, [tournamentId]);

  const closePeer = useCallback((userId: string) => {
    peersRef.current.get(userId)?.close();
    peersRef.current.delete(userId);
    const audio = audioElementsRef.current.get(userId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    }
    audioElementsRef.current.delete(userId);
  }, []);

  const ensurePeer = useCallback((userId: string) => {
    const existing = peersRef.current.get(userId);
    if (existing) return existing;

    const peer = new RTCPeerConnection({ iceServers: parseIceServers() });
    localStreamRef.current?.getTracks().forEach((track) => {
      const stream = localStreamRef.current;
      if (stream) peer.addTrack(track, stream);
    });

    peer.onicecandidate = (event) => {
      if (event.candidate) sendSignal(userId, { type: "ice", candidate: event.candidate.toJSON() });
    };

    peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream || audioElementsRef.current.has(userId)) return;
      audioElementsRef.current.set(userId, createAudioElement(userId, stream));
    };

    peer.onconnectionstatechange = () => {
      if (["closed", "failed", "disconnected"].includes(peer.connectionState)) {
        window.setTimeout(() => {
          if (peer.connectionState !== "connected") closePeer(userId);
        }, 2000);
      }
    };

    peersRef.current.set(userId, peer);
    return peer;
  }, [closePeer, sendSignal]);

  const createOfferFor = useCallback(async (userId: string) => {
    const peer = ensurePeer(userId);
    const offer = await peer.createOffer({ offerToReceiveAudio: true });
    await peer.setLocalDescription(offer);
    sendSignal(userId, { type: "offer", sdp: offer });
  }, [ensurePeer, sendSignal]);

  const handleSignal = useCallback(async (payload: VoiceSignalPayload) => {
    if (!joinedRef.current || payload.tournamentId !== tournamentId || payload.to !== currentUserId || !payload.from) return;
    try {
      const peer = ensurePeer(payload.from);
      if (payload.type === "offer" && payload.sdp) {
        await peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        sendSignal(payload.from, { type: "answer", sdp: answer });
      } else if (payload.type === "answer" && payload.sdp) {
        await peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      } else if (payload.type === "ice" && payload.candidate) {
        await peer.addIceCandidate(new RTCIceCandidate(payload.candidate));
      }
    } catch {
      closePeer(payload.from);
    }
  }, [closePeer, currentUserId, ensurePeer, sendSignal, tournamentId]);

  const stopSpeakingDetection = useCallback(() => {
    if (speakingTimerRef.current) window.clearInterval(speakingTimerRef.current);
    speakingTimerRef.current = null;
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    speakingRef.current = false;
    setSpeaking(false);
  }, []);

  const startSpeakingDetection = useCallback((stream: MediaStream) => {
    stopSpeakingDetection();
    const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const audioContext = new AudioContextCtor();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    const values = new Uint8Array(analyser.frequencyBinCount);
    audioContextRef.current = audioContext;

    speakingTimerRef.current = window.setInterval(() => {
      analyser.getByteFrequencyData(values);
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      const nextSpeaking = average > 11 && !mutedRef.current;
      if (nextSpeaking === speakingRef.current) return;
      speakingRef.current = nextSpeaking;
      setSpeaking(nextSpeaking);
      emitState({ speaking: nextSpeaking });
    }, 360);
  }, [emitState, stopSpeakingDetection]);

  const cleanupVoice = useCallback(() => {
    stopSpeakingDetection();
    peersRef.current.forEach((_, userId) => closePeer(userId));
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    joinedRef.current = false;
    setJoined(false);
    setParticipants([]);
    setStatus("idle");
    setSpeaking(false);
  }, [closePeer, stopSpeakingDetection]);

  const waitForSocket = useCallback(() => new Promise<NonNullable<ReturnType<typeof getChatSocket>>>((resolve, reject) => {
    const socket = getChatSocket();
    if (!socket) return reject(new Error("Login required"));
    if (socket.connected) return resolve(socket);

    let timer = 0;
    const handleConnect = () => {
      window.clearTimeout(timer);
      resolve(socket);
    };
    timer = window.setTimeout(() => {
      socket.off("connect", handleConnect);
      reject(new Error("Voice server is still reconnecting"));
    }, 8000);
    socket.once("connect", handleConnect);
    socket.connect();
  }), []);

  const joinVoice = useCallback(async () => {
    if (!enabled || !tournamentId || joinedRef.current) return;
    setStatus("joining");
    setError("");

    try {
      const socket = await waitForSocket();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !mutedRef.current;
      });
      startSpeakingDetection(stream);

      socket.emit("voice:join", { tournamentId, muted: mutedRef.current }, async (ack) => {
        if (!ack?.ok || !ack.data) {
          cleanupVoice();
          setStatus("error");
          setError(ack?.message || "Could not join voice room");
          return;
        }
        joinedRef.current = true;
        setJoined(true);
        setParticipants(ack.data.participants || []);
        setStatus("connected");
        await Promise.all(
          (ack.data.participants || [])
            .filter((participant) => participant.userId !== currentUserId)
            .map((participant) => createOfferFor(participant.userId).catch(() => undefined))
        );
      });
    } catch (err) {
      cleanupVoice();
      setStatus("error");
      setError(err instanceof Error ? err.message : "Voice permission failed");
    }
  }, [cleanupVoice, createOfferFor, currentUserId, enabled, startSpeakingDetection, tournamentId, waitForSocket]);

  const leaveVoice = useCallback(() => {
    const socket = getChatSocket();
    if (socket?.connected && tournamentId && joinedRef.current) socket.emit("voice:leave", { tournamentId });
    cleanupVoice();
  }, [cleanupVoice, tournamentId]);

  const toggleMute = useCallback(() => {
    const nextMuted = !mutedRef.current;
    mutedRef.current = nextMuted;
    setMuted(nextMuted);
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    if (nextMuted) {
      speakingRef.current = false;
      setSpeaking(false);
    }
    emitState({ muted: nextMuted, speaking: nextMuted ? false : speakingRef.current });
  }, [emitState]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    if (!tournamentId || !currentUserId) return undefined;
    const socket = getChatSocket();
    if (!socket) return undefined;

    const applyParticipants = (next: VoiceParticipant[]) => {
      setParticipants(next || []);
      const active = new Set((next || []).map((participant) => participant.userId));
      [...peersRef.current.keys()].forEach((userId) => {
        if (!active.has(userId)) closePeer(userId);
      });
    };
    const handleSnapshot = (payload: { tournamentId: string; participants: VoiceParticipant[] }) => {
      if (payload.tournamentId === tournamentId) applyParticipants(payload.participants);
    };
    const handleJoined = (payload: { tournamentId: string; participants: VoiceParticipant[] }) => {
      if (payload.tournamentId === tournamentId) applyParticipants(payload.participants);
    };
    const handleLeft = (payload: { tournamentId: string; userId: string; participants: VoiceParticipant[] }) => {
      if (payload.tournamentId !== tournamentId) return;
      closePeer(payload.userId);
      applyParticipants(payload.participants);
    };
    const handleState = (payload: { tournamentId: string; participant: VoiceParticipant }) => {
      if (payload.tournamentId !== tournamentId) return;
      setParticipants((current) =>
        current.map((participant) =>
          participant.userId === payload.participant.userId ? { ...participant, ...payload.participant } : participant
        )
      );
    };

    socket.on("voice:snapshot", handleSnapshot);
    socket.on("voice:participant-joined", handleJoined);
    socket.on("voice:participant-left", handleLeft);
    socket.on("voice:state", handleState);
    socket.on("voice:signal", handleSignal);

    return () => {
      socket.off("voice:snapshot", handleSnapshot);
      socket.off("voice:participant-joined", handleJoined);
      socket.off("voice:participant-left", handleLeft);
      socket.off("voice:state", handleState);
      socket.off("voice:signal", handleSignal);
    };
  }, [closePeer, currentUserId, handleSignal, tournamentId]);

  useEffect(() => () => leaveVoice(), [leaveVoice]);

  return {
    participants,
    joined,
    muted,
    speaking,
    status,
    error,
    joinVoice,
    leaveVoice,
    toggleMute,
  };
};
