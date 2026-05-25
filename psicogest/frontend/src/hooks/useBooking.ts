import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type BookingRequestSummary, type PatientRegistrationBody } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

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
    onSuccess: (data: BookingRequestSummary) => {
      queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      if (data.registration_pending) {
        toast({
          title: "Solicitud confirmada",
          description: `Se envió un email a ${data.patient_email} para completar el registro. Recuérdale revisarlo.`,
        });
      }
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
    onSuccess: (data: BookingRequestSummary) => {
      queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
      toast({
        title: "Email reenviado",
        description: `Se envió un nuevo enlace a ${data.patient_email}.`,
      });
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
