import { request } from "./client";

export interface GCalStatus {
  connected: boolean;
  sync_enabled: boolean;
  calendar_id: string | null;
}

export interface GCalAuthUrl {
  auth_url: string;
}

export const googleCalendarApi = {
  getStatus: (): Promise<GCalStatus> =>
    request<GCalStatus>("GET", "/google-calendar/status"),
  getAuthUrl: (): Promise<GCalAuthUrl> =>
    request<GCalAuthUrl>("GET", "/google-calendar/auth-url"),
  disconnect: (): Promise<void> =>
    request<void>("POST", "/google-calendar/disconnect"),
  syncNow: (): Promise<void> =>
    request<void>("POST", "/google-calendar/sync"),
};
