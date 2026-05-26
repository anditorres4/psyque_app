import { request } from "./client";

export interface TenantProfile {
  id: string;
  full_name: string;
  colpsic_number: string;
  reps_code: string | null;
  nit: string | null;
  city: string;
  session_duration_min: number;
  plan: "free_trial" | "estandar" | "premium";
  plan_expires_at: string;
  booking_enabled: boolean;
  booking_slug: string | null;
  booking_welcome_message: string | null;
}

export interface TenantProfileUpdate {
  full_name?: string;
  colpsic_number?: string;
  reps_code?: string;
  nit?: string;
  city?: string;
  session_duration_min?: number;
  booking_enabled?: boolean;
  booking_welcome_message?: string;
}

export interface AvailabilityBlock {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface AvailabilityBlockCreate {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export const profileApi = {
  get: () => request<TenantProfile>("GET", "/profile"),
  update: (body: TenantProfileUpdate) =>
    request<TenantProfile>("PUT", "/profile", body),
};

export const availabilityApi = {
  list: () => request<AvailabilityBlock[]>("GET", "/availability"),
  create: (body: AvailabilityBlockCreate) =>
    request<AvailabilityBlock>("POST", "/availability", body),
  delete: (id: string) =>
    request<void>("DELETE", `/availability/${id}`),
};
