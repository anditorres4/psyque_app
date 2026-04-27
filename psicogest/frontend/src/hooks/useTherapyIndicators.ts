import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type TherapyIndicatorCreate,
  type TherapyIndicatorUpdate,
  type TherapyMeasurementCreate,
} from "@/lib/api";

export function useIndicators(patientId: string) {
  return useQuery({
    queryKey: ["indicators", patientId],
    queryFn: () => api.indicators.list(patientId),
    enabled: !!patientId,
  });
}

export function useIndicatorWithMeasurements(indicatorId: string | null) {
  return useQuery({
    queryKey: ["indicator", indicatorId],
    queryFn: () => api.indicators.get(indicatorId!),
    enabled: !!indicatorId,
  });
}

export function useCreateIndicator(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TherapyIndicatorCreate) => api.indicators.create(patientId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["indicators", patientId] }),
  });
}

export function useUpdateIndicator(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: TherapyIndicatorUpdate }) =>
      api.indicators.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["indicators", patientId] });
      qc.invalidateQueries({ queryKey: ["indicator"] });
    },
  });
}

export function useDeleteIndicator(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.indicators.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["indicators", patientId] }),
  });
}

export function useAddMeasurement(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ indicatorId, body }: { indicatorId: string; body: TherapyMeasurementCreate }) =>
      api.indicators.addMeasurement(indicatorId, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["indicator", vars.indicatorId] });
    },
  });
}
