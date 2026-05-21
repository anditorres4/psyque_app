import { useState } from "react";
import { billingApi } from "@/services/billing";

export function PaywallPage() {
  const [loading, setLoading] = useState<"estandar" | "premium" | null>(null);

  const handlePaidPlan = async (plan: "estandar" | "premium") => {
    setLoading(plan);
    try {
      const { checkout_url } = await billingApi.createCheckoutSession(plan);
      window.location.href = checkout_url;
    } catch {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--psy-bg)] px-4 py-8">
      <div className="text-center mb-6 max-w-lg">
        <div className="text-4xl mb-3">🔒</div>
        <h1 className="text-2xl font-bold text-[var(--psy-primary)] mb-2">
          Tu suscripción ha vencido
        </h1>
        <p className="text-sm text-muted-foreground">
          Para seguir usando PsyCent, elige un plan de continuidad.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-xl">
        <div className="rounded-2xl border-2 border-[#e2e8f0] bg-white p-6">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#6b7a8d] mb-2">Estándar</p>
          <p className="text-[2rem] font-extrabold text-[#1a3350] mb-1">$60K</p>
          <p className="text-xs text-[#8a96a3] mb-4">COP / mes · ~USD 14</p>
          <button
            onClick={() => handlePaidPlan("estandar")}
            disabled={!!loading}
            className="w-full py-3 rounded-xl text-sm font-semibold bg-[#2a7a5e] text-white transition-opacity hover:opacity-85 disabled:opacity-50"
          >
            {loading === "estandar" ? "Redirigiendo..." : "Elegir Estándar"}
          </button>
        </div>

        <div className="relative rounded-2xl border-2 border-[#2a7a5e] bg-gradient-to-br from-[#1d5c47] to-[#2e8b68] text-white p-6">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1a3350] text-white text-[10px] font-bold uppercase tracking-wider px-4 py-1 rounded-full whitespace-nowrap">
            Recomendado
          </span>
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/70 mb-2">Premium</p>
          <p className="text-[2rem] font-extrabold text-white mb-1">$90K</p>
          <p className="text-xs text-white/65 mb-4">COP / mes · ~USD 21</p>
          <button
            onClick={() => handlePaidPlan("premium")}
            disabled={!!loading}
            className="w-full py-3 rounded-xl text-sm font-bold bg-white text-[#1d5c47] transition-opacity hover:opacity-85 disabled:opacity-50"
          >
            {loading === "premium" ? "Redirigiendo..." : "Empezar ahora →"}
          </button>
        </div>
      </div>
    </div>
  );
}
