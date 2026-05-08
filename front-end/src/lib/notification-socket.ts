import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "@/api/client";
import { getAccessToken } from "@/lib/auth-storage";
import type { NotificationItem } from "@/api/notifications";

type NotificationEvents = {
  "notification:new": (notification: NotificationItem) => void;
  "notification:ready": (payload: { userId: string }) => void;
};

let socket: Socket | null = null;

const getSocketUrl = () => API_BASE_URL.replace(/\/api\/v\d+\/?$/, "");

export const getNotificationSocket = () => {
  const token = getAccessToken();
  if (!token) return null;

  if (socket?.connected || socket?.active) return socket;

  socket = io(getSocketUrl(), {
    auth: { token },
    transports: ["websocket", "polling"],
    withCredentials: true,
    autoConnect: true,
  });

  return socket as Socket<NotificationEvents>;
};

export const closeNotificationSocket = () => {
  socket?.disconnect();
  socket = null;
};
