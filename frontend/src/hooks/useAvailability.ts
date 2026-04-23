import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, AvailabilityBlockCreate } from "@/lib/api";

export function useAvailability() {
  return useQuery({
    queryKey: ["availability"],
    queryFn: () => api.availability.list(),
    staleTime: 5 * 60_000,
  });
}

export function useCreateAvailabilityBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AvailabilityBlockCreate) => api.availability.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["availability"] }),
  });
}

export function useDeleteAvailabilityBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.availability.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["availability"] }),
  });
}