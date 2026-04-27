import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useGCalStatus() {
  return useQuery({
    queryKey: ["gcal-status"],
    queryFn: () => api.googleCalendar.getStatus(),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useGCalConnect() {
  return useMutation({
    mutationFn: async () => {
      const { auth_url } = await api.googleCalendar.getAuthUrl();
      window.location.href = auth_url;
    },
  });
}

export function useGCalDisconnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.googleCalendar.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gcal-status"] });
    },
  });
}

export function useGCalSyncNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.googleCalendar.syncNow(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gcal-status"] });
    },
  });
}