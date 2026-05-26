import { request, ApiError, API_BASE, getAuthHeader } from "./client";

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

export const documentsApi = {
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
};
