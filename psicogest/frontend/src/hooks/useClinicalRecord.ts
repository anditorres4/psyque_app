import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ClinicalRecordUpsert } from "@/lib/api";

export function useClinicalRecord(patientId: string) {
  return useQuery({
    queryKey: ["clinical-record", patientId],
    queryFn: () => api.clinicalRecord.get(patientId),
    enabled: !!patientId,
    retry: false,
  });
}

export function useUpsertClinicalRecord(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ClinicalRecordUpsert) => api.clinicalRecord.upsert(patientId, body),
    onSuccess: (data) => {
      queryClient.setQueryData(["clinical-record", patientId], data);
    },
  });
}
