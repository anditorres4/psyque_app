/** AI Module API client for Psyque app. */
import { request } from "@/lib/api";

export type AIProvider = "anthropic" | "openai" | "gemini";

export interface AIConfig {
  provider: AIProvider | null;
  model: string | null;
}

export interface AIValidationResult {
  valid: boolean;
  message: string;
  available_models: string[];
}

export interface DiagnosisCode {
  code: string;
  description: string;
  confidence: number;
}

export interface DiagnosisSuggestion {
  id: string;
  patient_id: string;
  session_id: string | null;
  suggestions: DiagnosisCode[];
  accepted_codes: string[];
  rejected_codes: string[];
  model_version: string;
  created_at: string;
}

export interface SessionSummary {
  id: string;
  session_id: string;
  summary: string;
  key_topics: string[];
  model_version: string;
  created_at: string;
}

export interface ClinicalRecordSummary {
  id: string;
  patient_id: string;
  summary: string;
  key_aspects: string[];
  recommendations: string[];
  model_version: string;
  created_at: string;
}

export interface DocumentAnalysis {
  id: string;
  document_id: string;
  analysis: Record<string, unknown>;
  key_findings: string[];
  model_version: string;
  created_at: string;
}

export interface DiagnosisFeedback {
  suggestion_id: string;
  accepted_codes: string[];
  rejected_codes: string[];
}

export interface AIFeatures {
  ai_diagnosis: boolean;
  ai_summaries: boolean;
  ai_documents: boolean;
}

export const api = {
  async getConfig(): Promise<AIConfig> {
    return request<AIConfig>("GET", "/ai/config");
  },

  async updateConfig(config: {
    provider: AIProvider;
    model: string;
    api_key: string;
  }): Promise<AIValidationResult> {
    return request<AIValidationResult>("PUT", "/ai/config", config);
  },

  async validateConfig(): Promise<AIValidationResult> {
    return request<AIValidationResult>("POST", "/ai/validate");
  },

  async getFeatures(): Promise<AIFeatures> {
    return request<AIFeatures>("GET", "/ai/features");
  },

  async toggleFeature(feature: keyof AIFeatures, enabled: boolean): Promise<void> {
    return request<void>("POST", "/ai/features", { feature, enabled });
  },

  async suggestDiagnosis(input: {
    patient_id: string;
    session_id?: string;
    clinical_record_summary: string;
    recent_sessions_summary?: string;
    current_symptoms: string[];
    session_notes?: string;
  }): Promise<DiagnosisSuggestion> {
    return request<DiagnosisSuggestion>("POST", "/ai/diagnosis/suggest", input);
  },

  async submitDiagnosisFeedback(feedback: DiagnosisFeedback): Promise<void> {
    return request<void>("POST", "/ai/diagnosis/feedback", feedback);
  },

  async getDiagnosisHistory(patientId: string): Promise<DiagnosisSuggestion[]> {
    return request<DiagnosisSuggestion[]>("GET", `/ai/diagnosis/history/${patientId}`);
  },

  async summarizeSession(sessionId: string): Promise<SessionSummary> {
    return request<SessionSummary>("POST", "/ai/summarize/session", {
      session_id: sessionId,
    });
  },

  async summarizeClinicalRecord(patientId: string): Promise<ClinicalRecordSummary> {
    return request<ClinicalRecordSummary>("POST", "/ai/summarize/clinical-record", {
      patient_id: patientId,
    });
  },

  async analyzeDocument(patientId: string, documentId: string): Promise<DocumentAnalysis> {
    return request<DocumentAnalysis>("POST", "/ai/analyze/document", {
      patient_id: patientId,
      document_id: documentId,
    });
  },
};

export const AI_PROVIDERS: Record<AIProvider, { name: string; models: string[] }> = {
  anthropic: {
    name: "Anthropic Claude",
    models: [
      "claude-opus-4-5-20250514",
      "claude-sonnet-4-20250514",
      "claude-haiku-4-5-20251001",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
    ],
  },
  openai: {
    name: "OpenAI",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  },
  gemini: {
    name: "Google Gemini",
    models: [
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
    ],
  },
};
