import { request } from "./client";
import type { CashTransactionSummary } from "./caja";

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
}

export const carteraApi = {
  list: (params?: { type?: PortfolioType; search?: string; page?: number; page_size?: number }) => {
    const q = new URLSearchParams();
    if (params?.type && params.type !== "all") q.set("type", params.type);
    if (params?.search) q.set("patient_name", params.search);
    if (params?.page_size) q.set("limit", String(params.page_size));
    return request<{ items: CarteraSummary[]; total: number }>("GET", `/cartera?${q}`);
  },
  getSummary: () => request<CarteraPortfolioSummary>("GET", "/cartera/summary"),
  registerPayment: (invoiceId: string, body: CarteraPaymentCreate) =>
    request<CashTransactionSummary>("POST", `/cartera/invoices/${invoiceId}/payments`, body),
};
