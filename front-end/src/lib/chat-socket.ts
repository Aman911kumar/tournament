import { io, Socket } from "socket.io-client";
import { getRealtimeServerUrl, warmRealtimeBackend } from "@/api/client";
import { getAccessToken } from "@/lib/auth-storage";
import type { ChatAccess, ChatMessage, SendChatPayload } from "@/api/chat";

export type ChatPresencePayload = {
  tournamentId: string;
  onlineCount: number;
  users: { userId: string; online: boolean }[];
};

export type ChatAck<T = unknown> = {
  ok: boolean;
  data?: T;
  status?: number;
  message?: string;
};

type ServerToClientEvents = {
  "chat:joined": (payload: { access: ChatAccess; presence: ChatPresencePayload }) => void;
  "chat:presence": (payload: ChatPresencePayload) => void;
  "chat:typing": (payload: { tournamentId: string; userId: string; isTyping: boolean }) => void;
  "chat:message": (message: ChatMessage) => void;
  "chat:message:updated": (message: ChatMessage) => void;
  "chat:message:deleted": (message: ChatMessage) => void;
  "chat:reaction": (message: ChatMessage) => void;
  "chat:pinned": (message: ChatMessage) => void;
  "chat:unpinned": (payload: { pinnedMessage: null }) => void;
  "chat:read": (payload: { tournamentId: string; userId: string; messageId?: string; unreadCount: number }) => void;
  "chat:moderation": (payload: { action: string; state?: unknown; systemMessage?: ChatMessage }) => void;
  "chat:notify": (payload: { tournamentId: string; message: ChatMessage }) => void;
  "chat:force-leave": (payload: { tournamentId: string; reason?: string }) => void;
  "chat:error": (payload: ChatAck) => void;
};

type ClientToServerEvents = {
  "chat:join": (payload: { tournamentId: string }, callback?: (ack: ChatAck<{ access: ChatAccess; presence: ChatPresencePayload }>) => void) => void;
  "chat:leave": (payload: { tournamentId: string }, callback?: (ack: ChatAck) => void) => void;
  "chat:typing": (payload: { tournamentId: string; isTyping: boolean }) => void;
  "chat:message": (payload: SendChatPayload & { tournamentId: string }, callback?: (ack: ChatAck<ChatMessage>) => void) => void;
  "chat:edit": (payload: { messageId: string; body: string }, callback?: (ack: ChatAck<ChatMessage>) => void) => void;
  "chat:delete": (payload: { messageId: string }, callback?: (ack: ChatAck<ChatMessage>) => void) => void;
  "chat:reaction": (payload: { messageId: string; emoji: string }, callback?: (ack: ChatAck<ChatMessage>) => void) => void;
  "chat:pin": (payload: { messageId: string }, callback?: (ack: ChatAck<ChatMessage>) => void) => void;
  "chat:unpin": (payload: { tournamentId: string }, callback?: (ack: ChatAck<{ pinnedMessage: null }>) => void) => void;
  "chat:read": (payload: { tournamentId: string; messageId?: string }, callback?: (ack: ChatAck) => void) => void;
  "chat:moderate": (payload: Record<string, unknown>, callback?: (ack: ChatAck) => void) => void;
  "chat:share-room": (payload: { tournamentId: string }, callback?: (ack: ChatAck<ChatMessage>) => void) => void;
};

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export const getChatSocket = (): Socket<ServerToClientEvents, ClientToServerEvents> | null => {
  const token = getAccessToken();
  if (!token) return null;
  void warmRealtimeBackend("chat-socket");

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
    reconnectionAttempts: Infinity,
    reconnectionDelay: 700,
    reconnectionDelayMax: 4000,
    randomizationFactor: 0.35,
  });

  return socket;
};

export const closeChatSocket = () => {
  socket?.disconnect();
  socket = null;
};
