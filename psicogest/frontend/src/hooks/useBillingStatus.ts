import { useQuery } from "@tanstack/react-query";
import { billingApi, type BillingStatus } from "@/services/billing";
import { useAuth } from "./useAuth";

export function useBillingStatus() {
  const { user, tenantReady } = useAuth();

  return useQuery<BillingStatus>({
    queryKey: ["billing-status"],
    queryFn: () => billingApi.getStatus(),
    staleTime: 5 * 60 * 1000,
    enabled: !!user && tenantReady,
  });
}
