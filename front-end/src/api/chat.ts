import { apiFetch, ApiResponse, getApiBaseUrlForPath } from "./client";
import { getAccessToken } from "@/lib/auth-storage";

export type ChatMessageType = "text" | "image" | "file" | "system" | "announcement" | "room_card";
export type ChatMessageStatus = "active" | "deleted";

export interface ChatUserSummary {
  _id: string;
  username?: string;
  avatar?: { url?: string };
  role?: string[];
}

export interface ChatAttachment {
  type: "image" | "file";
  url: string;
  name: string;
  mimeType?: string;
  size?: number;
}

export interface ChatMessage {
  _id: string;
  tournament: string;
  sender: ChatUserSummary | null;
  type: ChatMessageType;
  body: string;
  attachments: ChatAttachment[];
  replyTo?: {
    _id: string;
    body?: string;
    type?: ChatMessageType;
    sender?: { _id: string; username?: string } | null;
  } | null;
  mentions: string[];
  reactions: { emoji: string; users: string[] }[];
  seenBy: { user: string; seenAt: string }[];
  status: ChatMessageStatus;
  editedAt?: string | null;
  deletedAt?: string | null;
  pinnedAt?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface ChatAccess {
  tournament: {
    _id: string;
    title: string;
    game?: string;
    status?: string;
    startAt?: string;
    organizer?: ChatUserSummary;
    room?: {
      roomId?: string;
      roomPass?: string;
      roomJoinTime?: string | null;
    };
  };
  role: "player" | "creator" | "admin" | "guest";
  permissions: {
    canRead: boolean;
    canSend: boolean;
    canModerate: boolean;
    canDeleteAny: boolean;
    canPin: boolean;
    canShareRoomCard: boolean;
    mutedUntil?: string | null;
    bannedUntil?: string | null;
  };
  slowModeSeconds: number;
  announcement?: { body?: string; by?: string; createdAt?: string } | null;
  pinnedMessage?: ChatMessage | null;
  participantCount: number;
  unreadCount: number;
}

export interface ChatMessagePage {
  messages: ChatMessage[];
  hasMore: boolean;
  nextCursor?: string | null;
}

export interface SendChatPayload {
  body?: string;
  attachments?: ChatAttachment[];
  replyTo?: string | null;
  mentions?: string[];
  type?: ChatMessageType;
  metadata?: Record<string, unknown>;
}

const CHAT_ENDPOINTS = {
  access: (tournamentId: string) => `/chat/tournaments/${tournamentId}/access`,
  messages: (tournamentId: string) => `/chat/tournaments/${tournamentId}/messages`,
  read: (tournamentId: string) => `/chat/tournaments/${tournamentId}/read`,
  moderation: (tournamentId: string) => `/chat/tournaments/${tournamentId}/moderation`,
  attachment: (tournamentId: string) => `/chat/tournaments/${tournamentId}/attachments`,
  message: (messageId: string) => `/chat/messages/${messageId}`,
  reaction: (messageId: string) => `/chat/messages/${messageId}/reactions`,
  pin: (messageId: string) => `/chat/messages/${messageId}/pin`,
  unpin: (tournamentId: string) => `/chat/tournaments/${tournamentId}/pin`,
  report: (messageId: string) => `/chat/messages/${messageId}/report`,
};

const toAbsoluteApiUrl = (path: string) => {
  if (path.startsWith("http")) return path;
  return `${getApiBaseUrlForPath(path, "realtime")}${path}`;
};

export async function getChatAccess(tournamentId: string) {
  const res = await apiFetch<ApiResponse<ChatAccess>>(CHAT_ENDPOINTS.access(tournamentId));
  return res.data;
}

export async function getChatMessages(tournamentId: string, params: { before?: string | null; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (params.before) query.set("before", params.before);
  if (params.limit) query.set("limit", String(params.limit));
  const suffix = query.toString();
  const res = await apiFetch<ApiResponse<ChatMessagePage>>(`${CHAT_ENDPOINTS.messages(tournamentId)}${suffix ? `?${suffix}` : ""}`);
  return res.data;
}

export async function sendChatMessage(tournamentId: string, payload: SendChatPayload) {
  const res = await apiFetch<ApiResponse<ChatMessage>>(CHAT_ENDPOINTS.messages(tournamentId), {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function editChatMessage(messageId: string, body: string) {
  const res = await apiFetch<ApiResponse<ChatMessage>>(CHAT_ENDPOINTS.message(messageId), {
    method: "PATCH",
    body: JSON.stringify({ body }),
  });
  return res.data;
}

export async function deleteChatMessage(messageId: string) {
  const res = await apiFetch<ApiResponse<ChatMessage>>(CHAT_ENDPOINTS.message(messageId), {
    method: "DELETE",
  });
  return res.data;
}

export async function reactToChatMessage(messageId: string, emoji: string) {
  const res = await apiFetch<ApiResponse<ChatMessage>>(CHAT_ENDPOINTS.reaction(messageId), {
    method: "POST",
    body: JSON.stringify({ emoji }),
  });
  return res.data;
}

export async function pinChatMessage(messageId: string) {
  const res = await apiFetch<ApiResponse<ChatMessage>>(CHAT_ENDPOINTS.pin(messageId), {
    method: "POST",
  });
  return res.data;
}

export async function unpinChatMessage(tournamentId: string) {
  const res = await apiFetch<ApiResponse<{ pinnedMessage: null }>>(CHAT_ENDPOINTS.unpin(tournamentId), {
    method: "DELETE",
  });
  return res.data;
}

export async function markChatRead(tournamentId: string, messageId?: string) {
  const res = await apiFetch<ApiResponse<{ unreadCount: number }>>(CHAT_ENDPOINTS.read(tournamentId), {
    method: "POST",
    body: JSON.stringify({ messageId }),
  });
  return res.data;
}

export async function moderateChatRoom(
  tournamentId: string,
  payload: {
    action: "mute" | "unmute" | "ban" | "unban" | "slow_mode" | "announcement";
    targetUser?: string;
    reason?: string;
    durationMinutes?: number;
    slowModeSeconds?: number;
    body?: string;
  },
) {
  const res = await apiFetch<ApiResponse<unknown>>(CHAT_ENDPOINTS.moderation(tournamentId), {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function reportChatMessage(messageId: string, reason: string) {
  const res = await apiFetch<ApiResponse<unknown>>(CHAT_ENDPOINTS.report(messageId), {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  return res.data;
}

export async function uploadChatAttachment(tournamentId: string, file: File): Promise<ChatAttachment> {
  const token = getAccessToken();
  const res = await fetch(toAbsoluteApiUrl(CHAT_ENDPOINTS.attachment(tournamentId)), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: await file.arrayBuffer(),
  });
  const json = (await res.json().catch(() => null)) as ApiResponse<ChatAttachment> | null;
  if (!res.ok) {
    throw new Error(json?.message || "Attachment upload failed");
  }
  return json?.data as ChatAttachment;
}
