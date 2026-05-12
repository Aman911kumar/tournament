import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "@/api/client";
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

const getSocketUrl = () => API_BASE_URL.replace(/\/api\/v\d+\/?$/, "");

export const getNotificationSocket = (): Socket<NotificationEvents> | null => {
  const token = getAccessToken();
  if (!token) return null;

  if (socket?.connected || socket?.active) return socket;

  socket = io(getSocketUrl(), {
    auth: { token },
    transports: ["websocket", "polling"],
    withCredentials: true,
    autoConnect: true,
  });

  return socket;
};

export const closeNotificationSocket = () => {
  socket?.disconnect();
  socket = null;
};
