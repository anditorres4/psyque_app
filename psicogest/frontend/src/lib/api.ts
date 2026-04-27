/**
 * Typed API client for psyque app backend.
 * Automatically attaches the Supabase JWT to every request.
 */
import { supabase } from "./supabase";

export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

export async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("No autenticado");
  return { Authorization: `Bearer ${token}` };
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers = await getAuthHeader();
  const hasBody = body !== undefined;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, err.detail ?? "Error desconocido");
  }
  return res.json() as Promise<T>;
}

async function downloadBlob(
  method: string,
  path: string,
  body?: unknown
): Promise<{ blob: Blob; filename: string }> {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { ...headers, "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, err.detail ?? "Error desconocido");
  }

  const contentDisposition = res.headers.get("Content-Disposition") ?? "";
  const filenameMatch = contentDisposition.match(/filename=(.+)/);
  const filename = filenameMatch ? filenameMatch[1].replace(/"/g, "") : "download";
  const blob = await res.blob();
  return { blob, filename };
}

async function publicRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, err.detail ?? "Error desconocido");
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Typed API surface
// ---------------------------------------------------------------------------
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
  clinical_record: Record<string, unknown> | null;
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
  consent_accepted: boolean;
}

// --- Appointments -----------------------------------------------------------

export type SessionType = "individual" | "couple" | "family" | "followup";
export type Modality = "presential" | "virtual";
export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "noshow";
export type CancelledBy = "psychologist" | "patient";

export interface AppointmentSummary {
  id: string;
  patient_id: string;
  scheduled_start: string;
  scheduled_end: string;
  session_type: SessionType;
  modality: Modality;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
}

export interface AppointmentDetail extends AppointmentSummary {
  cancellation_reason: string | null;
  cancelled_by: CancelledBy | null;
  reminder_sent_48h: boolean;
  reminder_sent_2h: boolean;
  updated_at: string;
}

export interface PaginatedAppointments {
  items: AppointmentSummary[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface AppointmentCreatePayload {
  patient_id: string;
  scheduled_start: string;
  scheduled_end: string;
  session_type: SessionType;
  modality: Modality;
  notes?: string;
}

export interface AppointmentUpdatePayload {
  scheduled_start?: string;
  scheduled_end?: string;
  session_type?: SessionType;
  modality?: Modality;
  notes?: string;
}

export interface CancelPayload {
  cancelled_by: CancelledBy;
  cancellation_reason: string;
}

// --- Dashboard ---------------------------------------------------------------

export interface DashboardStats {
  appointments_today: number;
  pending_to_close: number;
  attendance_rate_30d: number | null;
  upcoming: AppointmentSummary[];
}

// --- Top Diagnoses -----------------------------------------------------------

export interface TopDiagnosisItem {
  diagnosis_cie11: string;
  diagnosis_description: string;
  count: number;
}

export interface TopDiagnosesResponse {
  data: TopDiagnosisItem[];
  months: number;
}

// --- Sessions ----------------------------------------------------------------

export type SessionStatus = "draft" | "signed";

export interface SessionSummary {
  id: string;
  appointment_id: string | null;
  patient_id: string;
  actual_start: string;
  actual_end: string;
  diagnosis_cie11: string;
  cups_code: string;
  session_fee: number;
  status: SessionStatus;
  created_at: string;
}

export interface SessionDetail extends SessionSummary {
  diagnosis_description: string;
  consultation_reason: string;
  intervention: string;
  evolution: string | null;
  next_session_plan: string | null;
  authorization_number: string | null;
  session_hash: string | null;
  signed_at: string | null;
  rips_included: boolean;
  updated_at: string;
}

export interface PaginatedSessions {
  items: SessionSummary[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface SessionCreatePayload {
  appointment_id?: string;
  patient_id: string;
  actual_start: string;
  actual_end: string;
  diagnosis_cie11: string;
  diagnosis_description: string;
  cups_code: string;
  consultation_reason: string;
  intervention: string;
  evolution?: string;
  next_session_plan?: string;
  session_fee: number;
  authorization_number?: string;
  tipo_dx_principal?: string;
}

export interface SessionUpdatePayload {
  actual_start?: string;
  actual_end?: string;
  diagnosis_cie11?: string;
  diagnosis_description?: string;
  cups_code?: string;
  consultation_reason?: string;
  intervention?: string;
  evolution?: string;
  next_session_plan?: string;
  session_fee?: number;
  authorization_number?: string;
  tipo_dx_principal?: string;
}

export interface SessionNoteDetail {
  id: string;
  session_id: string;
  content: string;
  note_hash: string;
  created_at: string;
}

// --- RIPS -----------------------------------------------------------------

export interface RipsExportSummary {
  id: string;
  period_year: number;
  period_month: number;
  status: string;
  sessions_count: number;
  total_value_cop: number;
  file_hash: string | null;
  generated_at: string | null;
}

export interface RipsGenerateRequest {
  year: number;
  month: number;
}

export interface RipsValidationError {
  session_id?: string;
  field: string;
  value?: string;
  message: string;
}

export interface RipsValidationWarning {
  session_id?: string;
  field: string;
  value?: string;
  message: string;
}

export interface RipsValidateResponse {
  valid: boolean;
  errors: RipsValidationError[];
  warnings: RipsValidationWarning[];
  sessions_count: number;
}

export interface RipsGenerationResponse {
  export: RipsExportSummary;
  message: string;
}

// --- Invoices --------------------------------------------------------------

export type InvoiceStatus = "draft" | "issued" | "paid";

export interface InvoiceSummary {
  id: string;
  invoice_number: string;
  patient_id: string;
  status: InvoiceStatus;
  issue_date: string | null;
  due_date: string | null;
  subtotal_cop: number;
  tax_cop: number;
  total_cop: number;
  created_at: string;
}

export interface InvoiceDetail extends InvoiceSummary {
  session_ids: string[];
  notes: string | null;
  paid_at: string | null;
  pdf_file_path: string | null;
}

export interface InvoiceListResponse {
  items: InvoiceSummary[];
  total: number;
}

export interface InvoiceCreatePayload {
  patient_id: string;
  session_ids: string[];
}

export interface InvoiceBulkPayload {
  patient_id: string;
  date_from: string;
  date_to: string;
}

export interface InvoiceUpdatePayload {
  notes?: string;
}

// --- Profile -----------------------------------------------------------------
export interface TenantProfile {
  id: string;
  full_name: string;
  colpsic_number: string;
  reps_code: string | null;
  nit: string | null;
  city: string;
  session_duration_min: number;
  plan: "starter" | "pro" | "clinic";
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

// --- Availability ------------------------------------------------------------
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

// --- Documents -------------------------------------------------------------
export interface ClinicalDocument {
  id: string;
  patient_id: string;
  filename: string;
  content_type: string;
  file_size: number;
  document_type: string;
  description: string | null;
  created_at: string;
}

// --- Clinical Record --------------------------------------------------------
export interface AntecedentesBlock {
  items: string[];
  notas: string;
}

export interface ClinicalRecord {
  id: string;
  patient_id: string;
  chief_complaint: string | null;
  antecedentes_personales: AntecedentesBlock | null;
  antecedentes_familiares: AntecedentesBlock | null;
  antecedentes_medicos: AntecedentesBlock | null;
  antecedentes_psicologicos: AntecedentesBlock | null;
  initial_diagnosis_cie11: string | null;
  initial_diagnosis_description: string | null;
  treatment_plan: string | null;
  therapeutic_goals: string | null;
  presenting_problems: string | null;
  symptom_description: string | null;
  mental_exam: MentalExamBlock | null;
  created_at: string;
  updated_at: string;
}

export interface MentalExamBlock {
  appearance: string | null;
  psychomotor: string | null;
  cognition: string | null;
  thought: string | null;
  perception: string | null;
  affect: string | null;
  insight: string | null;
  judgment: string | null;
  language: string | null;
  orientation: string | null;
}

export interface ClinicalRecordUpsert {
  chief_complaint?: string | null;
  antecedentes_personales?: AntecedentesBlock | null;
  antecedentes_familiares?: AntecedentesBlock | null;
  antecedentes_medicos?: AntecedentesBlock | null;
  antecedentes_psicologicos?: AntecedentesBlock | null;
  initial_diagnosis_cie11?: string | null;
  initial_diagnosis_description?: string | null;
  treatment_plan?: string | null;
  therapeutic_goals?: string | null;
  presenting_problems?: string | null;
  symptom_description?: string | null;
  mental_exam?: MentalExamBlock | null;
}

// --- Therapy Indicators -----------------------------------------------------

export interface TherapyIndicator {
  id: string;
  patient_id: string;
  name: string;
  description: string | null;
  unit: string | null;
  initial_value: number | null;
  target_value: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TherapyMeasurement {
  id: string;
  indicator_id: string;
  session_id: string | null;
  value: number;
  notes: string | null;
  measured_at: string;
  created_at: string;
}

export interface TherapyIndicatorWithMeasurements extends TherapyIndicator {
  measurements: TherapyMeasurement[];
}

export interface TherapyIndicatorCreate {
  name: string;
  description?: string | null;
  unit?: string | null;
  initial_value?: number | null;
  target_value?: number | null;
}

export interface TherapyIndicatorUpdate extends Partial<TherapyIndicatorCreate> {
  is_active?: boolean;
}

export interface TherapyMeasurementCreate {
  value: number;
  notes?: string | null;
  session_id?: string | null;
  measured_at: string;
}

// --- Referrals ----------------------------------------------------------

export interface Referral {
  id: string;
  patient_id: string;
  session_id: string | null;
  referred_to_name: string;
  referred_to_specialty: string;
  referred_to_institution: string | null;
  reason: string;
  priority: "urgente" | "preferente" | "programado";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReferralCreate {
  referred_to_name: string;
  referred_to_specialty: string;
  referred_to_institution?: string | null;
  reason: string;
  priority?: "urgente" | "preferente" | "programado";
  notes?: string | null;
  session_id?: string | null;
}

// --- Booking -----------------------------------------------------------------

export interface BookingInfo {
  tenant_name: string;
  welcome_message: string;
  session_duration_min: number;
  slots: string[];
}

export interface BookingRequestCreate {
  patient_name: string;
  patient_email: string;
  patient_phone?: string;
  session_type: "individual" | "couple" | "family" | "followup";
  requested_start: string;
  notes?: string;
}

export interface BookingRequestCreated {
  id: string;
  status: string;
}

export interface BookingRequestSummary {
  id: string;
  patient_name: string;
  patient_email: string;
  patient_phone: string | null;
  session_type: string;
  requested_start: string;
  requested_end: string;
  status: "pending" | "confirmed" | "rejected";
  notes: string | null;
  created_at: string;
}

// --- Google Calendar --------------------------------------------------------

export interface GCalStatus {
  connected: boolean;
  sync_enabled: boolean;
  calendar_id: string | null;
}

export interface GCalAuthUrl {
  auth_url: string;
}

// --- Caja / Cash ----------------------------------------------------------

export type CashSessionStatus = "open" | "closed";
export type TransactionType = "income" | "expense";
export type IncomeCategory = "particular" | "eps" | "otro";
export type ExpenseCategory = "nomina" | "servicios" | "compras" | "otro";
export type PaymentMethod = "efectivo" | "transferencia" | "tarjeta";

export interface CashSessionSummary {
  id: string;
  opened_at: string;
  closed_at: string | null;
  status: CashSessionStatus;
  notes: string | null;
  total_income: number;
  total_expense: number;
}

export interface CashSessionDetail extends CashSessionSummary {
  created_by: string;
}

export interface CashTransactionSummary {
  id: string;
  session_id: string | null;
  type: TransactionType;
  amount: number;
  category: IncomeCategory | ExpenseCategory;
  payment_method: PaymentMethod | null;
  description: string;
  patient_id: string | null;
  invoice_id: string | null;
  created_at: string;
  created_by: string;
}

export interface CashTransactionCreate {
  type: TransactionType;
  amount: number;
  category: IncomeCategory | ExpenseCategory;
  payment_method?: PaymentMethod;
  description?: string;
  invoice_id?: string;
  patient_id?: string;
  eps_name?: string;
}

export interface CashSessionClose {
  notes?: string;
}

export interface CashSessionListResponse {
  items: CashSessionSummary[];
  total: number;
}

export interface CashTransactionListResponse {
  items: CashTransactionSummary[];
  total: number;
}

// --- Cartera --------------------------------------------------------------

export type PortfolioType = "particular" | "eps" | "all";

export interface CarteraSummary {
  id: string;
  patient_id: string;
  patient_name: string;
  payer_type: string;
  eps_name: string | null;
  total_billed: number;
  total_paid: number;
  balance: number;
  last_activity: string | null;
  invoice_ids: string[];
}

export interface CarteraPortfolioSummary {
  total_particular: number;
  total_eps: number;
  grand_total: number;
}

export interface CarteraPaymentCreate {
  amount: number;
  description?: string;
  invoice_id: string;
}

// --- Reports ------------------------------------------------------------
export interface RevenueReportItem {
  month: string;
  revenue: number;
}

export interface AttendanceReportItem {
  month: string;
  completed: number;
  cancelled: number;
  noshow: number;
}

export interface SessionTypeReportItem {
  cups_code: string;
  count: number;
}

export interface NewPatientsReportItem {
  month: string;
  count: number;
}

export interface DashboardSummary {
  total_revenue: number;
  total_sessions: number;
  attendance_rate: number;
}

export const api = {
  auth: {
    setupProfile: () => request<{ tenant_id: string; status: string }>("POST", "/auth/setup-profile"),
  },
  caja: {
    listSessions: () => request<CashSessionListResponse>("GET", "/caja/sessions"),
    getSession: (id: string) => request<CashSessionDetail>("GET", `/caja/sessions/${id}`),
    getCurrentSession: () => request<CashSessionDetail>("GET", "/caja/sessions/current"),
    openSession: () => request<CashSessionDetail>("POST", "/caja/sessions"),
    closeSession: (id: string, body?: CashSessionClose) => request<CashSessionDetail>("PUT", `/caja/sessions/${id}/close`, body),
    listTransactions: (sessionId: string) => request<CashTransactionListResponse>("GET", `/caja/sessions/${sessionId}/transactions`),
    createTransaction: (sessionId: string, body: CashTransactionCreate) =>
      request<CashTransactionSummary>("POST", `/caja/sessions/${sessionId}/transactions`, body),
    updateTransaction: (id: string, body: Partial<CashTransactionCreate>) =>
      request<CashTransactionSummary>("PUT", `/caja/transactions/${id}`, body),
    deleteTransaction: (id: string) => request<void>("DELETE", `/caja/transactions/${id}`),
  },
  cartera: {
    list: (params?: { type?: PortfolioType; search?: string; page?: number; page_size?: number }) => {
      const q = new URLSearchParams();
      if (params?.type && params.type !== "all") q.set("type", params.type);
      if (params?.search) q.set("search", params.search);
      if (params?.page) q.set("page", String(params.page));
      if (params?.page_size) q.set("page_size", String(params.page_size));
      return request<{ items: CarteraSummary[]; total: number }>("GET", `/cartera?${q}`);
    },
    getSummary: () => request<CarteraPortfolioSummary>("GET", "/cartera/summary"),
    registerPayment: (invoiceId: string, body: CarteraPaymentCreate) =>
      request<CashTransactionSummary>("POST", `/cartera/invoices/${invoiceId}/payments`, body),
  },
  rips: {
    generate: (body: RipsGenerateRequest) =>
      request<RipsGenerationResponse>("POST", "/rips/generate", body),
    validate: (body: RipsGenerateRequest) =>
      request<RipsValidateResponse>("POST", "/rips/validate", body),
    list: (limit?: number) => {
      const q = new URLSearchParams();
      if (limit) q.set("limit", String(limit));
      return request<RipsExportSummary[]>("GET", `/rips?${q}`);
    },
    get: (id: string) =>
      request<RipsExportSummary>("GET", `/rips/${id}`),
    download: (id: string) =>
      downloadBlob("GET", `/rips/${id}/download`),
  },
  invoices: {
    create: (body: InvoiceCreatePayload) =>
      request<InvoiceSummary>("POST", "/invoices", body),
    bulk: (body: InvoiceBulkPayload) =>
      request<InvoiceSummary>("POST", "/invoices/bulk", body),
    list: (params?: { patient_id?: string; status?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.patient_id) q.set("patient_id", params.patient_id);
      if (params?.status) q.set("status", params.status);
      if (params?.limit) q.set("limit", String(params.limit));
      return request<InvoiceListResponse>("GET", `/invoices?${q}`);
    },
    get: (id: string) =>
      request<InvoiceDetail>("GET", `/invoices/${id}`),
    update: (id: string, body: InvoiceUpdatePayload) =>
      request<InvoiceSummary>("PUT", `/invoices/${id}`, body),
    issue: (id: string) =>
      request<InvoiceSummary>("POST", `/invoices/${id}/issue`),
    pay: (id: string) =>
      request<InvoiceSummary>("POST", `/invoices/${id}/pay`),
    getPdf: (id: string) =>
      downloadBlob("GET", `/invoices/${id}/pdf`),
  },
  patients: {
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
  },
  appointments: {
    listByRange: (start: string, end: string) =>
      request<AppointmentSummary[]>("GET", `/appointments/range?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
    list: (params?: { page?: number; page_size?: number; patient_id?: string; status?: string }) => {
      const q = new URLSearchParams();
      if (params?.page) q.set("page", String(params.page));
      if (params?.page_size) q.set("page_size", String(params.page_size));
      if (params?.patient_id) q.set("patient_id", params.patient_id);
      if (params?.status) q.set("status", params.status);
      return request<PaginatedAppointments>("GET", `/appointments?${q}`);
    },
    create: (body: AppointmentCreatePayload) =>
      request<AppointmentDetail>("POST", "/appointments", body),
    get: (id: string) =>
      request<AppointmentDetail>("GET", `/appointments/${id}`),
    update: (id: string, body: AppointmentUpdatePayload) =>
      request<AppointmentDetail>("PUT", `/appointments/${id}`, body),
    cancel: (id: string, body: CancelPayload) =>
      request<AppointmentDetail>("POST", `/appointments/${id}/cancel`, body),
  },
  dashboard: {
    getStats: () => request<DashboardStats>("GET", "/dashboard/stats"),
  },
  sessions: {
    list: (params?: { page?: number; page_size?: number; patient_id?: string; status?: string }) => {
      const q = new URLSearchParams();
      if (params?.page) q.set("page", String(params.page));
      if (params?.page_size) q.set("page_size", String(params.page_size));
      if (params?.patient_id) q.set("patient_id", params.patient_id);
      if (params?.status) q.set("status", params.status);
      return request<PaginatedSessions>("GET", `/sessions?${q}`);
    },
    create: (body: SessionCreatePayload) =>
      request<SessionDetail>("POST", "/sessions", body),
    get: (id: string) =>
      request<SessionDetail>("GET", `/sessions/${id}`),
    update: (id: string, body: SessionUpdatePayload) =>
      request<SessionDetail>("PUT", `/sessions/${id}`, body),
    sign: (id: string) =>
      request<SessionDetail>("POST", `/sessions/${id}/sign`),
    addNote: (id: string, content: string) =>
      request<SessionNoteDetail>("POST", `/sessions/${id}/notes`, { content }),
    listNotes: (id: string) =>
      request<SessionNoteDetail[]>("GET", `/sessions/${id}/notes`),
  },
  appointments_status: {
    complete: (id: string) =>
      request<AppointmentDetail>("POST", `/appointments/${id}/complete`),
    noshow: (id: string) =>
      request<AppointmentDetail>("POST", `/appointments/${id}/noshow`),
  },
  // --- Profile -----------------------------------------------------------------
  profile: {
    get: () => request<TenantProfile>("GET", "/profile"),
    update: (body: TenantProfileUpdate) =>
      request<TenantProfile>("PUT", "/profile", body),
  },
  // --- Availability ------------------------------------------------------------
  availability: {
    list: () => request<AvailabilityBlock[]>("GET", "/availability"),
    create: (body: AvailabilityBlockCreate) =>
      request<AvailabilityBlock>("POST", "/availability", body),
    delete: (id: string) =>
      request<void>("DELETE", `/availability/${id}`),
  },
  // --- Documents -------------------------------------------------------------
  documents: {
    listByPatient: (patientId: string) =>
      request<ClinicalDocument[]>("GET", `/patients/${patientId}/documents`),
    upload: async (patientId: string, file: File, documentType: string, description?: string) => {
      const headers = await getAuthHeader();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_type", documentType);
      if (description) formData.append("description", description);
      const res = await fetch(`${API_BASE}/patients/${patientId}/documents`, {
        method: "POST",
        headers,
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new ApiError(res.status, err.detail ?? "Error desconocido");
      }
      return res.json() as Promise<ClinicalDocument>;
    },
    getDownloadUrl: (documentId: string) =>
      request<{ url: string }>("GET", `/documents/${documentId}/download`),
    delete: (documentId: string) =>
      request<void>("DELETE", `/documents/${documentId}`),
  },
  // --- Clinical Record --------------------------------------------------------
  clinicalRecord: {
    get: (patientId: string): Promise<ClinicalRecord> =>
      request<ClinicalRecord>("GET", `/patients/${patientId}/clinical-record`),
    upsert: (patientId: string, body: ClinicalRecordUpsert): Promise<ClinicalRecord> =>
      request<ClinicalRecord>("PUT", `/patients/${patientId}/clinical-record`, body),
  },
  // --- Reports ------------------------------------------------------------
  reports: {
    revenue: (months?: number) => {
      const q = months ? `?months=${months}` : "";
      return request<{ data: RevenueReportItem[]; summary: DashboardSummary }>(`GET`, `/reports/revenue${q}`);
    },
    attendance: (months?: number) => {
      const q = months ? `?months=${months}` : "";
      return request<{ data: AttendanceReportItem[] }>(`GET`, `/reports/attendance${q}`);
    },
    sessionTypes: (months?: number) => {
      const q = months ? `?months=${months}` : "";
      return request<{ data: SessionTypeReportItem[] }>(`GET`, `/reports/session-types${q}`);
    },
    newPatients: (months?: number) => {
      const q = months ? `?months=${months}` : "";
      return request<{ data: NewPatientsReportItem[] }>(`GET`, `/reports/new-patients${q}`);
    },
    summary: (months?: number) => {
      const q = months ? `?months=${months}` : "";
      return request<DashboardSummary>(`GET`, `/reports/summary${q}`);
    },
    topDiagnoses: (months?: number) => {
      const q = months ? `?months=${months}` : "";
      return request<TopDiagnosesResponse>("GET", `/reports/top-diagnoses${q}`);
    },
  },
  // --- Therapy Indicators ----------------------------------------------------
  indicators: {
    list: (patientId: string): Promise<TherapyIndicator[]> =>
      request<TherapyIndicator[]>("GET", `/patients/${patientId}/indicators`),
    create: (patientId: string, body: TherapyIndicatorCreate): Promise<TherapyIndicator> =>
      request<TherapyIndicator>("POST", `/patients/${patientId}/indicators`, body),
    get: (indicatorId: string): Promise<TherapyIndicatorWithMeasurements> =>
      request<TherapyIndicatorWithMeasurements>("GET", `/indicators/${indicatorId}`),
    update: (indicatorId: string, body: TherapyIndicatorUpdate): Promise<TherapyIndicator> =>
      request<TherapyIndicator>("PUT", `/indicators/${indicatorId}`, body),
    delete: (indicatorId: string): Promise<void> =>
      request<void>("DELETE", `/indicators/${indicatorId}`),
    addMeasurement: (indicatorId: string, body: TherapyMeasurementCreate): Promise<TherapyMeasurement> =>
      request<TherapyMeasurement>("POST", `/indicators/${indicatorId}/measurements`, body),
    listMeasurements: (indicatorId: string): Promise<TherapyMeasurement[]> =>
      request<TherapyMeasurement[]>("GET", `/indicators/${indicatorId}/measurements`),
  },
referrals: {
    list: (patientId: string) =>
      request<Referral[]>("GET", `/patients/${patientId}/referrals`),
    create: (patientId: string, body: ReferralCreate) =>
      request<Referral>("POST", `/patients/${patientId}/referrals`, body),
    downloadPdf: (referralId: string) =>
      downloadBlob("GET", `/referrals/${referralId}/pdf`),
  },
  // --- Booking -----------------------------------------------------------------
  booking: {
    getInfo: (slug: string): Promise<BookingInfo> =>
      publicRequest<BookingInfo>("GET", `/public/booking/${slug}`),
    createRequest: (slug: string, body: BookingRequestCreate): Promise<BookingRequestCreated> =>
      publicRequest<BookingRequestCreated>("POST", `/public/booking/${slug}/request`, body),
  },
  bookingRequests: {
    list: (status?: string): Promise<BookingRequestSummary[]> => {
      const q = status ? `?status=${status}` : "";
      return request<BookingRequestSummary[]>("GET", `/booking-requests${q}`);
    },
    confirm: (id: string): Promise<BookingRequestSummary> =>
      request<BookingRequestSummary>("POST", `/booking-requests/${id}/confirm`),
    reject: (id: string): Promise<BookingRequestSummary> =>
      request<BookingRequestSummary>("POST", `/booking-requests/${id}/reject`),
  },
  // --- Google Calendar --------------------------------------------------------
  googleCalendar: {
    getStatus: (): Promise<GCalStatus> =>
      request<GCalStatus>("GET", "/google-calendar/status"),
    getAuthUrl: (): Promise<GCalAuthUrl> =>
      request<GCalAuthUrl>("GET", "/google-calendar/auth-url"),
    disconnect: (): Promise<void> =>
      request<void>("POST", "/google-calendar/disconnect"),
    syncNow: (): Promise<void> =>
      request<void>("POST", "/google-calendar/sync"),
  },
};
