import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => api.dashboard.getStats(),
    staleTime: 60_000,
    retry: 2,
  });
}

export function useTopDiagnoses(months: number = 3) {
  return useQuery({
    queryKey: ["reports", "top-diagnoses", months],
    queryFn: () => api.reports.topDiagnoses(months),
    staleTime: 5 * 60_000,
    retry: 2,
  });
}