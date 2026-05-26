import { request, downloadBlob } from "./client";
import type { PatientTask } from "./sessions";

export interface PortalMe {
  patient_id: string;
  full_name: string;
  email: string | null;
  phone: string;
  psychologist_name: string;
  psychologist_city: string;
  onboarding_status: "active" | "pending";
  profile_complete: boolean;
}

export interface PatientProfileUpdate {
  marital_status?: string | null;
  occupation?: string | null;
  address?: string | null;
  municipality_dane?: string | null;
  zone?: string | null;
  payer_type?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
}

export interface OnboardingSignedDoc {
  doc_type: string;
  signed_at: string;
  content_version: string;
}

export interface OnboardingStatus {
  status: "active" | "pending";
  age_group: "adult" | "minor_u13" | "minor_13_18";
  required_docs: string[];
  signed_docs: OnboardingSignedDoc[];
  pending_docs: string[];
}

export interface PortalAppointment {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  session_type: string;
  modality: string;
  status: string;
  notes: string | null;
  patient_join_key: string | null;
}

export interface PortalSession {
  id: string;
  actual_start: string;
  diagnosis_cie11: string;
  cups_code: string;
}

export interface PortalInvoice {
  id: string;
  invoice_number: string;
  status: string;
  total_cop: number;
  issue_date: string | null;
  created_at: string;
}

export const portalApi = {
  me: () => request<PortalMe>("GET", "/portal/me"),
  updateProfile: (data: PatientProfileUpdate) => request<PortalMe>("PATCH", "/portal/me/profile", data),
  appointments: () => request<PortalAppointment[]>("GET", "/portal/appointments"),
  sessions: () => request<PortalSession[]>("GET", "/portal/sessions"),
  invoices: () => request<PortalInvoice[]>("GET", "/portal/invoices"),
  onboardingStatus: () => request<OnboardingStatus>("GET", "/portal/onboarding/status"),
  signDocument: (doc_type: string) =>
    request<{ ok: boolean; onboarding_complete: boolean }>("POST", "/portal/onboarding/sign", { doc_type }),
  tasks: () => request<PatientTask[]>("GET", "/portal/tasks"),
  submitTask: (taskId: string, submission_text: string) =>
    request<PatientTask>("POST", `/portal/tasks/${taskId}/submit`, { submission_text }),
  downloadSessionCertificate: (sessionId: string) =>
    downloadBlob("GET", `/portal/sessions/${sessionId}/certificate`),
  downloadGlobalCertificate: (opts: { from_date?: string; to_date?: string } = {}) => {
    const params = new URLSearchParams();
    if (opts.from_date) params.set("from_date", opts.from_date);
    if (opts.to_date) params.set("to_date", opts.to_date);
    const qs = params.toString();
    return downloadBlob("GET", `/portal/certificate${qs ? `?${qs}` : ""}`);
  },
};
