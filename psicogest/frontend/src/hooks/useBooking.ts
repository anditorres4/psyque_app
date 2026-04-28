import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useBookingRequests(status?: string) {
  return useQuery({
    queryKey: ["booking-requests", status ?? "all"],
    queryFn: () => api.bookingRequests.list(status),
    staleTime: 60_000,
    retry: false,
  });
}

export function useConfirmBookingRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.bookingRequests.confirm(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["booking-requests"] }),
  });
}

export function useRejectBookingRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.bookingRequests.reject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["booking-requests"] }),
  });
}
