import { useQuery } from "@tanstack/react-query";

import {
  api,
  AttendanceReportItem,
  DashboardSummary,
  NewPatientsReportItem,
  RevenueReportItem,
  SessionTypeReportItem,
} from "@/lib/api";

export function useRevenueReport(months: number = 12) {
  return useQuery({
    queryKey: ["reports", "revenue", months],
    queryFn: () => api.reports.revenue(months),
  });
}

export function useAttendanceReport(months: number = 12) {
  return useQuery({
    queryKey: ["reports", "attendance", months],
    queryFn: () => api.reports.attendance(months),
  });
}

export function useSessionTypeReport(months: number = 12) {
  return useQuery({
    queryKey: ["reports", "sessionTypes", months],
    queryFn: () => api.reports.sessionTypes(months),
  });
}

export function useNewPatientsReport(months: number = 12) {
  return useQuery({
    queryKey: ["reports", "newPatients", months],
    queryFn: () => api.reports.newPatients(months),
  });
}

export function useReportsSummary(months: number = 12) {
  return useQuery({
    queryKey: ["reports", "summary", months],
    queryFn: () => api.reports.summary(months),
  });
}