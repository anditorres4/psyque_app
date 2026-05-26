import { request } from "./client";

export interface AntecedentesBlock {
  items: string[];
  notas: string;
}

export interface MentalExamBlock {
  appearance: string | null;
  psychomotor: string | null;
  cognition: string | null;
  thought: string | null;
  perception: string | null;
  affect: string | null;
  insight: string | null;
  judgment: string | null;
  language: string | null;
  orientation: string | null;
}

export interface ClinicalRecord {
  id: string;
  patient_id: string;
  chief_complaint: string | null;
  antecedentes_personales: AntecedentesBlock | null;
  antecedentes_familiares: AntecedentesBlock | null;
  antecedentes_medicos: AntecedentesBlock | null;
  antecedentes_psicologicos: AntecedentesBlock | null;
  initial_diagnosis_cie11: string | null;
  initial_diagnosis_description: string | null;
  treatment_plan: string | null;
  therapeutic_goals: string | null;
  presenting_problems: string | null;
  symptom_description: string | null;
  mental_exam: MentalExamBlock | null;
  created_at: string;
  updated_at: string;
}

export interface ClinicalRecordUpsert {
  chief_complaint?: string | null;
  antecedentes_personales?: AntecedentesBlock | null;
  antecedentes_familiares?: AntecedentesBlock | null;
  antecedentes_medicos?: AntecedentesBlock | null;
  antecedentes_psicologicos?: AntecedentesBlock | null;
  initial_diagnosis_cie11?: string | null;
  initial_diagnosis_description?: string | null;
  treatment_plan?: string | null;
  therapeutic_goals?: string | null;
  presenting_problems?: string | null;
  symptom_description?: string | null;
  mental_exam?: MentalExamBlock | null;
}

export const clinicalRecordApi = {
  get: (patientId: string): Promise<ClinicalRecord> =>
    request<ClinicalRecord>("GET", `/patients/${patientId}/clinical-record`),
  upsert: (patientId: string, body: ClinicalRecordUpsert): Promise<ClinicalRecord> =>
    request<ClinicalRecord>("PUT", `/patients/${patientId}/clinical-record`, body),
};
