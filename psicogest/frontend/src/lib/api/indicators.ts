import { request } from "./client";

export interface TherapyIndicator {
  id: string;
  patient_id: string;
  name: string;
  description: string | null;
  unit: string | null;
  initial_value: number | null;
  target_value: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TherapyMeasurement {
  id: string;
  indicator_id: string;
  session_id: string | null;
  value: number;
  notes: string | null;
  measured_at: string;
  created_at: string;
}

export interface TherapyIndicatorWithMeasurements extends TherapyIndicator {
  measurements: TherapyMeasurement[];
}

export interface TherapyIndicatorCreate {
  name: string;
  description?: string | null;
  unit?: string | null;
  initial_value?: number | null;
  target_value?: number | null;
}

export interface TherapyIndicatorUpdate extends Partial<TherapyIndicatorCreate> {
  is_active?: boolean;
}

export interface TherapyMeasurementCreate {
  value: number;
  notes?: string | null;
  session_id?: string | null;
  measured_at: string;
}

export const indicatorsApi = {
  list: (patientId: string): Promise<TherapyIndicator[]> =>
    request<TherapyIndicator[]>("GET", `/patients/${patientId}/indicators`),
  create: (patientId: string, body: TherapyIndicatorCreate): Promise<TherapyIndicator> =>
    request<TherapyIndicator>("POST", `/patients/${patientId}/indicators`, body),
  get: (indicatorId: string): Promise<TherapyIndicatorWithMeasurements> =>
    request<TherapyIndicatorWithMeasurements>("GET", `/indicators/${indicatorId}`),
  update: (indicatorId: string, body: TherapyIndicatorUpdate): Promise<TherapyIndicator> =>
    request<TherapyIndicator>("PUT", `/indicators/${indicatorId}`, body),
  delete: (indicatorId: string): Promise<void> =>
    request<void>("DELETE", `/indicators/${indicatorId}`),
  addMeasurement: (indicatorId: string, body: TherapyMeasurementCreate): Promise<TherapyMeasurement> =>
    request<TherapyMeasurement>("POST", `/indicators/${indicatorId}/measurements`, body),
  listMeasurements: (indicatorId: string): Promise<TherapyMeasurement[]> =>
    request<TherapyMeasurement[]>("GET", `/indicators/${indicatorId}/measurements`),
};
