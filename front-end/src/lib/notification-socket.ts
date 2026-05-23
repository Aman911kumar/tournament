import { io, Socket } from "socket.io-client";
import { getRealtimeServerUrl, warmRealtimeBackend } from "@/api/client";
import { getAccessToken } from "@/lib/auth-storage";
import type { AdminMonitoringData } from "@/api/admin";
import type { NotificationItem } from "@/api/notifications";
import type { ChatMessage } from "@/api/chat";

type NotificationEvents = {
  "notification:new": (notification: NotificationItem) => void;
  "notification:ready": (payload: { userId: string }) => void;
  "admin:monitoring": (payload: AdminMonitoringData) => void;
  "admin:presence": (payload: { onlineUsers: number; sockets: number; redisAdapter: boolean }) => void;
  "moderation:report:new": (payload: unknown) => void;
  "moderation:report:updated": (payload: unknown) => void;
  "moderation:ban": (payload: unknown) => void;
  "moderation:unban": (payload: unknown) => void;
  "chat:notify": (payload: { tournamentId: string; message: ChatMessage }) => void;
};

let socket: Socket<NotificationEvents> | null = null;

export const getNotificationSocket = (): Socket<NotificationEvents> | null => {
  const token = getAccessToken();
  if (!token) return null;
  void warmRealtimeBackend("notification-socket");

  if (socket?.connected || socket?.active) {
    socket.auth = { token };
    return socket;
  }

  socket = io(getRealtimeServerUrl(), {
    auth: { token },
    transports: ["websocket", "polling"],
    withCredentials: true,
    autoConnect: true,
    multiplex: true,
    timeout: 8_000,
    reconnectionDelay: 700,
    reconnectionDelayMax: 4_000,
    randomizationFactor: 0.35,
  });

  return socket;
};

export const closeNotificationSocket = () => {
  socket?.disconnect();
  socket = null;
};
