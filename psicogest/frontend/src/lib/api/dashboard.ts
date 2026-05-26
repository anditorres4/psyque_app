import { request } from "./client";
import type { AppointmentSummary } from "./appointments";

export interface DashboardStats {
  appointments_today: number;
  pending_to_close: number;
  attendance_rate_30d: number | null;
  upcoming: AppointmentSummary[];
}

export interface TopDiagnosisItem {
  diagnosis_cie11: string;
  diagnosis_description: string;
  count: number;
}

export interface TopDiagnosesResponse {
  data: TopDiagnosisItem[];
  months: number;
}

export const dashboardApi = {
  getStats: () => request<DashboardStats>("GET", "/dashboard/stats"),
};
