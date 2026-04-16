import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type PatientCreatePayload } from "@/lib/api";

export function usePatients(params?: {
  page?: number;
  page_size?: number;
  active?: boolean;
  has_eps?: boolean;
  search?: string;
}) {
  return useQuery({
    queryKey: ["patients", params],
    queryFn: () => api.patients.list(params),
  });
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: ["patient", id],
    queryFn: () => api.patients.get(id),
    enabled: !!id,
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PatientCreatePayload) => api.patients.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patients"] }),
  });
}

export function useUpdatePatient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PatientCreatePayload>) => api.patients.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["patient", id] });
    },
  });
}
