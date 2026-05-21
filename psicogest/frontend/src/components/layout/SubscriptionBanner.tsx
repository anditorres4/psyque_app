import { useNavigate } from "react-router-dom";
import { useBillingStatus } from "@/hooks/useBillingStatus";

export function SubscriptionBanner() {
  const navigate = useNavigate();
  const { data: billing } = useBillingStatus();

  if (!billing || billing.days_remaining > 3) return null;

  const message =
    billing.days_remaining === 0 && billing.in_grace_period
      ? "Tu plan venció — tienes un período de gracia. Renueva ahora."
      : `Tu plan vence en ${billing.days_remaining} día${billing.days_remaining !== 1 ? "s" : ""}.`;

  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-sm text-amber-800">
      <span>{message}</span>
      <button
        onClick={() => navigate("/select-plan")}
        className="ml-4 text-xs font-semibold underline whitespace-nowrap hover:text-amber-900"
      >
        Actualizar plan →
      </button>
    </div>
  );
}
