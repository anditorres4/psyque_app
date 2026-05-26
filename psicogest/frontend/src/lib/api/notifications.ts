import { request } from "./client";

export interface NotificationOut {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface NotificationListResponse {
  items: NotificationOut[];
  unread_count: number;
}

export const notificationsApi = {
  list: () => request<NotificationListResponse>("GET", "/notifications"),
  markRead: (id: string) => request<NotificationOut>("PATCH", `/notifications/${id}/read`),
  markAllRead: () => request<void>("POST", "/notifications/read-all"),
};
