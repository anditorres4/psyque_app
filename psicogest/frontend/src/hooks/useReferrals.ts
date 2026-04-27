import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ReferralCreate } from "@/lib/api";

export function useReferrals(patientId: string) {
  return useQuery({
    queryKey: ["referrals", patientId],
    queryFn: () => api.referrals.list(patientId),
    enabled: !!patientId,
  });
}

export function useCreateReferral(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReferralCreate) => api.referrals.create(patientId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["referrals", patientId] });
    },
  });
}