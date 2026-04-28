import { useState } from "react";
import { CheckCircle, XCircle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { AiFeatureBadge } from "@/components/ui/AiFeatureBadge";
import { useAiDiagnosis } from "@/hooks/useAiDiagnosis";
import type { MentalExamBlock } from "@/lib/api";
import type { DiagnosisCode } from "@/lib/ai";

interface Props {
  patientId: string;
  canDiagnose: boolean;
  chiefComplaint: string;
  presentingProblems: string;
  symptomDescription: string;
  mentalExam: MentalExamBlock;
  patientAge: number | null;
  onAccept: (code: string, description: string) => void;
}

function getConfidenceBadge(confidence: number): { label: string; style: React.CSSProperties } {
  if (confidence >= 0.7) return { label: "Alta",  style: { background: "var(--psy-sage-bg)", color: "var(--psy-ok)" } };
  if (confidence >= 0.4) return { label: "Media", style: { background: "#FFF8EC", color: "var(--psy-warn)" } };
  return                        { label: "Baja",  style: { background: "var(--psy-bg-soft)", color: "var(--psy-ink-3)" } };
}

function SuggestionCard({
  item,
  onAccept,
  onReject,
}: {
  item: DiagnosisCode;
  onAccept: () => void;
  onReject: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [decided, setDecided] = useState<"accepted" | "rejected" | null>(null);
  const badge = getConfidenceBadge(item.confidence);

  const handleAccept = () => { setDecided("accepted"); onAccept(); };
  const handleReject = () => { setDecided("rejected"); onReject(); };

  return (
    <div
      className="rounded-md p-3 space-y-2 transition-opacity"
      style={{
        border: "1px solid var(--psy-line)",
        background: decided === "accepted" ? "var(--psy-sage-bg)" : decided === "rejected" ? "var(--psy-bg-soft)" : "var(--psy-surface)",
        opacity: decided === "rejected" ? 0.55 : 1,
      }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="psy-mono text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--psy-bg-soft)", color: "var(--psy-primary)" }}>
              {item.code}
            </span>
            <span className="text-[11px] px-1.5 py-0.5 rounded font-medium" style={badge.style}>
              {badge.label}
            </span>
          </div>
          <p className="text-[13px] font-medium" style={{ color: "var(--psy-ink-1)" }}>{item.description}</p>
        </div>
        {!decided && (
          <div className="flex gap-1 shrink-0">
            <button
              type="button"
              onClick={handleAccept}
              className="p-1 rounded transition-colors hover:bg-[var(--psy-sage-bg)]"
              title="Aceptar diagnóstico"
            >
              <CheckCircle size={18} style={{ color: "var(--psy-ok)" }} />
            </button>
            <button
              type="button"
              onClick={handleReject}
              className="p-1 rounded transition-colors hover:bg-[var(--psy-bg-soft)]"
              title="Rechazar"
            >
              <XCircle size={18} style={{ color: "var(--psy-danger)" }} />
            </button>
          </div>
        )}
        {decided === "accepted" && (
          <span className="text-[11px] font-medium shrink-0" style={{ color: "var(--psy-ok)" }}>✓ Aceptado</span>
        )}
        {decided === "rejected" && (
          <span className="text-[11px] font-medium shrink-0" style={{ color: "var(--psy-ink-3)" }}>Rechazado</span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[11px] transition-colors"
        style={{ color: "var(--psy-ink-3)" }}
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {open ? "Ocultar justificación" : "Ver justificación"}
      </button>
      {open && (
        <p className="text-[12px] pt-1 border-t" style={{ color: "var(--psy-ink-2)", borderColor: "var(--psy-line)" }}>
          Confianza: {Math.round(Number(item.confidence) * 100)}%
        </p>
      )}
    </div>
  );
}

export function AiDiagnosisSection({
  patientId, canDiagnose,
  chiefComplaint, presentingProblems, symptomDescription,
  mentalExam, patientAge, onAccept,
}: Props) {
  const { suggestions, loading, error, suggestDiagnosis, submitFeedback, clearError } = useAiDiagnosis();
  const [currentSuggestion, setCurrentSuggestion] = useState<typeof suggestions[0] | null>(null);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  const hasContext = !!(chiefComplaint.trim() || presentingProblems.trim() || symptomDescription.trim());

  const buildSummary = () => {
    const parts: string[] = [];
    if (patientAge) parts.push(`Edad: ${patientAge} años`);
    if (chiefComplaint) parts.push(`Motivo: ${chiefComplaint}`);
    if (presentingProblems) parts.push(`Problemas: ${presentingProblems}`);
    if (symptomDescription) parts.push(`Síntomas: ${symptomDescription}`);
    const examEntries = Object.entries(mentalExam).filter(([, v]) => v);
    if (examEntries.length) parts.push(`Examen mental: ${examEntries.map(([k, v]) => `${k}: ${v}`).join("; ")}`);
    return parts.join("\n");
  };

  const handleSuggest = async () => {
    clearError();
    setCurrentSuggestion(null);
    setAccepted([]);
    setRejected([]);
    setFeedbackSaved(false);
    const result = await suggestDiagnosis({
      patientId,
      clinicalRecordSummary: buildSummary(),
      currentSymptoms: symptomDescription ? [symptomDescription] : [],
    });
    setCurrentSuggestion(result);
  };

  const handleAccept = (item: DiagnosisCode) => {
    setAccepted((prev) => [...prev, item.code]);
    onAccept(item.code, item.description);
  };

  const handleReject = (code: string) => {
    setRejected((prev) => [...prev, code]);
  };

  const handleSaveFeedback = async () => {
    if (!currentSuggestion) return;
    await submitFeedback(currentSuggestion.id, accepted, rejected);
    setFeedbackSaved(true);
  };

  return (
    <AiFeatureBadge available={canDiagnose} featureName="sugerencias de diagnóstico CIE-11">
      <div className="space-y-3">
        <p className="text-[12px]" style={{ color: "var(--psy-ink-3)" }}>
          Genera sugerencias de diagnóstico a partir del contexto clínico. Acepta ✓ para copiar el código al formulario.
        </p>

        <button
          type="button"
          onClick={handleSuggest}
          disabled={loading || !hasContext}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors"
          style={{
            background: loading || !hasContext ? "var(--psy-bg-soft)" : "var(--psy-primary)",
            color: loading || !hasContext ? "var(--psy-ink-3)" : "#fff",
            border: "1px solid transparent",
            cursor: loading || !hasContext ? "not-allowed" : "pointer",
          }}
        >
          {loading && <Loader2 size={13} className="animate-spin" />}
          {loading ? "Analizando..." : "Sugerir diagnósticos CIE-11"}
        </button>

        {!hasContext && (
          <p className="text-[11px]" style={{ color: "var(--psy-ink-4)" }}>
            Completa al menos uno de: motivo de consulta, problemas presentantes o síntomas.
          </p>
        )}

        {error && (
          <p className="text-[12px]" style={{ color: "var(--psy-danger)" }}>{error}</p>
        )}

        {currentSuggestion && currentSuggestion.suggestions.length === 0 && (
          <p className="text-[12px]" style={{ color: "var(--psy-ink-3)" }}>
            El modelo no encontró diagnósticos con el contexto disponible. Agrega más detalle clínico.
          </p>
        )}

        {currentSuggestion && currentSuggestion.suggestions.map((item) => (
          <SuggestionCard
            key={item.code}
            item={item}
            onAccept={() => handleAccept(item)}
            onReject={() => handleReject(item.code)}
          />
        ))}

        {currentSuggestion && (accepted.length > 0 || rejected.length > 0) && !feedbackSaved && (
          <button
            type="button"
            onClick={handleSaveFeedback}
            className="text-[12px] underline transition-colors"
            style={{ color: "var(--psy-ink-3)" }}
          >
            Guardar decisiones para auditoría
          </button>
        )}
        {feedbackSaved && (
          <p className="text-[12px]" style={{ color: "var(--psy-ok)" }}>✓ Decisiones guardadas.</p>
        )}

        {currentSuggestion && (
          <p className="text-[11px]" style={{ color: "var(--psy-ink-4)" }}>
            Sugerencias orientativas. La decisión diagnóstica es responsabilidad del profesional.
          </p>
        )}
      </div>
    </AiFeatureBadge>
  );
}