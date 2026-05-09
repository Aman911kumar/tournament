// NotificationsScreen
import { apiFetch,ApiResponse } from "./client";

export const ENDPOINTS = {
  list: "/notifications",
  unreadCount: "/notifications/unread-count",
  pushConfig: "/notifications/push/config",
  pushSubscribe: "/notifications/push/subscribe",
  markAllRead: "/notifications/mark-all-read",
  markRead: (id: string) => `/notifications/${id}/read`,
  remove: (id: string) => `/notifications/${id}`,
};

export type NotificationType =
  | "system"
  | "wallet"
  | "tournament"
  | "tournament_update"
  | "reward"
  | "security"
  | "creator"
  | "room"
  | "payment"
  | "report"
  | "moderation";

export interface NotificationItem {
  _id: string;
  title: string;
  body: string;
  type: NotificationType;
  priority?: "low" | "normal" | "high";
  read: boolean;
  createdAt: string;
  readAt?: string | null;
  deliveredAt?: string | null;
  actionUrl?: string;
  data?: Record<string, unknown>;
}

export interface NotificationListResponse {
  notifications: NotificationItem[];
  unreadCount: number;
  total: number;
}

export async function getNotifications(options: { limit?: number; skip?: number; unreadOnly?: boolean; type?: string } = {}) {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  if (options.skip) params.set("skip", String(options.skip));
  if (options.unreadOnly) params.set("unreadOnly", "true");
  if (options.type) params.set("type", options.type);

  const res = await apiFetch<ApiResponse<NotificationListResponse | NotificationItem[]>>(
    `${ENDPOINTS.list}${params.toString() ? `?${params}` : ""}`,
  );

  if (Array.isArray(res.data)) {
    return {
      notifications: res.data,
      unreadCount: res.data.filter((item) => !item.read).length,
      total: res.data.length,
    };
  }

  return res.data ?? { notifications: [], unreadCount: 0, total: 0 };
}

export async function getUnreadNotificationCount() {
  const res = await apiFetch<ApiResponse<{ unreadCount: number }>>(ENDPOINTS.unreadCount);
  return res.data?.unreadCount ?? 0;
}
export async function markAllNotificationsRead() {
  return apiFetch(ENDPOINTS.markAllRead, { method: "POST" });
}
export async function markNotificationRead(id: string) {
  return apiFetch(ENDPOINTS.markRead(id), { method: "POST" });
}
export async function deleteNotification(id: string) {
  return apiFetch(ENDPOINTS.remove(id), { method: "DELETE" });
}

export async function getPushConfig() {
  const res = await apiFetch<ApiResponse<{ enabled: boolean; publicKey: string }>>(ENDPOINTS.pushConfig);
  return res.data;
}

export async function savePushSubscription(subscription: PushSubscriptionJSON, platform = "web") {
  return apiFetch(ENDPOINTS.pushSubscribe, {
    method: "POST",
    body: JSON.stringify({ subscription, platform }),
  });
}
