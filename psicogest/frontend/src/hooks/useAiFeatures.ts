/** AI Features hook - reads plan and feature flags from tenant */
import { useQuery } from "@tanstack/react-query";
import { api as aiApi } from "@/lib/ai";

export interface AiFeatures {
  canDiagnose: boolean;
  canSummarize: boolean;
  canAnalyzeDocuments: boolean;
  isLoading: boolean;
}

export function useAiFeatures(): AiFeatures {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-features"],
    queryFn: () => aiApi.getFeatures(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return {
    canDiagnose: data?.ai_diagnosis ?? false,
    canSummarize: data?.ai_summaries ?? false,
    canAnalyzeDocuments: data?.ai_documents ?? false,
    isLoading,
  };
}