import { request, publicRequest } from "./client";

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
  registration_pending: boolean;
  registration_token_expires_at: string | null;
}

export interface RegistrationTokenInfo {
  patient_name: string;
  patient_email: string;
  psychologist_name: string;
  requested_start: string;
  session_type: string;
}

export interface PatientRegistrationBody {
  doc_type: string;
  doc_number: string;
  birth_date: string;
  biological_sex: string;
  phone: string;
}

export interface PatientRegistrationResult {
  patient_name: string;
  appointment_start: string;
}

export const bookingApi = {
  getInfo: (slug: string): Promise<BookingInfo> =>
    publicRequest<BookingInfo>("GET", `/public/booking/${slug}`),
  createRequest: (slug: string, body: BookingRequestCreate): Promise<BookingRequestCreated> =>
    publicRequest<BookingRequestCreated>("POST", `/public/booking/${slug}/request`, body),
};

export const bookingRequestsApi = {
  list: (status?: string): Promise<BookingRequestSummary[]> => {
    const q = status ? `?status=${status}` : "";
    return request<BookingRequestSummary[]>("GET", `/booking-requests${q}`);
  },
  confirm: (id: string): Promise<BookingRequestSummary> =>
    request<BookingRequestSummary>("POST", `/booking-requests/${id}/confirm`),
  reject: (id: string): Promise<BookingRequestSummary> =>
    request<BookingRequestSummary>("POST", `/booking-requests/${id}/reject`),
  resendRegistration: (id: string): Promise<BookingRequestSummary> =>
    request<BookingRequestSummary>("POST", `/booking-requests/${id}/resend-registration`),
};

export const registrationApi = {
  getInfo: (token: string): Promise<RegistrationTokenInfo> =>
    publicRequest<RegistrationTokenInfo>("GET", `/public/booking/registration/${token}`),
  complete: (token: string, body: PatientRegistrationBody): Promise<PatientRegistrationResult> =>
    publicRequest<PatientRegistrationResult>("POST", `/public/booking/registration/${token}`, body),
};
