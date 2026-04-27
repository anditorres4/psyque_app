import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAiDiagnosis } from "@/hooks/useAiDiagnosis";
import { Loader2, Check, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClinicalRecord } from "@/lib/api";

interface AiDiagnosisPanelProps {
  patientId: string;
  clinicalRecord?: ClinicalRecord | null;
  recentSessions?: Array<{ id: string; date: string; notes?: string }>;
}

export function AiDiagnosisPanel({
  patientId,
  clinicalRecord,
  recentSessions,
}: AiDiagnosisPanelProps) {
  const {
    suggestions,
    loading,
    error,
    suggestDiagnosis,
    submitFeedback,
    fetchHistory,
    clearError,
  } = useAiDiagnosis();

  const [currentSuggestion, setCurrentSuggestion] = useState<string | null>(null);
  const [acceptedCodes, setAcceptedCodes] = useState<string[]>([]);
  const [rejectedCodes, setRejectedCodes] = useState<string[]>([]);

  useEffect(() => {
    fetchHistory(patientId);
  }, [patientId, fetchHistory]);

  const handleSuggest = async () => {
    clearError();
    const recordSummary = clinicalRecord
      ? `Motivo de consulta: ${clinicalRecord.chief_complaint || 'No registrado'}\n\nProblemas presentados: ${clinicalRecord.presenting_problems || 'No registrado'}\n\nDescripción de síntomas: ${clinicalRecord.symptom_description || 'No registrado'}`
      : "Sin información de historia clínica";

    const sessionsSummary = recentSessions
      ?.slice(0, 5)
      .map((s) => `Fecha: ${s.date} - ${s.notes || "Sin notas"}`)
      .join("\n");

    const symptoms = clinicalRecord?.presenting_problems 
      ? [clinicalRecord.presenting_problems as string] 
      : [];

    try {
      const result = await suggestDiagnosis({
        patientId,
        clinicalRecordSummary: recordSummary,
        recentSessionsSummary: sessionsSummary,
        currentSymptoms: symptoms || [],
      });
      setCurrentSuggestion(result.id);
      setAcceptedCodes(result.accepted_codes);
      setRejectedCodes(result.rejected_codes);
    } catch (e) {
      console.error("Error generating diagnosis:", e);
    }
  };

  const handleAcceptCode = (code: string) => {
    if (!acceptedCodes.includes(code)) {
      setAcceptedCodes([...acceptedCodes, code]);
      setRejectedCodes(rejectedCodes.filter((c) => c !== code));
    }
  };

  const handleRejectCode = (code: string) => {
    if (!rejectedCodes.includes(code)) {
      setRejectedCodes([...rejectedCodes, code]);
      setAcceptedCodes(acceptedCodes.filter((c) => c !== code));
    }
  };

  const handleSubmitFeedback = async () => {
    if (!currentSuggestion) return;
    try {
      await submitFeedback(currentSuggestion, acceptedCodes, rejectedCodes);
      setCurrentSuggestion(null);
      setAcceptedCodes([]);
      setRejectedCodes([]);
    } catch (e) {
      console.error("Error submitting feedback:", e);
    }
  };

  const latestSuggestion = suggestions[0];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#2E86AB]" />
            Sugerencia de Diagnóstico
          </CardTitle>
          <Button
            onClick={handleSuggest}
            disabled={loading}
            size="sm"
            variant="outline"
            className="border-[#2E86AB] text-[#2E86AB] hover:bg-[#2E86AB] hover:text-white"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generar Sugerencia
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800 mb-4">
            {error}
          </div>
        )}

        {loading && !latestSuggestion && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Generando sugerencias...
          </div>
        )}

        {!loading && !latestSuggestion && !currentSuggestion && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Sin sugerencias aún</p>
            <p className="text-xs mt-1">
              Haz clic en "Generar Sugerencia" para obtener códigos CIE-10 sugeridos
            </p>
          </div>
        )}

        {(latestSuggestion || currentSuggestion) && (
          <div className="space-y-4">
            <div className="space-y-2">
              {(latestSuggestion?.suggestions || []).map((item, idx) => {
                const isAccepted = acceptedCodes.includes(item.code);
                const isRejected = rejectedCodes.includes(item.code);

                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-colors",
                      isAccepted && "bg-green-50 border-green-200",
                      isRejected && "bg-red-50 border-red-200",
                      !isAccepted && !isRejected && "bg-white"
                    )}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">{item.code}</span>
                        <span className="text-xs text-muted-foreground">
                          {(item.confidence * 100).toFixed(0)}% confianza
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAcceptCode(item.code)}
                        className={cn(
                          "h-8 w-8 p-0",
                          isAccepted ? "text-green-600 bg-green-100" : "text-green-600 hover:bg-green-50"
                        )}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRejectCode(item.code)}
                        className={cn(
                          "h-8 w-8 p-0",
                          isRejected ? "text-red-600 bg-red-100" : "text-red-600 hover:bg-red-50"
                        )}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {currentSuggestion && (
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentSuggestion(null)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSubmitFeedback} className="bg-[#1E3A5F]">
                  Guardar Selección
                </Button>
              </div>
            )}

            {latestSuggestion && !currentSuggestion && (latestSuggestion.accepted_codes.length > 0 || latestSuggestion.rejected_codes.length > 0) && (
              <div className="text-xs text-muted-foreground pt-2 border-t">
                <span className="text-green-600">
                  Aceptados: {latestSuggestion.accepted_codes.join(", ") || "ninguno"}
                </span>
                {" · "}
                <span className="text-red-600">
                  Rechazados: {latestSuggestion.rejected_codes.join(", ") || "ninguno"}
                </span>
              </div>
            )}
          </div>
        )}

        {suggestions.length > 1 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">Historial de sugerencias</p>
            <div className="space-y-1">
              {suggestions.slice(1, 4).map((s) => (
                <div key={s.id} className="text-xs text-muted-foreground flex justify-between">
                  <span>{new Date(s.created_at).toLocaleDateString()}</span>
                  <span>{s.suggestions.length} códigos</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}