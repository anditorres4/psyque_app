import { request, downloadBlob } from "./client";

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

export const referralsApi = {
  list: (patientId: string) =>
    request<Referral[]>("GET", `/patients/${patientId}/referrals`),
  create: (patientId: string, body: ReferralCreate) =>
    request<Referral>("POST", `/patients/${patientId}/referrals`, body),
  downloadPdf: (referralId: string) =>
    downloadBlob("GET", `/referrals/${referralId}/pdf`),
};
