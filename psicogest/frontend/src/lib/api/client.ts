/**
 * Core API client: base URL, auth header, request helpers, ApiError.
 */
import { supabase } from "../supabase";

export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

export async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("No autenticado");
  return { Authorization: `Bearer ${token}` };
}

export async function request<T>(
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

export async function downloadBlob(
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

export async function publicRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
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
