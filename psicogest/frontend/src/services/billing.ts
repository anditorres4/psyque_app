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
};
