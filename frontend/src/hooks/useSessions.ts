import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type SessionCreatePayload,
  type SessionUpdatePayload,
} from "@/lib/api";

export function useSessions(params?: {
  page?: number;
  page_size?: number;
  patient_id?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ["sessions", "list", params],
    queryFn: () => api.sessions.list(params),
    retry: 2,
  });
}

export function useSession(id: string) {
  return useQuery({
    queryKey: ["session", id],
    queryFn: () => api.sessions.get(id),
    enabled: !!id,
  });
}

export function useSessionNotes(sessionId: string) {
  return useQuery({
    queryKey: ["session", sessionId, "notes"],
    queryFn: () => api.sessions.listNotes(sessionId),
    enabled: !!sessionId,
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SessionCreatePayload) => api.sessions.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });
}

export function useUpdateSession(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SessionUpdatePayload) => api.sessions.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["session", id] });
    },
  });
}

export function useSignSession(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.sessions.sign(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["session", id] });
    },
  });
}

export function useAddSessionNote(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api.sessions.addNote(sessionId, content),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["session", sessionId, "notes"] }),
  });
}

export function useCompleteAppointment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.appointments_status.complete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["appointment", id] });
    },
  });
}

export function useNoshowAppointment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.appointments_status.noshow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["appointment", id] });
    },
  });
}
