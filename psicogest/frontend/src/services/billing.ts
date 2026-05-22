import { request } from "@/lib/api";

export interface BillingStatus {
  plan: "free_trial" | "estandar" | "premium";
  subscription_status: "trial" | "active" | "past_due" | "canceled" | "expired";
  plan_expires_at: string;
  days_remaining: number;
  in_grace_period: boolean;
}

export interface CheckoutSessionResponse {
  checkout_url: string;
}

export interface CustomerPortalResponse {
  portal_url: string;
}

export const billingApi = {
  getStatus: () => request<BillingStatus>("GET", "/billing/status"),

  createCheckoutSession: (plan: "estandar" | "premium") =>
    request<CheckoutSessionResponse>("POST", "/billing/create-checkout-session", { plan }),

  createCustomerPortal: () =>
    request<CustomerPortalResponse>("POST", "/billing/customer-portal"),

  activateFromSession: async (sessionId: string): Promise<{ plan: string; activated: boolean }> => {
    // No JWT required — tenant is identified from Stripe session metadata
    const res = await fetch(
      `${import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1"}/billing/activate-from-session?session_id=${encodeURIComponent(sessionId)}`,
      { method: "POST" },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? "Error al activar plan");
    }
    return res.json();
  },
};
