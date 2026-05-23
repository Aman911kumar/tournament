import { useCallback, useEffect, useRef, useState } from "react";
import {
  getChatSocket,
  VoiceParticipant,
  VoiceSignalPayload,
} from "@/lib/chat-socket";

type VoiceStatus = "idle" | "joining" | "connected" | "error";

type UseTournamentVoiceRoomOptions = {
  tournamentId: string;
  currentUserId: string;
  enabled: boolean;
};

const VOICE_SOCKET_CONNECT_TIMEOUT_MS = 10_000;
const VOICE_JOIN_ACK_TIMEOUT_MS = 12_000;

const parseIceServers = (): RTCIceServer[] => {
  const raw = String(import.meta.env.VITE_VOICE_ICE_SERVERS || "").trim();
  if (!raw) {
    return [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478" },
    ];
  }
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

export const useTournamentVoiceRoom = ({
  tournamentId,
  currentUserId,
  enabled,
}: UseTournamentVoiceRoomOptions) => {
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
  const joinAttemptRef = useRef(0);

  const emitState = useCallback(
    (patch: { muted?: boolean; speaking?: boolean }) => {
      const socket = getChatSocket();
      if (!socket?.connected || !tournamentId || !joinedRef.current) return;
      socket.emit("voice:state", { tournamentId, ...patch });
    },
    [tournamentId],
  );

  const sendSignal = useCallback(
    (
      to: string,
      payload: Omit<VoiceSignalPayload, "tournamentId" | "from" | "to">,
    ) => {
      const socket = getChatSocket();
      if (!socket?.connected || !tournamentId || !to) return;
      socket.emit("voice:signal", { tournamentId, to, ...payload });
    },
    [tournamentId],
  );

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

  const ensurePeer = useCallback(
    (userId: string) => {
      const existing = peersRef.current.get(userId);
      if (existing) return existing;

      const peer = new RTCPeerConnection({ iceServers: parseIceServers() });
      localStreamRef.current?.getTracks().forEach((track) => {
        const stream = localStreamRef.current;
        if (stream) peer.addTrack(track, stream);
      });

      peer.onicecandidate = (event) => {
        if (event.candidate)
          sendSignal(userId, {
            type: "ice",
            candidate: event.candidate.toJSON(),
          });
      };

      peer.ontrack = (event) => {
        const [stream] = event.streams;
        if (!stream || audioElementsRef.current.has(userId)) return;
        audioElementsRef.current.set(
          userId,
          createAudioElement(userId, stream),
        );
      };

      peer.onconnectionstatechange = () => {
        if (
          ["closed", "failed", "disconnected"].includes(peer.connectionState)
        ) {
          window.setTimeout(() => {
            if (peer.connectionState !== "connected") closePeer(userId);
          }, 2000);
        }
      };

      peersRef.current.set(userId, peer);
      return peer;
    },
    [closePeer, sendSignal],
  );

  const createOfferFor = useCallback(
    async (userId: string) => {
      const peer = ensurePeer(userId);
      const offer = await peer.createOffer({ offerToReceiveAudio: true });
      await peer.setLocalDescription(offer);
      sendSignal(userId, { type: "offer", sdp: offer });
    },
    [ensurePeer, sendSignal],
  );

  const handleSignal = useCallback(
    async (payload: VoiceSignalPayload) => {
      if (
        !joinedRef.current ||
        payload.tournamentId !== tournamentId ||
        payload.to !== currentUserId ||
        !payload.from
      )
        return;
      try {
        const peer = ensurePeer(payload.from);
        if (payload.type === "offer" && payload.sdp) {
          await peer.setRemoteDescription(
            new RTCSessionDescription(payload.sdp),
          );
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          sendSignal(payload.from, { type: "answer", sdp: answer });
        } else if (payload.type === "answer" && payload.sdp) {
          await peer.setRemoteDescription(
            new RTCSessionDescription(payload.sdp),
          );
        } else if (payload.type === "ice" && payload.candidate) {
          await peer.addIceCandidate(new RTCIceCandidate(payload.candidate));
        }
      } catch {
        closePeer(payload.from);
      }
    },
    [closePeer, currentUserId, ensurePeer, sendSignal, tournamentId],
  );

  const stopSpeakingDetection = useCallback(() => {
    if (speakingTimerRef.current)
      window.clearInterval(speakingTimerRef.current);
    speakingTimerRef.current = null;
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    speakingRef.current = false;
    setSpeaking(false);
  }, []);

  const startSpeakingDetection = useCallback(
    (stream: MediaStream) => {
      stopSpeakingDetection();
      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
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
        const average =
          values.reduce((sum, value) => sum + value, 0) / values.length;
        const nextSpeaking = average > 11 && !mutedRef.current;
        if (nextSpeaking === speakingRef.current) return;
        speakingRef.current = nextSpeaking;
        setSpeaking(nextSpeaking);
        emitState({ speaking: nextSpeaking });
      }, 360);
    },
    [emitState, stopSpeakingDetection],
  );

  const cleanupVoice = useCallback(
    (nextStatus: VoiceStatus = "idle") => {
      stopSpeakingDetection();
      peersRef.current.forEach((_, userId) => closePeer(userId));
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      joinedRef.current = false;
      setJoined(false);
      setParticipants([]);
      setStatus(nextStatus);
      setSpeaking(false);
    },
    [closePeer, stopSpeakingDetection],
  );

  const waitForSocket = useCallback(
    () =>
      new Promise<NonNullable<ReturnType<typeof getChatSocket>>>(
        (resolve, reject) => {
          const socket = getChatSocket();
          if (!socket) return reject(new Error("Login required"));
          if (socket.connected) return resolve(socket);

          let timer = 0;
          let settled = false;
          const cleanup = () => {
            window.clearTimeout(timer);
            socket.off("connect", handleConnect);
            socket.off("connect_error", handleConnectError);
            socket.off("disconnect", handleDisconnect);
          };
          const handleConnect = () => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(socket);
          };
          const handleConnectError = (error: Error) => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(
              new Error(error?.message || "Could not connect to voice server"),
            );
          };
          const handleDisconnect = () => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(new Error("Voice server disconnected before joining"));
          };
          timer = window.setTimeout(() => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(
              new Error(
                "Voice server did not connect. Render may still be waking up.",
              ),
            );
          }, VOICE_SOCKET_CONNECT_TIMEOUT_MS);
          socket.once("connect", handleConnect);
          socket.once("connect_error", handleConnectError);
          socket.once("disconnect", handleDisconnect);
          socket.connect();
        },
      ),
    [],
  );

  const requestMicrophone = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone is not available in this browser/app build.");
    }
    if (
      window.isSecureContext === false &&
      !/^localhost|127\.0\.0\.1$/i.test(window.location.hostname)
    ) {
      throw new Error(
        "Voice chat needs HTTPS or a trusted Android app context.",
      );
    }

    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        throw new Error(
          "Microphone permission was denied. Allow microphone access and try again.",
        );
      }
      if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        throw new Error("No microphone was found on this device.");
      }
      throw new Error(
        error instanceof Error
          ? error.message
          : "Microphone permission failed.",
      );
    }
  }, []);

  const emitVoiceJoin = useCallback(
    (socket: NonNullable<ReturnType<typeof getChatSocket>>) =>
      new Promise<{ tournamentId: string; participants: VoiceParticipant[] }>(
        (resolve, reject) => {
          let settled = false;
          const cleanup = () => {
            window.clearTimeout(timer);
            socket.off("disconnect", handleDisconnect);
          };
          const handleDisconnect = () => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(new Error("Voice connection dropped while joining."));
          };
          const timer = window.setTimeout(() => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(
              new Error(
                "Voice server did not respond. Check Render realtime deployment and Socket.IO.",
              ),
            );
          }, VOICE_JOIN_ACK_TIMEOUT_MS);

          socket.once("disconnect", handleDisconnect);
          socket.emit(
            "voice:join",
            { tournamentId, muted: mutedRef.current },
            (ack) => {
              if (settled) return;
              settled = true;
              cleanup();
              if (!ack?.ok || !ack.data) {
                reject(new Error(ack?.message || "Could not join voice room"));
                return;
              }
              resolve(ack.data);
            },
          );
        },
      ),
    [tournamentId],
  );

  const joinVoice = useCallback(async () => {
    if (!enabled || !tournamentId || joinedRef.current || status === "joining")
      return;
    const attemptId = joinAttemptRef.current + 1;
    joinAttemptRef.current = attemptId;
    setStatus("joining");
    setError("");

    try {
      const socket = await waitForSocket();
      const stream = await requestMicrophone();
      if (joinAttemptRef.current !== attemptId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      localStreamRef.current = stream;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !mutedRef.current;
      });
      startSpeakingDetection(stream);

      const joinedData = await emitVoiceJoin(socket);
      if (joinAttemptRef.current !== attemptId) return;

      joinedRef.current = true;
      setJoined(true);
      setParticipants(joinedData.participants || []);
      setStatus("connected");
      await Promise.all(
        (joinedData.participants || [])
          .filter((participant) => participant.userId !== currentUserId)
          .map((participant) =>
            createOfferFor(participant.userId).catch(() => undefined),
          ),
      );
    } catch (err) {
      cleanupVoice("error");
      setStatus("error");
      setError(err instanceof Error ? err.message : "Voice permission failed");
    }
  }, [
    cleanupVoice,
    createOfferFor,
    currentUserId,
    emitVoiceJoin,
    enabled,
    requestMicrophone,
    startSpeakingDetection,
    status,
    tournamentId,
    waitForSocket,
  ]);

  const leaveVoice = useCallback(() => {
    joinAttemptRef.current += 1;
    const socket = getChatSocket();
    if (socket?.connected && tournamentId && joinedRef.current)
      socket.emit("voice:leave", { tournamentId });
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
    emitState({
      muted: nextMuted,
      speaking: nextMuted ? false : speakingRef.current,
    });
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
      const active = new Set(
        (next || []).map((participant) => participant.userId),
      );
      [...peersRef.current.keys()].forEach((userId) => {
        if (!active.has(userId)) closePeer(userId);
      });
    };
    const handleSnapshot = (payload: {
      tournamentId: string;
      participants: VoiceParticipant[];
    }) => {
      if (payload.tournamentId === tournamentId)
        applyParticipants(payload.participants);
    };
    const handleJoined = (payload: {
      tournamentId: string;
      participants: VoiceParticipant[];
    }) => {
      if (payload.tournamentId === tournamentId)
        applyParticipants(payload.participants);
    };
    const handleLeft = (payload: {
      tournamentId: string;
      userId: string;
      participants: VoiceParticipant[];
    }) => {
      if (payload.tournamentId !== tournamentId) return;
      closePeer(payload.userId);
      applyParticipants(payload.participants);
    };
    const handleState = (payload: {
      tournamentId: string;
      participant: VoiceParticipant;
    }) => {
      if (payload.tournamentId !== tournamentId) return;
      setParticipants((current) =>
        current.map((participant) =>
          participant.userId === payload.participant.userId
            ? { ...participant, ...payload.participant }
            : participant,
        ),
      );
    };
    const handleDisconnect = () => {
      if (!joinedRef.current) return;
      cleanupVoice("error");
      setError("Voice connection lost. Rejoin when realtime reconnects.");
    };

    socket.on("voice:snapshot", handleSnapshot);
    socket.on("voice:participant-joined", handleJoined);
    socket.on("voice:participant-left", handleLeft);
    socket.on("voice:state", handleState);
    socket.on("voice:signal", handleSignal);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("voice:snapshot", handleSnapshot);
      socket.off("voice:participant-joined", handleJoined);
      socket.off("voice:participant-left", handleLeft);
      socket.off("voice:state", handleState);
      socket.off("voice:signal", handleSignal);
      socket.off("disconnect", handleDisconnect);
    };
  }, [cleanupVoice, closePeer, currentUserId, handleSignal, tournamentId]);

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
