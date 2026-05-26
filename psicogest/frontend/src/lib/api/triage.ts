import { request } from "./client";

export type TriageUrgency = "low" | "medium" | "high" | "critical";
export type TriageStatus = "pending" | "completed" | "escalated";

export interface TriageSessionOut {
  id: string;
  tenant_id: string;
  patient_name: string;
  patient_phone: string;
  status: TriageStatus;
  urgency_level: TriageUrgency | null;
  phq9_score: number | null;
  phq9_item9_score: number | null;
  summary: string | null;
  responses: Record<string, unknown>[];
  booking_request_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface TriageListResponse {
  items: TriageSessionOut[];
  total: number;
}

export const triageApi = {
  list: (params?: { status?: string; limit?: number }): Promise<TriageListResponse> => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.limit) q.set("limit", String(params.limit));
    return request<TriageListResponse>("GET", `/webhooks/triage-sessions?${q}`);
  },
};
