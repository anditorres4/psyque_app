import { request } from "./client";
import type { VideoRoomResponse } from "./video";

export type SessionType = "individual" | "couple" | "family" | "followup";
export type Modality = "presential" | "virtual";
export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "noshow";
export type CancelledBy = "psychologist" | "patient";

export interface AppointmentSummary {
  id: string;
  patient_id: string;
  patient_name: string | null;
  scheduled_start: string;
  scheduled_end: string;
  session_type: SessionType;
  modality: Modality;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
  session_signed?: boolean | null;
}

export interface AppointmentDetail extends AppointmentSummary {
  cancellation_reason: string | null;
  cancelled_by: CancelledBy | null;
  reminder_sent_24h: boolean;
  reminder_sent_2h: boolean;
  updated_at: string;
  video_room_id: string | null;
  series_id: string | null;
  patient_join_key: string | null;
}

export interface AppointmentSeriesCreate {
  patient_id: string;
  day_of_week: number;
  time_hour: number;
  time_minute: number;
  duration_minutes: number;
  session_type: SessionType;
  modality: Modality;
  n_repetitions: number;
  first_date: string;
  notes?: string;
}

export interface AppointmentSeriesOut {
  id: string;
  patient_id: string;
  day_of_week: number;
  time_hour: number;
  time_minute: number;
  duration_minutes: number;
  session_type: string;
  modality: string;
  n_repetitions: number;
  first_date: string;
  notes: string | null;
  status: string;
  created_at: string;
  appointments_created: number;
}

export interface PaginatedAppointments {
  items: AppointmentSummary[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface AppointmentCreatePayload {
  patient_id: string;
  scheduled_start: string;
  scheduled_end: string;
  session_type: SessionType;
  modality: Modality;
  notes?: string;
}

export interface AppointmentUpdatePayload {
  scheduled_start?: string;
  scheduled_end?: string;
  session_type?: SessionType;
  modality?: Modality;
  notes?: string;
}

export interface CancelPayload {
  cancelled_by: CancelledBy;
  cancellation_reason: string;
}

export const appointmentsApi = {
  listByRange: (start: string, end: string) =>
    request<AppointmentSummary[]>("GET", `/appointments/range?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
  list: (params?: { page?: number; page_size?: number; patient_id?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.page_size) q.set("page_size", String(params.page_size));
    if (params?.patient_id) q.set("patient_id", params.patient_id);
    if (params?.status) q.set("status", params.status);
    return request<PaginatedAppointments>("GET", `/appointments?${q}`);
  },
  create: (body: AppointmentCreatePayload) =>
    request<AppointmentDetail>("POST", "/appointments", body),
  get: (id: string) =>
    request<AppointmentDetail>("GET", `/appointments/${id}`),
  update: (id: string, body: AppointmentUpdatePayload) =>
    request<AppointmentDetail>("PUT", `/appointments/${id}`, body),
  cancel: (id: string, body: CancelPayload) =>
    request<AppointmentDetail>("POST", `/appointments/${id}/cancel`, body),
  complete: (id: string) =>
    request<AppointmentDetail>("POST", `/appointments/${id}/complete`),
  sendVideoLink: (id: string) =>
    request<VideoRoomResponse>("POST", `/appointments/${id}/send-video-link`),
  createSeries: (body: AppointmentSeriesCreate) =>
    request<AppointmentSeriesOut>("POST", "/appointments/series", body),
  cancelSeries: (seriesId: string) =>
    request<{ ok: boolean; appointments_cancelled: number }>("DELETE", `/appointments/series/${seriesId}`),
};

export const appointmentsStatusApi = {
  complete: (id: string) =>
    request<AppointmentDetail>("POST", `/appointments/${id}/complete`),
  noshow: (id: string) =>
    request<AppointmentDetail>("POST", `/appointments/${id}/noshow`),
};
