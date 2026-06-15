import type { Socket } from "socket.io-client";
import { closeRealtimeSocket, getRealtimeSocket } from "@/lib/realtime-socket";
import type { DmAttachment, DmConversation, DmMessage } from "@/api/dm";

export type DmAck<T = unknown> = {
  ok: boolean;
  data?: T;
  status?: number;
  message?: string;
};

type ServerToClientEvents = {
  "conversation:created": (payload: { conversationId: string; conversation: DmConversation }) => void;
  "conversation:update": (payload: { conversationId: string; conversation: DmConversation }) => void;
  "conversation:joined": (payload: { conversationId: string }) => void;
  "conversation:accepted": (payload: { conversationId: string; conversation: DmConversation }) => void;
  "conversation:declined": (payload: { conversationId: string; status: string }) => void;
  "conversation:block": (payload: { conversationId: string; conversation: DmConversation }) => void;
  "conversation:delete": (payload: { conversationId: string; deleted?: boolean }) => void;
  "message:receive": (payload: { conversationId: string; message: DmMessage }) => void;
  "message:delivered": (payload: { conversationId: string; userId: string; deliveredAt: string }) => void;
  "message:read": (payload: { conversationId: string; userId: string; readAt: string; unreadCount: number }) => void;
  "typing:start": (payload: { conversationId: string; userId: string; username?: string }) => void;
  "typing:stop": (payload: { conversationId: string; userId: string }) => void;
  "dm:unread": (payload: { count: number }) => void;
  "dm:error": (payload: DmAck) => void;
};

type ClientToServerEvents = {
  "conversation:create": (
    payload: { targetUserId: string; initialMessage?: string; metadata?: Record<string, unknown> },
    callback?: (ack: DmAck<{ conversation: DmConversation; message?: DmMessage }>) => void,
  ) => void;
  "conversation:join": (payload: { conversationId: string }, callback?: (ack: DmAck<{ conversationId: string }>) => void) => void;
  "conversation:leave": (payload: { conversationId: string }, callback?: (ack: DmAck) => void) => void;
  "conversation:accept": (payload: { conversationId: string }, callback?: (ack: DmAck<DmConversation>) => void) => void;
  "conversation:block": (payload: { conversationId: string; reason?: string }, callback?: (ack: DmAck<DmConversation>) => void) => void;
  "conversation:delete": (payload: { conversationId: string }, callback?: (ack: DmAck) => void) => void;
  "conversation:preferences": (
    payload: { conversationId: string; pinned?: boolean; muted?: boolean; archived?: boolean },
    callback?: (ack: DmAck<DmConversation>) => void,
  ) => void;
  "message:send": (
    payload: {
      conversationId: string;
      body?: string;
      type?: DmMessage["type"];
      attachments?: DmAttachment[];
      replyTo?: string;
      metadata?: Record<string, unknown>;
      clientRequestId?: string;
    },
    callback?: (ack: DmAck<DmMessage>) => void,
  ) => void;
  "message:delivered": (payload: { conversationId: string }, callback?: (ack: DmAck) => void) => void;
  "message:read": (payload: { conversationId: string }, callback?: (ack: DmAck) => void) => void;
  "typing:start": (payload: { conversationId: string }) => void;
  "typing:stop": (payload: { conversationId: string }) => void;
};

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export const getDmSocket = (): Socket<ServerToClientEvents, ClientToServerEvents> | null => {
  socket = getRealtimeSocket<ServerToClientEvents, ClientToServerEvents>("dm-socket");
  return socket;
};

export const closeDmSocket = () => {
  closeRealtimeSocket();
  socket = null;
};
