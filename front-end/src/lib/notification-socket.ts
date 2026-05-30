import type { Socket } from "socket.io-client";
import { closeRealtimeSocket, getRealtimeSocket } from "@/lib/realtime-socket";
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
  socket = getRealtimeSocket<NotificationEvents>("notification-socket");
  return socket;
};

export const closeNotificationSocket = () => {
  closeRealtimeSocket();
  socket = null;
};
