import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAiDocuments } from "@/hooks/useAiDocuments";
import { useDocuments } from "@/hooks/useDocuments";
import { Loader2, FileText, Sparkles } from "lucide-react";

interface AiDocumentsPanelProps {
  patientId: string;
}

export function AiDocumentsPanel({ patientId }: AiDocumentsPanelProps) {
  const { data: documents } = useDocuments(patientId);
  const { analyses, loading, error, analyzeDocument, clearError } = useAiDocuments();
  const [selectedDocId, setSelectedDocId] = useState<string>("");

  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleAnalyze = async () => {
    if (!selectedDocId) return;
    try {
      await analyzeDocument(patientId, selectedDocId);
    } catch (e) {
      console.error("Error analyzing document:", e);
    }
  };

  const latestAnalysis = analyses[0];

  const patientDocs = documents ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#2E86AB]" />
            Análisis de Documentos
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800 mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="flex gap-2">
            <Select value={selectedDocId} onValueChange={setSelectedDocId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecciona un documento" />
              </SelectTrigger>
              <SelectContent>
                {patientDocs.map((doc) => (
                  <SelectItem key={doc.id} value={doc.id}>
                    {doc.filename || doc.document_type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleAnalyze}
              disabled={loading || !selectedDocId}
              variant="outline"
              className="border-[#2E86AB] text-[#2E86AB] hover:bg-[#2E86AB] hover:text-white"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Analizar
            </Button>
          </div>

          {loading && !latestAnalysis && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Analizando documento...
            </div>
          )}

          {!loading && !latestAnalysis && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Selecciona un documento para analizar</p>
            </div>
          )}

          {latestAnalysis && (
            <div className="space-y-4">
              {latestAnalysis.key_findings.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Hallazgos clave
                  </p>
                  <div className="space-y-1">
                    {latestAnalysis.key_findings.map((finding, idx) => (
                      <div
                        key={idx}
                        className="text-sm bg-slate-50 p-2 rounded"
                      >
                        {finding}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(latestAnalysis.analysis).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Análisis
                  </p>
                  <pre className="text-xs bg-slate-50 p-3 rounded overflow-x-auto">
                    {JSON.stringify(latestAnalysis.analysis, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
