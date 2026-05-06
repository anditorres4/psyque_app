import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useSession, useSignSession, useSessionNotes, useAddSessionNote } from "@/hooks/useSessions";
import { useAiFeatures } from "@/hooks/useAiFeatures";
import { AiSessionSummarySection } from "@/components/patients/AiSessionSummarySection";
import { SessionEditForm } from "./SessionEditForm";
import { ApiError, api } from "@/lib/api";
import { Pencil, Loader2, BookOpen, ClipboardCheck } from "lucide-react";

interface Props {
  sessionId: string;
  onBack?: () => void;
}

const CUPS_LABELS: Record<string, string> = {
  "890101": "Consulta de primera vez",
  "890102": "Consulta de control",
  "890403": "Psicoterapia individual adultos",
  "890404": "Psicoterapia individual niños/adolescentes",
  "890601": "Psicoterapia de pareja",
  "890701": "Psicoterapia familiar",
};

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="py-3 border-b last:border-0" style={{ borderColor: "var(--psy-line)" }}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "var(--psy-ink-3)" }}>{label}</dt>
      <dd className="text-[13px] whitespace-pre-wrap" style={{ color: "var(--psy-ink-1)" }}>{value}</dd>
    </div>
  );
}

export function SessionDetail({ sessionId, onBack }: Props) {
  const queryClient = useQueryClient();
  const { data: sess, isLoading } = useSession(sessionId);
  const { data: notes } = useSessionNotes(sessionId);
  const signMutation = useSignSession(sessionId);
  const addNoteMutation = useAddSessionNote(sessionId);
  const { canSummarize } = useAiFeatures();

  const [isEditing, setIsEditing] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [invoiceCreated, setInvoiceCreated] = useState(false);

  // Fetch previous session context (tasks + homework from last SIGNED session)
  const { data: context } = useQuery({
    queryKey: ["session-context", sess?.patient_id],
    queryFn: () => api.sessions.context(sess!.patient_id),
    enabled: !!sess?.patient_id,
  });

  // AI context summary: auto-generate for draft sessions if key is configured and no summary yet
  const contextSummaryMutation = useMutation({
    mutationFn: () => api.sessions.generateContextSummary(sessionId),
    onSuccess: (updated) => {
      queryClient.setQueryData(["session", sessionId], updated);
    },
  });

  const isDraft = sess?.status === "draft";
  const isSigned = sess?.status === "signed";

  // Auto-trigger AI context summary for draft sessions when feature is available
  useEffect(() => {
    if (
      isDraft &&
      canSummarize &&
      sess &&
      !sess.ai_context_summary &&
      !contextSummaryMutation.isPending &&
      !contextSummaryMutation.isError &&
      context &&
      !context.is_first_session
    ) {
      contextSummaryMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDraft, canSummarize, sess?.ai_context_summary, context?.is_first_session]);

  const invoiceMutation = useMutation({
    mutationFn: () =>
      api.invoices.create({
        patient_id: sess!.patient_id,
        session_ids: [sess!.id],
      }),
    onSuccess: () => {
      setInvoiceCreated(true);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (err) => {
      setInvoiceError(err instanceof ApiError ? err.message : "Error al crear la factura.");
    },
  });

  if (isLoading || !sess) {
    return <div className="p-6 text-[13px]" style={{ color: "var(--psy-ink-3)" }}>Cargando sesión...</div>;
  }

  const handleSign = async () => {
    setSignError(null);
    try {
      await signMutation.mutateAsync();
    } catch (err) {
      setSignError(err instanceof ApiError ? err.message : "Error al firmar la sesión.");
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setNoteError(null);
    try {
      await addNoteMutation.mutateAsync(noteContent);
      setNoteContent("");
      setShowNoteForm(false);
    } catch (err) {
      setNoteError(err instanceof ApiError ? err.message : "Error al añadir nota.");
    }
  };

  const start = new Date(sess.actual_start);
  const end = new Date(sess.actual_end);

  // ── Edit mode ──────────────────────────────────────────────────────────────
  if (isEditing && isDraft) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            {onBack && (
              <button type="button" onClick={onBack} className="text-[12px] mb-2 block" style={{ color: "var(--psy-ink-3)" }}>
                ← Volver
              </button>
            )}
            <h2 className="text-[17px] font-semibold" style={{ color: "var(--psy-ink-1)" }}>Editar sesión borrador</h2>
          </div>
        </div>
        <div
          className="p-5 rounded-[var(--radius)]"
          style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
        >
          <SessionEditForm
            sess={sess}
            onCancel={() => setIsEditing(false)}
            onSaved={() => setIsEditing(false)}
          />
        </div>
      </div>
    );
  }

  // ── Read mode ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          {onBack && (
            <button type="button" onClick={onBack} className="text-[12px] mb-2 block" style={{ color: "var(--psy-ink-3)" }}>
              ← Volver
            </button>
          )}
          <div className="flex items-center gap-3">
            <h2 className="text-[17px] font-semibold" style={{ color: "var(--psy-ink-1)" }}>Nota de sesión</h2>
            <span
              className="text-[11px] px-2 py-0.5 rounded font-medium"
              style={{
                background: isSigned ? "var(--psy-sage-bg)" : "var(--psy-warn-bg, #fffbeb)",
                color: isSigned ? "var(--psy-primary)" : "var(--psy-warn, #b45309)",
              }}
            >
              {isSigned ? "Firmada" : "Borrador"}
            </span>
          </div>
          <p className="text-[12px] mt-1" style={{ color: "var(--psy-ink-3)" }}>
            {start.toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {" · "}
            {start.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })} — {end.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        {isDraft && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors hover:bg-[var(--psy-bg-soft)]"
            style={{ border: "1px solid var(--psy-line)", color: "var(--psy-ink-2)" }}
          >
            <Pencil size={13} />
            Editar
          </button>
        )}
      </div>

      {/* ── AI Context Summary (draft sessions only) ── */}
      {isDraft && (
        <div
          className="rounded-[var(--radius)] p-4 space-y-2"
          style={{ background: "var(--psy-sage-bg)", border: "1px solid var(--psy-sage-soft)" }}
        >
          <div className="flex items-center gap-2">
            <BookOpen size={14} style={{ color: "var(--psy-primary)" }} />
            <span className="text-[12px] font-semibold" style={{ color: "var(--psy-primary)" }}>
              Resumen IA de sesiones anteriores
            </span>
          </div>

          {contextSummaryMutation.isPending && (
            <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--psy-ink-3)" }}>
              <Loader2 size={13} className="animate-spin" />
              Generando resumen…
            </div>
          )}

          {sess.ai_context_summary && !contextSummaryMutation.isPending && (
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--psy-ink-1)" }}>
              {sess.ai_context_summary}
            </p>
          )}

          {!sess.ai_context_summary && !contextSummaryMutation.isPending && context?.is_first_session && (
            <p className="text-[12px]" style={{ color: "var(--psy-ink-3)" }}>Primera sesión — sin historial previo.</p>
          )}

          {!sess.ai_context_summary && !contextSummaryMutation.isPending && !context?.is_first_session && !canSummarize && (
            <p className="text-[12px]" style={{ color: "var(--psy-ink-3)" }}>
              Configura una API key de IA en Configuración para activar esta función.
            </p>
          )}

          {contextSummaryMutation.isError && (
            <div className="space-y-1">
              <p className="text-[12px]" style={{ color: "var(--psy-danger)" }}>
                {contextSummaryMutation.error instanceof ApiError
                  ? contextSummaryMutation.error.message
                  : "Error al generar resumen."}
              </p>
              <button
                type="button"
                onClick={() => contextSummaryMutation.mutate()}
                className="text-[12px] underline"
                style={{ color: "var(--psy-primary)" }}
              >
                Reintentar
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Tareas de sesión anterior ── */}
      {context?.last_homework_assigned && (
        <div
          className="rounded-[var(--radius)] p-4 space-y-2"
          style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
        >
          <div className="flex items-center gap-2">
            <ClipboardCheck size={14} style={{ color: "var(--psy-primary)" }} />
            <span className="text-[12px] font-semibold" style={{ color: "var(--psy-ink-1)" }}>
              Tareas asignadas en la sesión anterior
            </span>
          </div>
          <p className="text-[13px] whitespace-pre-wrap" style={{ color: "var(--psy-ink-2)" }}>
            {context.last_homework_assigned}
          </p>
          {context.last_next_session_plan && (
            <div className="pt-2 border-t" style={{ borderColor: "var(--psy-line)" }}>
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--psy-ink-3)" }}>
                Plan previsto para esta sesión:
              </span>
              <p className="text-[13px] mt-0.5" style={{ color: "var(--psy-ink-2)" }}>{context.last_next_session_plan}</p>
            </div>
          )}
        </div>
      )}

      {/* Clinical fields */}
      <div
        className="rounded-[var(--radius)] p-5"
        style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
      >
        <dl>
          <Field label="Diagnóstico CIE-11" value={`${sess.diagnosis_cie11} — ${sess.diagnosis_description}`} />
          <Field label="Código CUPS" value={`${sess.cups_code} — ${CUPS_LABELS[sess.cups_code] ?? sess.cups_code}`} />
          <Field label="Motivo de consulta" value={sess.consultation_reason} />
          <Field label="Intervención realizada" value={sess.intervention} />
          <Field label="Evolución" value={sess.evolution} />
          <Field label="Plan próxima sesión" value={sess.next_session_plan} />
          {sess.homework_assigned && (
            <Field label="Tareas asignadas al paciente" value={sess.homework_assigned} />
          )}
          <Field label="Valor sesión" value={`$${Number(sess.session_fee).toLocaleString("es-CO")} COP`} />
          <Field label="N° autorización" value={sess.authorization_number} />
        </dl>

        {isSigned && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--psy-line)" }}>
            <p className="text-[11px]" style={{ color: "var(--psy-ink-3)" }}>
              Firmada el {new Date(sess.signed_at!).toLocaleString("es-CO")}
            </p>
            <p className="text-[11px] font-mono mt-1 break-all" style={{ color: "var(--psy-ink-3)" }}>
              SHA-256: {sess.session_hash}
            </p>
          </div>
        )}
      </div>

      {/* Sign button */}
      {isDraft && (
        <div className="space-y-2">
          {signError && <p className="text-[13px]" style={{ color: "var(--psy-danger)" }}>{signError}</p>}
          <div
            className="rounded-md p-3 text-[12px]"
            style={{ background: "var(--psy-warn-bg, #fffbeb)", border: "1px solid var(--psy-warn-line, #fde68a)", color: "var(--psy-warn, #92400e)" }}
          >
            Al firmar, la sesión quedará <strong>inmutable</strong> según la Res. 1995/1999.
            Verifique todos los campos antes de firmar.
          </div>
          <Button
            className="bg-[#1E3A5F] hover:bg-[#2E86AB] text-white w-full"
            onClick={handleSign}
            disabled={signMutation.isPending}
          >
            {signMutation.isPending ? "Firmando..." : "✍ Firmar sesión"}
          </Button>
        </div>
      )}

      {/* Invoice creation — signed only */}
      {isSigned && (
        <div className="rounded-[var(--radius)] p-4 space-y-2" style={{ border: "1px solid var(--psy-line)" }}>
          <p className="text-[13px] font-semibold" style={{ color: "var(--psy-ink-1)" }}>Facturación</p>
          {invoiceCreated ? (
            <p className="text-[13px]" style={{ color: "var(--psy-primary)" }}>Factura creada. Puedes verla en el módulo de Facturas.</p>
          ) : (
            <>
              {invoiceError && <p className="text-[12px]" style={{ color: "var(--psy-danger)" }}>{invoiceError}</p>}
              <Button
                size="sm"
                variant="outline"
                onClick={() => invoiceMutation.mutate()}
                disabled={invoiceMutation.isPending}
              >
                {invoiceMutation.isPending ? "Creando factura..." : "Crear factura para esta sesión"}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold" style={{ color: "var(--psy-ink-1)" }}>Notas aclaratorias</h3>
          <Button size="sm" variant="outline" onClick={() => setShowNoteForm(!showNoteForm)}>
            + Añadir nota
          </Button>
        </div>

        {showNoteForm && (
          <form onSubmit={handleAddNote} className="space-y-2 rounded-[var(--radius)] p-4" style={{ background: "var(--psy-bg-soft)", border: "1px solid var(--psy-line)" }}>
            {noteError && <p className="text-[12px]" style={{ color: "var(--psy-danger)" }}>{noteError}</p>}
            <textarea
              className="w-full rounded-md px-3 py-2 text-[13px] min-h-[80px]"
              style={{ border: "1px solid var(--psy-line)", background: "var(--psy-surface)", color: "var(--psy-ink-1)" }}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              required
              minLength={5}
              maxLength={5000}
              placeholder="Aclaración o información adicional..."
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="bg-[#2E86AB] hover:bg-[#1E3A5F] text-white" disabled={addNoteMutation.isPending}>
                {addNoteMutation.isPending ? "Guardando..." : "Guardar nota"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowNoteForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {notes && notes.length > 0 ? (
          <div className="space-y-2">
            {notes.map((note) => (
              <div key={note.id} className="rounded-[var(--radius)] p-4" style={{ border: "1px solid var(--psy-line)", background: "var(--psy-surface)" }}>
                <p className="text-[13px]" style={{ color: "var(--psy-ink-1)" }}>{note.content}</p>
                <p className="text-[11px] mt-2 font-mono" style={{ color: "var(--psy-ink-3)" }}>
                  {new Date(note.created_at).toLocaleString("es-CO")} · SHA-256: {note.note_hash.slice(0, 16)}…
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px]" style={{ color: "var(--psy-ink-3)" }}>Sin notas aclaratorias.</p>
        )}
      </div>

      {/* AI Session Summary (per-session — for post-session analysis) */}
      {isSigned && (
        <div
          className="rounded-[var(--radius)] p-5 space-y-2"
          style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
        >
          <AiSessionSummarySection
            sessionId={sessionId}
            canSummarize={canSummarize}
            intervention={sess.intervention ?? ""}
            evolution={sess.evolution ?? ""}
          />
        </div>
      )}
    </div>
  );
}
