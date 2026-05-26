import { request } from "./client";
import type { TopDiagnosesResponse } from "./dashboard";

export interface RevenueReportItem {
  month: string;
  revenue: number;
}

export interface AttendanceReportItem {
  month: string;
  completed: number;
  cancelled: number;
  noshow: number;
}

export interface SessionTypeReportItem {
  cups_code: string;
  count: number;
}

export interface NewPatientsReportItem {
  month: string;
  count: number;
}

export interface DashboardSummary {
  total_revenue: number;
  total_sessions: number;
  attendance_rate: number;
}

export const reportsApi = {
  revenue: (months?: number) => {
    const q = months ? `?months=${months}` : "";
    return request<{ data: RevenueReportItem[]; summary: DashboardSummary }>(`GET`, `/reports/revenue${q}`);
  },
  attendance: (months?: number) => {
    const q = months ? `?months=${months}` : "";
    return request<{ data: AttendanceReportItem[] }>(`GET`, `/reports/attendance${q}`);
  },
  sessionTypes: (months?: number) => {
    const q = months ? `?months=${months}` : "";
    return request<{ data: SessionTypeReportItem[] }>(`GET`, `/reports/session-types${q}`);
  },
  newPatients: (months?: number) => {
    const q = months ? `?months=${months}` : "";
    return request<{ data: NewPatientsReportItem[] }>(`GET`, `/reports/new-patients${q}`);
  },
  summary: (months?: number) => {
    const q = months ? `?months=${months}` : "";
    return request<DashboardSummary>(`GET`, `/reports/summary${q}`);
  },
  topDiagnoses: (months?: number) => {
    const q = months ? `?months=${months}` : "";
    return request<TopDiagnosesResponse>("GET", `/reports/top-diagnoses${q}`);
  },
};
