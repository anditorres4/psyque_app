/** AI Summaries hook */
import { useState, useCallback } from "react";
import { api, SessionSummary, ClinicalRecordSummary } from "@/lib/ai";

export interface UseAiSummariesReturn {
  sessionSummaries: SessionSummary[];
  clinicalRecordSummaries: ClinicalRecordSummary[];
  loading: boolean;
  error: string | null;
  summarizeSession: (sessionId: string) => Promise<SessionSummary>;
  summarizeClinicalRecord: (patientId: string) => Promise<ClinicalRecordSummary>;
  clearError: () => void;
}

export function useAiSummaries(): UseAiSummariesReturn {
  const [sessionSummaries, setSessionSummaries] = useState<SessionSummary[]>([]);
  const [clinicalRecordSummaries, setClinicalRecordSummaries] = useState<ClinicalRecordSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summarizeSession = useCallback(async (sessionId: string): Promise<SessionSummary> => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.summarizeSession(sessionId);
      setSessionSummaries(prev => [result, ...prev]);
      return result;
    } catch (e) {
      const err = e instanceof Error ? e.message : "Error al resumir sesión";
      setError(err);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const summarizeClinicalRecord = useCallback(async (patientId: string): Promise<ClinicalRecordSummary> => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.summarizeClinicalRecord(patientId);
      setClinicalRecordSummaries(prev => [result, ...prev]);
      return result;
    } catch (e) {
      const err = e instanceof Error ? e.message : "Error al resumir historia clínica";
      setError(err);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    sessionSummaries,
    clinicalRecordSummaries,
    loading,
    error,
    summarizeSession,
    summarizeClinicalRecord,
    clearError,
  };
}