/** AI Configuration hook */
import { useState, useCallback } from "react";
import { api, AIConfig, AIProvider, AIValidationResult } from "@/lib/ai";

export interface UseAiConfigReturn {
  config: AIConfig | null;
  loading: boolean;
  error: string | null;
  fetchConfig: () => Promise<void>;
  updateConfig: (provider: AIProvider, model: string, apiKey: string) => Promise<AIValidationResult>;
  validateConfig: () => Promise<AIValidationResult>;
}

export function useAiConfig(): UseAiConfigReturn {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getConfig();
      setConfig(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar configuración");
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (
    provider: AIProvider,
    model: string,
    apiKey: string
  ): Promise<AIValidationResult> => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.updateConfig({ provider, model, api_key: apiKey });
      if (result.valid) {
        setConfig({ provider, model });
      }
      return result;
    } catch (e) {
      const err = e instanceof Error ? e.message : "Error al guardar configuración";
      setError(err);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const validateConfig = useCallback(async (): Promise<AIValidationResult> => {
    setLoading(true);
    setError(null);
    try {
      return await api.validateConfig();
    } catch (e) {
      const err = e instanceof Error ? e.message : "Error al validar configuración";
      setError(err);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    config,
    loading,
    error,
    fetchConfig,
    updateConfig,
    validateConfig,
  };
}