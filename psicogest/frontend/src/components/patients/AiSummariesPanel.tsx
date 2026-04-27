import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAiSummaries } from "@/hooks/useAiSummaries";
import { Loader2, FileText, Sparkles, Copy, Check } from "lucide-react";

interface AiSummariesPanelProps {
  patientId: string;
  sessionId?: string;
}

export function AiSummariesPanel({ patientId, sessionId }: AiSummariesPanelProps) {
  const {
    sessionSummaries,
    clinicalRecordSummaries,
    loading,
    error,
    summarizeSession,
    summarizeClinicalRecord,
    clearError,
  } = useAiSummaries();

  const [copiedText, setCopiedText] = useState<string | null>(null);

  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleSummarizeSession = async () => {
    if (!sessionId) return;
    try {
      await summarizeSession(sessionId);
    } catch (e) {
      console.error("Error summarizing session:", e);
    }
  };

  const handleSummarizeClinicalRecord = async () => {
    try {
      await summarizeClinicalRecord(patientId);
    } catch (e) {
      console.error("Error summarizing clinical record:", e);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const latestSessionSummary = sessionSummaries[0];
  const latestClinicalSummary = clinicalRecordSummaries[0];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#2E86AB]" />
              Resumen de Sesión
            </CardTitle>
            <Button
              onClick={handleSummarizeSession}
              disabled={loading || !sessionId}
              size="sm"
              variant="outline"
              className="border-[#2E86AB] text-[#2E86AB] hover:bg-[#2E86AB] hover:text-white"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Resumir Sesión
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800 mb-4">
              {error}
            </div>
          )}

          {!sessionId && (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Selecciona una sesión para resumir
            </div>
          )}

          {sessionId && !latestSessionSummary && !loading && (
            <div className="text-center py-4 text-muted-foreground text-sm">
              <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Sin resumen aún</p>
            </div>
          )}

          {latestSessionSummary && (
            <div className="space-y-3">
              <div className="text-sm">{latestSessionSummary.summary}</div>
              {latestSessionSummary.key_topics.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {latestSessionSummary.key_topics.map((topic, idx) => (
                    <span
                      key={idx}
                      className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(latestSessionSummary.summary)}
                  className="h-6 text-xs"
                >
                  {copiedText === latestSessionSummary.summary ? (
                    <Check className="h-3 w-3 mr-1" />
                  ) : (
                    <Copy className="h-3 w-3 mr-1" />
                  )}
                  {copiedText === latestSessionSummary.summary ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#2E86AB]" />
              Resumen de Historia Clínica
            </CardTitle>
            <Button
              onClick={handleSummarizeClinicalRecord}
              disabled={loading}
              size="sm"
              variant="outline"
              className="border-[#2E86AB] text-[#2E86AB] hover:bg-[#2E86AB] hover:text-white"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Resumir HC
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && !latestClinicalSummary && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Generando resumen...
            </div>
          )}

          {!loading && !latestClinicalSummary && (
            <div className="text-center py-4 text-muted-foreground text-sm">
              <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Sin resumen aún</p>
            </div>
          )}

          {latestClinicalSummary && (
            <div className="space-y-3">
              <div className="text-sm">{latestClinicalSummary.summary}</div>

              {latestClinicalSummary.key_aspects.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Aspectos clave</p>
                  <div className="flex flex-wrap gap-1">
                    {latestClinicalSummary.key_aspects.map((aspect, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded"
                      >
                        {aspect}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {latestClinicalSummary.recommendations.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Recomendaciones</p>
                  <div className="flex flex-wrap gap-1">
                    {latestClinicalSummary.recommendations.map((rec, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded"
                      >
                        {rec}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(latestClinicalSummary.summary)}
                  className="h-6 text-xs"
                >
                  {copiedText === latestClinicalSummary.summary ? (
                    <Check className="h-3 w-3 mr-1" />
                  ) : (
                    <Copy className="h-3 w-3 mr-1" />
                  )}
                  {copiedText === latestClinicalSummary.summary ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}