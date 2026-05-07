import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useTriage(params?: { status?: string }) {
  return useQuery({
    queryKey: ["triage", params],
    queryFn: () => api.triage.list(params),
    staleTime: 30_000,
  });
}
