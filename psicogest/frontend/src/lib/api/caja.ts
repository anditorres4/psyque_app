import { request } from "./client";

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

export const cajaApi = {
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
};
