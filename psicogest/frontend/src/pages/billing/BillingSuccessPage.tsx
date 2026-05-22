import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { billingApi } from "@/services/billing";

export function BillingSuccessPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const activate = async () => {
      if (sessionId) {
        try {
          await billingApi.activateFromSession(sessionId);
          setActivated(true);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Error desconocido";
          setActivationError(msg);
        }
      } else {
        setActivationError("No se encontró session_id en la URL");
      }
      queryClient.invalidateQueries({ queryKey: ["billing-status"] });
      setTimeout(() => navigate("/dashboard", { replace: true }), 10000);
    };
    activate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--psy-bg)] px-4">
      <div className="text-center max-w-md space-y-4">
        {activationError ? (
          <>
            <div className="text-5xl">⚠️</div>
            <h1 className="text-xl font-bold" style={{ color: "var(--psy-danger, #e74c3c)" }}>
              Error al activar plan
            </h1>
            <p className="text-sm text-muted-foreground font-mono bg-gray-100 rounded p-2">
              {activationError}
            </p>
            <p className="text-xs text-muted-foreground">Redirigiendo al dashboard…</p>
          </>
        ) : (
          <>
            <div className="text-5xl">{activated ? "🎉" : "⏳"}</div>
            <h1 className="text-2xl font-bold text-[var(--psy-primary)]">
              {activated ? "¡Suscripción activada!" : "Activando plan…"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activated
                ? "Tu plan está activo. Serás redirigido al dashboard."
                : "Confirmando pago con Stripe…"}
            </p>
            <div className="h-1 w-48 mx-auto bg-[#e2e8f0] rounded-full overflow-hidden">
              <div className="h-full bg-[#2a7a5e] animate-pulse w-full" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
