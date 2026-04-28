import { useState } from "react";
import { Loader2 } from "lucide-react";
import { AiFeatureBadge } from "@/components/ui/AiFeatureBadge";
import { useAiSummaries } from "@/hooks/useAiSummaries";
import type { SessionSummary } from "@/lib/ai";

interface Props {
  sessionId: string | null;
  canSummarize: boolean;
  intervention: string;
  evolution: string;
  onSummaryGenerated?: (summary: SessionSummary) => void;
}

export function AiSessionSummarySection({
  sessionId, canSummarize, intervention, evolution, onSummaryGenerated,
}: Props) {
  const { summarizeSession, loading, error, clearError } = useAiSummaries();
  const [result, setResult] = useState<SessionSummary | null>(null);
  const [editedSummary, setEditedSummary] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const hasContent = !!(intervention.trim() || evolution.trim());
  const isPreSave = sessionId === null;

  const handleGenerate = async () => {
    if (!sessionId) return;
    clearError();
    const summary = await summarizeSession(sessionId);
    setResult(summary);
    setEditedSummary(summary.summary);
    onSummaryGenerated?.(summary);
  };

  return (
    <AiFeatureBadge available={canSummarize} featureName="resumen de sesión">
      <div className="space-y-3">
        <p className="text-[12px]" style={{ color: "var(--psy-ink-3)" }}>
          Genera un resumen clínico de la sesión a partir de la intervención y evolución.
        </p>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || !hasContent || isPreSave}
          title={isPreSave ? "Guarda la sesión primero para generar el resumen" : undefined}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors"
          style={{
            background: loading || !hasContent || isPreSave ? "var(--psy-bg-soft)" : "var(--psy-primary)",
            color: loading || !hasContent || isPreSave ? "var(--psy-ink-3)" : "#fff",
            cursor: loading || !hasContent || isPreSave ? "not-allowed" : "pointer",
          }}
        >
          {loading && <Loader2 size={13} className="animate-spin" />}
          {isPreSave ? "Disponible al guardar la sesión" : loading ? "Generando..." : "Generar resumen IA"}
        </button>

        {!hasContent && !isPreSave && (
          <p className="text-[11px]" style={{ color: "var(--psy-ink-4)" }}>
            Completa la intervención o evolución para generar el resumen.
          </p>
        )}

        {error && (
          <p className="text-[12px]" style={{ color: "var(--psy-danger)" }}>{error}</p>
        )}

        {result && (
          <div className="space-y-2">
            {isEditing ? (
              <textarea
                className="w-full rounded-md text-[13px] px-3 py-2 resize-y min-h-[100px]"
                style={{
                  border: "1px solid var(--psy-line)",
                  background: "var(--psy-surface)",
                  color: "var(--psy-ink-1)",
                }}
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
              />
            ) : (
              <p
                className="text-[13px] leading-relaxed p-3 rounded-md"
                style={{ background: "var(--psy-bg-soft)", color: "var(--psy-ink-1)" }}
              >
                {editedSummary}
              </p>
            )}

            {result.key_topics.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {result.key_topics.map((topic) => (
                  <span
                    key={topic}
                    className="text-[11px] px-2 py-0.5 rounded-full psy-mono"
                    style={{ background: "var(--psy-sage-bg)", color: "var(--psy-ink-2)" }}
                  >
                    {topic}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsEditing((v) => !v)}
                className="text-[12px] underline"
                style={{ color: "var(--psy-ink-3)" }}
              >
                {isEditing ? "Terminar edición" : "Editar resumen"}
              </button>
              <span className="psy-mono text-[10px]" style={{ color: "var(--psy-ink-4)" }}>
                {result.model_version}
              </span>
            </div>
          </div>
        )}
      </div>
    </AiFeatureBadge>
  );
}