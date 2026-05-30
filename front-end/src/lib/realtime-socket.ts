import { io, Socket } from "socket.io-client";
import { getRealtimeServerUrl, warmRealtimeBackend } from "@/api/client";
import { getAccessToken } from "@/lib/auth-storage";

let socket: Socket | null = null;
let lastWarmupAt = 0;

const WARMUP_COOLDOWN_MS = 30_000;

export const getRealtimeSocket = <
  ServerToClientEvents extends Record<string, (...args: never[]) => void> = Record<string, (...args: never[]) => void>,
  ClientToServerEvents extends Record<string, (...args: never[]) => void> = Record<string, (...args: never[]) => void>,
>(
  reason = "realtime-socket",
): Socket<ServerToClientEvents, ClientToServerEvents> | null => {
  const token = getAccessToken();
  if (!token) return null;

  const now = Date.now();
  if (now - lastWarmupAt > WARMUP_COOLDOWN_MS) {
    lastWarmupAt = now;
    void warmRealtimeBackend(reason);
  }

  if (socket) {
    socket.auth = { token };
    return socket as Socket<ServerToClientEvents, ClientToServerEvents>;
  }

  socket = io(getRealtimeServerUrl(), {
    auth: { token },
    transports: ["websocket", "polling"],
    withCredentials: true,
    autoConnect: true,
    multiplex: true,
    timeout: 8_000,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 900,
    reconnectionDelayMax: 5_000,
    randomizationFactor: 0.35,
  });

  return socket as Socket<ServerToClientEvents, ClientToServerEvents>;
};

export const closeRealtimeSocket = () => {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
};

export const refreshRealtimeSocketAuth = () => {
  const token = getAccessToken();
  if (socket && token) socket.auth = { token };
};
