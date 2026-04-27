/** AI Diagnosis hook */
import { useState, useCallback } from "react";
import { api, DiagnosisSuggestion, DiagnosisFeedback } from "@/lib/ai";

export interface UseAiDiagnosisReturn {
  suggestions: DiagnosisSuggestion[];
  loading: boolean;
  error: string | null;
  suggestDiagnosis: (input: {
    patientId: string;
    sessionId?: string;
    clinicalRecordSummary: string;
    recentSessionsSummary?: string;
    currentSymptoms: string[];
    sessionNotes?: string;
  }) => Promise<DiagnosisSuggestion>;
  submitFeedback: (suggestionId: string, accepted: string[], rejected: string[]) => Promise<void>;
  fetchHistory: (patientId: string) => Promise<void>;
  clearError: () => void;
}

export function useAiDiagnosis(): UseAiDiagnosisReturn {
  const [suggestions, setSuggestions] = useState<DiagnosisSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestDiagnosis = useCallback(async (input: {
    patientId: string;
    sessionId?: string;
    clinicalRecordSummary: string;
    recentSessionsSummary?: string;
    currentSymptoms: string[];
    sessionNotes?: string;
  }): Promise<DiagnosisSuggestion> => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.suggestDiagnosis({
        patient_id: input.patientId,
        session_id: input.sessionId,
        clinical_record_summary: input.clinicalRecordSummary,
        recent_sessions_summary: input.recentSessionsSummary,
        current_symptoms: input.currentSymptoms,
        session_notes: input.sessionNotes,
      });
      setSuggestions(prev => [result, ...prev]);
      return result;
    } catch (e) {
      const err = e instanceof Error ? e.message : "Error al generar sugerencias";
      setError(err);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const submitFeedback = useCallback(async (
    suggestionId: string,
    accepted: string[],
    rejected: string[]
  ): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await api.submitDiagnosisFeedback({
        suggestion_id: suggestionId,
        accepted_codes: accepted,
        rejected_codes: rejected,
      });
      setSuggestions(prev =>
        prev.map(s =>
          s.id === suggestionId
            ? { ...s, accepted_codes: accepted, rejected_codes: rejected }
            : s
        )
      );
    } catch (e) {
      const err = e instanceof Error ? e.message : "Error al enviar feedback";
      setError(err);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async (patientId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getDiagnosisHistory(patientId);
      setSuggestions(result);
    } catch (e) {
      const err = e instanceof Error ? e.message : "Error al cargar historial";
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    suggestions,
    loading,
    error,
    suggestDiagnosis,
    submitFeedback,
    fetchHistory,
    clearError,
  };
}