import { request, downloadBlob } from "./client";

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
  amount_paid: number;
  payment_status: "unpaid" | "partial" | "paid";
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

export interface CreditDebitNoteCreate {
  type: "credit" | "debit";
  reason: string;
  amount_cop: number;
}

export interface CreditDebitNoteOut {
  id: string;
  invoice_id: string;
  type: "credit" | "debit";
  number: string;
  reason: string;
  amount_cop: number;
  issued_at: string;
  created_at: string;
}

export const invoicesApi = {
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
  createNote: (id: string, body: CreditDebitNoteCreate) =>
    request<CreditDebitNoteOut>("POST", `/invoices/${id}/notes`, body),
  listNotes: (id: string) =>
    request<CreditDebitNoteOut[]>("GET", `/invoices/${id}/notes`),
};
