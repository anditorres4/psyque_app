import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

export function BillingSuccessPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["billing-status"] });
    const timer = setTimeout(() => navigate("/dashboard", { replace: true }), 3000);
    return () => clearTimeout(timer);
  }, [navigate, queryClient]);

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
