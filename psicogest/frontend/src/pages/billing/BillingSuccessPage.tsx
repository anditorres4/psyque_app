import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { billingApi } from "@/services/billing";

export function BillingSuccessPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const activate = async () => {
      if (sessionId) {
        try {
          await billingApi.activateFromSession(sessionId);
        } catch {
          // webhook may have already activated the plan — ignore errors
        }
      }
      queryClient.invalidateQueries({ queryKey: ["billing-status"] });
      setTimeout(() => navigate("/dashboard", { replace: true }), 2000);
    };
    activate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--psy-bg)] px-4">
      <div className="text-center max-w-md space-y-4">
        <div className="text-5xl">🎉</div>
        <h1 className="text-2xl font-bold text-[var(--psy-primary)]">¡Suscripción activada!</h1>
        <p className="text-sm text-muted-foreground">
          Tu plan está activo. Serás redirigido al dashboard en unos segundos.
        </p>
        <div className="h-1 w-48 mx-auto bg-[#e2e8f0] rounded-full overflow-hidden">
          <div className="h-full bg-[#2a7a5e] animate-pulse w-full" />
        </div>
      </div>
    </div>
  );
}
