import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, TenantProfileUpdate } from "@/lib/api";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => api.profile.get(),
    staleTime: 5 * 60_000,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TenantProfileUpdate) => api.profile.update(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}