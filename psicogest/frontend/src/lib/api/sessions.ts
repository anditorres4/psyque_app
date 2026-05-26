import { request, downloadBlob } from "./client";

export type SessionStatus = "draft" | "signed";

export interface SessionSummary {
  id: string;
  appointment_id: string | null;
  patient_id: string;
  patient_name: string | null;
  actual_start: string;
  actual_end: string;
  diagnosis_cie11: string;
  cups_code: string;
  session_fee: number;
  status: SessionStatus;
  tipo_dx_principal: string;
  created_at: string;
}

export interface SessionDetail extends SessionSummary {
  diagnosis_description: string;
  consultation_reason: string;
  intervention: string;
  evolution: string | null;
  next_session_plan: string | null;
  homework_assigned: string | null;
  authorization_number: string | null;
  session_hash: string | null;
  signed_at: string | null;
  rips_included: boolean;
  mental_exam: Record<string, string> | null;
  is_emergency: boolean;
  tipo_dx_principal: string;
  ai_context_summary: string | null;
  patient_summary_text: string | null;
  patient_summary_sent_at: string | null;
  updated_at: string;
}

export interface TherapeuticGoal {
  id: string;
  patient_id: string;
  goal_text: string;
  status: "active" | "achieved" | "abandoned";
  created_at: string;
  updated_at: string;
}

export interface TherapeuticGoalCreate {
  patient_id: string;
  goal_text: string;
}

export interface PatientTask {
  id: string;
  tenant_id: string;
  patient_id: string;
  session_id: string | null;
  title: string;
  description: string;
  due_date: string | null;
  status: "pending" | "submitted" | "reviewed";
  submission_text: string | null;
  submission_file_path: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientTaskCreate {
  patient_id: string;
  title: string;
  description: string;
  due_date?: string | null;
  session_id?: string | null;
}

export interface SessionContext {
  consultation_reason: string | null;
  last_mental_exam: Record<string, string> | null;
  last_diagnosis_cie11: string | null;
  last_diagnosis_description: string | null;
  last_homework_assigned: string | null;
  last_next_session_plan: string | null;
  session_count: number;
  is_first_session: boolean;
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
  diagnosis_cie11?: string;
  diagnosis_description?: string;
  cups_code?: string;
  consultation_reason?: string;
  intervention?: string;
  evolution?: string;
  next_session_plan?: string;
  homework_assigned?: string;
  session_fee?: number;
  authorization_number?: string;
  tipo_dx_principal?: string;
  mental_exam?: Record<string, string>;
  is_emergency?: boolean;
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
  homework_assigned?: string;
  patient_summary_text?: string;
  session_fee?: number;
  authorization_number?: string;
  tipo_dx_principal?: string;
  mental_exam?: Record<string, string>;
  is_emergency?: boolean;
}

export interface SessionNoteDetail {
  id: string;
  session_id: string;
  content: string;
  note_hash: string;
  created_at: string;
}

export const sessionsApi = {
  list: (params?: { page?: number; page_size?: number; patient_id?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.page_size) q.set("page_size", String(params.page_size));
    if (params?.patient_id) q.set("patient_id", params.patient_id);
    if (params?.status) q.set("status", params.status);
    return request<PaginatedSessions>("GET", `/sessions?${q}`);
  },
  context: (patientId: string) =>
    request<SessionContext>("GET", `/sessions/context/${patientId}`),
  create: (body: SessionCreatePayload) =>
    request<SessionDetail>("POST", "/sessions", body),
  get: (id: string) =>
    request<SessionDetail>("GET", `/sessions/${id}`),
  update: (id: string, body: SessionUpdatePayload) =>
    request<SessionDetail>("PUT", `/sessions/${id}`, body),
  sign: (id: string) =>
    request<SessionDetail>("POST", `/sessions/${id}/sign`),
  generateContextSummary: (id: string) =>
    request<SessionDetail>("POST", `/sessions/${id}/ai-context-summary`),
  addNote: (id: string, content: string) =>
    request<SessionNoteDetail>("POST", `/sessions/${id}/notes`, { content }),
  listNotes: (id: string) =>
    request<SessionNoteDetail[]>("GET", `/sessions/${id}/notes`),
  sendPatientSummary: (id: string) =>
    request<SessionDetail>("POST", `/sessions/${id}/send-patient-summary`),
  downloadCertificate: (id: string) =>
    downloadBlob("GET", `/sessions/${id}/certificate`),
};

export const therapeuticGoalsApi = {
  list: (patientId: string) =>
    request<TherapeuticGoal[]>("GET", `/therapeutic-goals?patient_id=${patientId}`),
  create: (body: TherapeuticGoalCreate) =>
    request<TherapeuticGoal>("POST", "/therapeutic-goals", body),
  update: (id: string, status: "active" | "achieved" | "abandoned") =>
    request<TherapeuticGoal>("PUT", `/therapeutic-goals/${id}`, { status }),
  delete: (id: string) =>
    request<void>("DELETE", `/therapeutic-goals/${id}`),
};

export const patientTasksApi = {
  listForPatient: (patientId: string, sessionId?: string) => {
    const q = sessionId ? `?session_id=${sessionId}` : "";
    return request<PatientTask[]>("GET", `/patients/${patientId}/tasks${q}`);
  },
  create: (sessionId: string, body: PatientTaskCreate) =>
    request<PatientTask>("POST", `/sessions/${sessionId}/tasks`, body),
  review: (taskId: string, reviewer_notes?: string) =>
    request<PatientTask>("PUT", `/tasks/${taskId}`, { reviewer_notes }),
  delete: (taskId: string) =>
    request<void>("DELETE", `/tasks/${taskId}`),
};
