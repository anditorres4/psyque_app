/** AI Document Analysis hook */
import { useState, useCallback } from "react";
import { api, DocumentAnalysis } from "@/lib/ai";

export interface UseAiDocumentsReturn {
  analyses: DocumentAnalysis[];
  loading: boolean;
  error: string | null;
  analyzeDocument: (documentId: string) => Promise<DocumentAnalysis>;
  clearError: () => void;
}

export function useAiDocuments(): UseAiDocumentsReturn {
  const [analyses, setAnalyses] = useState<DocumentAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeDocument = useCallback(async (documentId: string): Promise<DocumentAnalysis> => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.analyzeDocument(documentId);
      setAnalyses(prev => [result, ...prev]);
      return result;
    } catch (e) {
      const err = e instanceof Error ? e.message : "Error al analizar documento";
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
    analyses,
    loading,
    error,
    analyzeDocument,
    clearError,
  };
}