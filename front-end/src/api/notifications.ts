// NotificationsScreen
import { apiFetch,ApiResponse } from "./client";

export const ENDPOINTS = {
  list: "/notifications",
  markAllRead: "/notifications/mark-all-read",
  markRead: (id: string) => `/notifications/${id}/read`,
};

export interface NotificationItem {
  _id: string;
  title: string;
  body: string;
  type: "match_update" | "payment" | "system";
  read: boolean;
  createdAt: string;
}

export async function getNotifications() {
  const res = await apiFetch<ApiResponse<NotificationItem[]>>(ENDPOINTS.list);
  return res.data ?? [];
}
export async function markAllNotificationsRead() {
  return apiFetch(ENDPOINTS.markAllRead, { method: "POST" });
}
export async function markNotificationRead(id: string) {
  return apiFetch(ENDPOINTS.markRead(id), { method: "POST" });
}
