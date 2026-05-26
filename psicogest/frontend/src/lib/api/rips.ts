import { request, downloadBlob } from "./client";

export interface RipsExportSummary {
  id: string;
  period_year: number;
  period_month: number;
  status: string;
  sessions_count: number;
  total_value_cop: number;
  file_hash: string | null;
  generated_at: string | null;
  cuv?: string | null;
  fecha_radicacion?: string | null;
  num_factura?: string | null;
}

export interface RipsSubmitResponse {
  export_id: string;
  cuv: string | null;
  fecha_radicacion: string | null;
  result_state: boolean;
  validation_results: Array<{ [key: string]: unknown }>;
  message: string;
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

export const ripsApi = {
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
  submit: (id: string, body?: { num_factura?: string; xml_fev_b64?: string }) =>
    request<RipsSubmitResponse>("POST", `/rips/${id}/submit`, body ?? {}),
};
