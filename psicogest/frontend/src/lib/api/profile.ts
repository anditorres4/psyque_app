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
  sispro_configured: boolean;
}

export interface SisproCredentials {
  tipo_usuario: "PIN" | "RE";
  doc_type: "CC" | "NIT" | "PA";
  doc_number: string;
  sispro_password: string;
}

export interface SisproTestResult {
  ok: boolean;
  message: string;
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
  updateSisproCredentials: (body: SisproCredentials) =>
    request<TenantProfile>("PUT", "/profile/sispro-credentials", body),
  testSisproConnection: (body: SisproCredentials) =>
    request<SisproTestResult>("POST", "/rips/test-connection", body),
};

export const availabilityApi = {
  list: () => request<AvailabilityBlock[]>("GET", "/availability"),
  create: (body: AvailabilityBlockCreate) =>
    request<AvailabilityBlock>("POST", "/availability", body),
  delete: (id: string) =>
    request<void>("DELETE", `/availability/${id}`),
};
