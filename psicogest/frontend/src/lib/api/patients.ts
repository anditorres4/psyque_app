import { request, downloadBlob, ApiError, API_BASE, getAuthHeader } from "./client";

export interface PatientSummary {
  id: string;
  hc_number: string;
  first_surname: string;
  second_surname: string | null;
  first_name: string;
  second_name: string | null;
  doc_type: string;
  doc_number: string;
  current_diagnosis_cie11: string | null;
  payer_type: string;
  is_active: boolean;
  created_at: string;
}

export interface PatientDetail extends PatientSummary {
  birth_date: string;
  biological_sex: string;
  gender_identity: string | null;
  marital_status: string;
  occupation: string;
  address: string;
  municipality_dane: string;
  zone: string;
  phone: string;
  email: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  eps_name: string | null;
  eps_code: string | null;
  authorization_number: string | null;
  consent_signed_at: string;
  updated_at: string;
}

export interface PaginatedPatients {
  items: PatientSummary[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface HistoryExportOptions {
  include_diagnosis?: boolean;
  include_treatment?: boolean;
  include_evolution?: boolean;
  patient_profile?: "adulto" | "infante" | "familiar";
}

export interface PatientCreatePayload {
  doc_type: string;
  doc_number: string;
  first_surname: string;
  second_surname?: string;
  first_name: string;
  second_name?: string;
  birth_date: string;
  biological_sex: string;
  gender_identity?: string;
  marital_status: string;
  occupation: string;
  address: string;
  municipality_dane: string;
  zone: string;
  phone: string;
  email?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  payer_type: string;
  eps_name?: string;
  eps_code?: string;
  authorization_number?: string;
  consent_accepted?: boolean;
}

export const patientsApi = {
  list: (params?: {
    page?: number;
    page_size?: number;
    active?: boolean;
    has_eps?: boolean;
    search?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.page_size) q.set("page_size", String(params.page_size));
    if (params?.active !== undefined) q.set("active", String(params.active));
    if (params?.has_eps !== undefined) q.set("has_eps", String(params.has_eps));
    if (params?.search) q.set("search", params.search);
    return request<PaginatedPatients>("GET", `/patients?${q}`);
  },
  create: (body: PatientCreatePayload) =>
    request<PatientDetail>("POST", "/patients", body),
  get: (id: string) =>
    request<PatientDetail>("GET", `/patients/${id}`),
  update: (id: string, body: Partial<PatientCreatePayload>) =>
    request<PatientDetail>("PUT", `/patients/${id}`, body),
  exportHistory: async (id: string, opts: HistoryExportOptions = {}) => {
    const params = new URLSearchParams();
    if (opts.include_diagnosis !== undefined) params.set("include_diagnosis", String(opts.include_diagnosis));
    if (opts.include_treatment !== undefined) params.set("include_treatment", String(opts.include_treatment));
    if (opts.include_evolution !== undefined) params.set("include_evolution", String(opts.include_evolution));
    if (opts.patient_profile) params.set("patient_profile", opts.patient_profile);
    const qs = params.toString();
    return downloadBlob("GET", `/patients/${id}/history-export${qs ? `?${qs}` : ""}`);
  },
  exportHistoryProtected: async (id: string, opts: HistoryExportOptions = {}) => {
    const params = new URLSearchParams();
    if (opts.include_diagnosis !== undefined) params.set("include_diagnosis", String(opts.include_diagnosis));
    if (opts.include_treatment !== undefined) params.set("include_treatment", String(opts.include_treatment));
    if (opts.include_evolution !== undefined) params.set("include_evolution", String(opts.include_evolution));
    if (opts.patient_profile) params.set("patient_profile", opts.patient_profile);
    const qs = params.toString();
    return downloadBlob("GET", `/patients/${id}/export-history-protected${qs ? `?${qs}` : ""}`);
  },
  inviteToPortal: (id: string): Promise<{ ok: boolean; auth_user_id: string; email: string }> =>
    request("POST", `/patients/${id}/invite-to-portal`),
  exportAttendanceCertificate: async (
    id: string,
    opts: { include_session_count?: boolean; include_dates?: boolean; from_date?: string; to_date?: string } = {},
  ) => {
    const params = new URLSearchParams();
    if (opts.include_session_count !== undefined) params.set("include_session_count", String(opts.include_session_count));
    if (opts.include_dates !== undefined) params.set("include_dates", String(opts.include_dates));
    if (opts.from_date) params.set("from_date", opts.from_date);
    if (opts.to_date) params.set("to_date", opts.to_date);
    const qs = params.toString();
    return downloadBlob("GET", `/patients/${id}/certificate-attendance${qs ? `?${qs}` : ""}`);
  },
};

// Keep ApiError and API_BASE re-exported for convenience (used in documents.ts upload)
export { ApiError, API_BASE, getAuthHeader };
