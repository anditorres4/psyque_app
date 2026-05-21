import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { billingApi } from "@/services/billing";

function PlanCard({
  title,
  price,
  period,
  features,
  lockedFeatures,
  ctaLabel,
  ctaVariant,
  popular,
  onSelect,
}: {
  title: string;
  price: string;
  period: string;
  features: string[];
  lockedFeatures: string[];
  ctaLabel: string;
  ctaVariant: "outline" | "teal" | "white";
  popular?: boolean;
  onSelect: () => void;
}) {
  const ctaClass =
    ctaVariant === "outline"
      ? "border-2 border-[#d1d9e0] text-[#4a5568] bg-transparent"
      : ctaVariant === "teal"
      ? "bg-[#2a7a5e] text-white"
      : "bg-white text-[#1d5c47] font-bold";

  return (
    <div
      className={`relative rounded-2xl border-2 p-6 ${
        popular
          ? "border-[#2a7a5e] bg-gradient-to-br from-[#1d5c47] to-[#2e8b68] text-white mt-[-10px] pt-9"
          : "border-[#e2e8f0] bg-white"
      }`}
    >
      {popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1a3350] text-white text-[10px] font-bold uppercase tracking-wider px-4 py-1 rounded-full whitespace-nowrap">
          Más popular
        </span>
      )}
      <p className={`text-[11px] font-bold uppercase tracking-widest mb-2 ${popular ? "text-white/70" : "text-[#6b7a8d]"}`}>
        {title}
      </p>
      <p className={`text-[2.4rem] font-extrabold leading-none mb-1 ${popular ? "text-white" : "text-[#1a3350]"}`}>
        {price}
      </p>
      <p className={`text-xs mb-4 ${popular ? "text-white/65" : "text-[#8a96a3]"}`}>{period}</p>
      <hr className={`mb-4 ${popular ? "border-white/20" : "border-[#e8edf2]"}`} />

      {features.map((f) => (
        <div key={f} className={`flex gap-2 text-xs mb-2 ${popular ? "text-white/90" : "text-[#374151]"}`}>
          <span className={popular ? "text-[#a8e6cf]" : "text-[#2a7a5e]"}>✓</span>
          {f}
        </div>
      ))}
      {lockedFeatures.map((f) => (
        <div key={f} className="flex gap-2 text-xs mb-2 opacity-40">
          <span className="text-[#c4cdd6]">✕</span>
          {f}
        </div>
      ))}

      <button
        onClick={onSelect}
        className={`mt-5 w-full py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-85 ${ctaClass}`}
      >
        {ctaLabel}
      </button>
    </div>
  );
}

export function PlanSelectPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<"estandar" | "premium" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePaidPlan = async (plan: "estandar" | "premium") => {
    setLoading(plan);
    setError(null);
    try {
      const { checkout_url } = await billingApi.createCheckoutSession(plan);
      window.location.href = checkout_url;
    } catch {
      setError("No se pudo iniciar el proceso de pago. Intenta de nuevo.");
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--psy-bg)] px-4 py-8">
      <div className="text-center mb-6">
        <span className="inline-block bg-[#e8f4f0] text-[#2a7a5e] text-[11px] font-semibold uppercase tracking-wider px-4 py-1 rounded-full mb-3">
          Paso 2 de 2 — Elige tu plan
        </span>
        <h1 className="text-3xl font-extrabold text-[#1a3350] mb-2">
          ¡Cuenta creada! Elige cómo empezar
        </h1>
        <p className="text-[#6b7a8d] text-sm">Sin permanencia forzada. Sin sorpresas. Cancela cuando quieras.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-[var(--psy-danger)] max-w-xs text-center">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-3xl">
        <PlanCard
          title="Prueba gratuita"
          price="$0"
          period="14 días · Sin tarjeta de crédito"
          features={["Agendamiento + recordatorios", "Historia clínica digital", "Analytics básicos"]}
          lockedFeatures={["RIPS automático MinSalud", "Facturación electrónica DIAN", "Funciones IA clínicas"]}
          ctaLabel="Comenzar gratis"
          ctaVariant="outline"
          onSelect={() => navigate("/dashboard")}
        />
        <PlanCard
          title="Premium"
          price="$90K"
          period="COP / mes · ~USD 21"
          features={[
            "Todo lo del plan Estándar",
            "RIPS automático MinSalud",
            "Facturación electrónica DIAN",
            "Analytics avanzados",
            "Funciones IA clínicas",
            "Soporte prioritario",
          ]}
          lockedFeatures={[]}
          ctaLabel={loading === "premium" ? "Redirigiendo..." : "Empezar ahora →"}
          ctaVariant="white"
          popular
          onSelect={() => handlePaidPlan("premium")}
        />
        <PlanCard
          title="Estándar"
          price="$60K"
          period="COP / mes · ~USD 14"
          features={["Agendamiento + recordatorios", "Historia clínica digital", "Analytics básicos"]}
          lockedFeatures={["RIPS automático MinSalud", "Facturación DIAN", "Funciones IA clínicas"]}
          ctaLabel={loading === "estandar" ? "Redirigiendo..." : "Elegir Estándar"}
          ctaVariant="teal"
          onSelect={() => handlePaidPlan("estandar")}
        />
      </div>

      <p className="mt-6 text-xs text-[#9aa5b1] text-center">
        Al elegir un plan de pago serás redirigido a Stripe para ingresar tu tarjeta de forma segura.
      </p>
    </div>
  );
}
