import { apiFetch, getApiBaseUrlForPath, type ApiResponse } from "@/api/client";
import { getAccessToken } from "@/lib/auth-storage";

export type DmUserSummary = {
  _id: string;
  username: string;
  avatar?: { url?: string; thumbUrl?: string };
  banner?: { url?: string; thumbUrl?: string };
  role?: string[];
  accountStatus?: string;
  isActive?: boolean;
  lastSeenAt?: string | null;
  dmOnlineStatus?: boolean;
};

export type DmAttachment = {
  type: "image" | "file" | "voice" | "video";
  url: string;
  name?: string;
  mimeType?: string;
  size?: number;
  storageProvider?: string;
  mediaId?: string;
  apiUrl?: string;
  downloadUrl?: string;
  thumbUrl?: string;
  folderId?: string;
  folderName?: string;
};

export type DmMessage = {
  _id: string;
  conversation: string;
  sender: DmUserSummary | string;
  type: "text" | "emoji" | "image" | "file" | "voice_note" | "system" | "tournament_card" | "creator_card";
  body: string;
  attachments: DmAttachment[];
  replyTo?: string;
  status: "active" | "deleted";
  deliveryStatus: "sent" | "delivered" | "read" | "failed";
  clientRequestId?: string;
  deliveredTo?: { user: string; at: string }[];
  readBy?: { user: string; at: string }[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
};

export type DmConversation = {
  _id: string;
  type: "direct";
  participants: {
    user: DmUserSummary;
    unreadCount: number;
    pinned: boolean;
    muted: boolean;
    archived: boolean;
    deletedAt?: string | null;
    lastReadAt?: string | null;
  }[];
  otherUser: DmUserSummary;
  request: {
    status: "accepted" | "pending" | "declined";
    requestedBy?: string;
    respondedAt?: string | null;
  };
  blockedBy: { user: string; reason?: string; createdAt?: string }[];
  isBlocked: boolean;
  blockedByMe: boolean;
  unreadCount: number;
  pinned: boolean;
  muted: boolean;
  archived: boolean;
  lastMessage?: {
    message?: string;
    sender?: string;
    body?: string;
    type?: string;
    createdAt?: string | null;
  } | null;
  lastActivityAt: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
};

export type DmSettings = {
  privacy: "everyone" | "followers_only" | "subscribers_only" | "mutual_followers" | "nobody";
  readReceipts: boolean;
  onlineStatus: boolean;
};

export type StartDmConversationPayload = {
  targetUserId: string;
  initialMessage?: string;
  metadata?: Record<string, unknown>;
};

export type SendDmPayload = {
  body?: string;
  type?: DmMessage["type"];
  attachments?: DmAttachment[];
  replyTo?: string;
  metadata?: Record<string, unknown>;
  clientRequestId?: string;
};

const unwrap = <T>(promise: Promise<ApiResponse<T>>) => promise.then((res) => res.data);

export const listDmConversations = (params: { q?: string; status?: string; limit?: number } = {}) => {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (params.limit) search.set("limit", String(params.limit));
  return unwrap<DmConversation[]>(
    apiFetch(`/dm/conversations${search.toString() ? `?${search}` : ""}`),
  );
};

export const getDmConversation = (conversationId: string) =>
  unwrap<DmConversation>(apiFetch(`/dm/conversations/${conversationId}`));

export const startDmConversation = (payload: StartDmConversationPayload) =>
  unwrap<{ conversation: DmConversation; message?: DmMessage }>(
    apiFetch("/dm/conversations", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );

export const listDmMessages = (conversationId: string, params: { before?: string; limit?: number } = {}) => {
  const search = new URLSearchParams();
  if (params.before) search.set("before", params.before);
  if (params.limit) search.set("limit", String(params.limit));
  return unwrap<DmMessage[]>(
    apiFetch(`/dm/conversations/${conversationId}/messages${search.toString() ? `?${search}` : ""}`),
  );
};

export const sendDmMessage = (conversationId: string, payload: SendDmPayload) =>
  unwrap<DmMessage>(
    apiFetch(`/dm/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );

export const markDmRead = (conversationId: string) =>
  unwrap<{ conversationId: string; unreadCount: number }>(
    apiFetch(`/dm/conversations/${conversationId}/read`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  );

export const markDmDelivered = (conversationId: string) =>
  unwrap<{ conversationId: string }>(
    apiFetch(`/dm/conversations/${conversationId}/delivered`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  );

export const updateDmConversationPreferences = (
  conversationId: string,
  payload: Partial<Pick<DmConversation, "pinned" | "muted" | "archived">>,
) =>
  unwrap<DmConversation>(
    apiFetch(`/dm/conversations/${conversationId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  );

export const acceptDmRequest = (conversationId: string) =>
  unwrap<DmConversation>(
    apiFetch(`/dm/conversations/${conversationId}/accept`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  );

export const declineDmRequest = (conversationId: string) =>
  unwrap<{ conversationId: string; status: string }>(
    apiFetch(`/dm/conversations/${conversationId}/decline`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  );

export const blockDmConversation = (conversationId: string, reason?: string) =>
  unwrap<DmConversation>(
    apiFetch(`/dm/conversations/${conversationId}/block`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  );

export const deleteDmConversation = (conversationId: string) =>
  unwrap<{ conversationId: string; deleted: boolean }>(
    apiFetch(`/dm/conversations/${conversationId}`, {
      method: "DELETE",
    }),
  );

export const reportDmConversation = (conversationId: string, payload: { reason: string; message?: string }) =>
  unwrap<{ _id: string; status: string }>(
    apiFetch(`/dm/conversations/${conversationId}/report`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );

export const getDmUnreadCount = () =>
  unwrap<{ count: number }>(apiFetch("/dm/unread-count"));

export const getDmSettings = () =>
  unwrap<DmSettings>(apiFetch("/dm/settings"));

export const updateDmSettings = (payload: Partial<DmSettings>) =>
  unwrap<DmSettings>(
    apiFetch("/dm/settings", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  );

export const uploadDmAttachment = async (conversationId: string, file: File): Promise<DmAttachment> => {
  const token = getAccessToken();
  const path = `/dm/conversations/${conversationId}/attachments`;
  const baseUrl = getApiBaseUrlForPath(path, "realtime");
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "x-file-name": encodeURIComponent(file.name || "Attachment"),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: await file.arrayBuffer(),
  });
  const json = (await response.json().catch(() => null)) as ApiResponse<DmAttachment> | null;
  if (!response.ok || json?.success === false || !json?.data) {
    throw new Error(json?.message || "Attachment upload failed");
  }
  return json.data;
};
