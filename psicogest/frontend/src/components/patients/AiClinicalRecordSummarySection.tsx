import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { AiFeatureBadge } from "@/components/ui/AiFeatureBadge";
import { useAiSummaries } from "@/hooks/useAiSummaries";
import type { ClinicalRecordSummary } from "@/lib/ai";

interface Props {
  patientId: string;
  canSummarize: boolean;
}

export function AiClinicalRecordSummarySection({ patientId, canSummarize }: Props) {
  const { summarizeClinicalRecord, loading, error, clearError } = useAiSummaries();
  const [result, setResult] = useState<ClinicalRecordSummary | null>(null);
  const [editedSummary, setEditedSummary] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const handleGenerate = async () => {
    clearError();
    const summary = await summarizeClinicalRecord(patientId);
    setResult(summary);
    setEditedSummary(summary.summary);
  };

  return (
    <AiFeatureBadge available={canSummarize} featureName="resumen de historia clínica">
      <div className="space-y-3">
        <p className="text-[12px]" style={{ color: "var(--psy-ink-3)" }}>
          Resumen inteligente de la historia clínica incluyendo las últimas sesiones realizadas.
        </p>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors"
          style={{
            background: loading ? "var(--psy-bg-soft)" : "var(--psy-primary)",
            color: loading ? "var(--psy-ink-3)" : "#fff",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          {result ? "Actualizar resumen" : "Generar resumen"}
        </button>

        {error && (
          <p className="text-[12px]" style={{ color: "var(--psy-danger)" }}>{error}</p>
        )}

        {result && (
          <div className="space-y-3">
            {isEditing ? (
              <textarea
                className="w-full rounded-md text-[13px] px-3 py-2 resize-y min-h-[120px]"
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

            {result.key_aspects.length > 0 && (
              <div>
                <p className="text-[11px] psy-mono uppercase tracking-wider mb-1.5" style={{ color: "var(--psy-ink-3)" }}>
                  Aspectos clave
                </p>
                <ul className="space-y-1">
                  {result.key_aspects.map((a, i) => (
                    <li key={i} className="text-[12px] flex items-start gap-1.5" style={{ color: "var(--psy-ink-2)" }}>
                      <span style={{ color: "var(--psy-sage)" }}>·</span> {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.recommendations.length > 0 && (
              <div>
                <p className="text-[11px] psy-mono uppercase tracking-wider mb-1.5" style={{ color: "var(--psy-ink-3)" }}>
                  Recomendaciones
                </p>
                <ul className="space-y-1">
                  {result.recommendations.map((r, i) => (
                    <li key={i} className="text-[12px] flex items-start gap-1.5" style={{ color: "var(--psy-ink-2)" }}>
                      <span style={{ color: "var(--psy-sage)" }}>·</span> {r}
                    </li>
                  ))}
                </ul>
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