import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type AppointmentCreatePayload,
  type AppointmentUpdatePayload,
  type CancelPayload,
} from "@/lib/api";

export function useAppointmentsByRange(start: string, end: string) {
  return useQuery({
    queryKey: ["appointments", "range", start, end],
    queryFn: () => api.appointments.listByRange(start, end),
    enabled: !!start && !!end,
    retry: 2,
  });
}

export function useAppointment(id: string) {
  return useQuery({
    queryKey: ["appointment", id],
    queryFn: () => api.appointments.get(id),
    enabled: !!id,
  });
}

export function useAppointments(params?: { page?: number; page_size?: number; patient_id?: string; status?: string }) {
  return useQuery({
    queryKey: ["appointments", "list", params],
    queryFn: () => api.appointments.list(params),
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AppointmentCreatePayload) => api.appointments.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
}

export function useUpdateAppointment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AppointmentUpdatePayload) => api.appointments.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["appointment", id] });
    },
  });
}

export function useCancelAppointment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CancelPayload) => api.appointments.cancel(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["appointment", id] });
    },
  });
}
