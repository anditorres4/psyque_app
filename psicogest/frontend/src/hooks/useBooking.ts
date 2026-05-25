import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type BookingRequestSummary, type PatientRegistrationBody } from "@/lib/api";

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
}

export function useRejectBookingRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.bookingRequests.reject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["booking-requests"] }),
  });
}

export function useResendRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.bookingRequests.resendRegistration(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
    },
  });
}

export function useRegistrationInfo(token: string) {
  return useQuery({
    queryKey: ["registration-info", token],
    queryFn: () => api.registration.getInfo(token),
    retry: false,
    staleTime: Infinity,
  });
}

export function useCompleteRegistration(token: string) {
  return useMutation({
    mutationFn: (body: PatientRegistrationBody) => api.registration.complete(token, body),
  });
}
