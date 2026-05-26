/**
 * SessionDocPage — Documentación de sesión en tiempo real.
 * Panel izquierdo: historia clínica + datos de sesión.
 * Panel derecho: videollamada embebida + resumen para paciente + tareas.
 * Todos los campos editables mientras status=draft. Inmutables tras firmar.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send, PenLine, Lock, Loader2, AlertCircle, FileDown, Pencil } from "lucide-react";

import { api, type SessionDetail, type SessionUpdatePayload, ApiError } from "@/lib/api";
import { HmsVideoPanel } from "@/components/sessions/HmsVideoPanel";
import { TherapeuticGoals } from "@/components/sessions/TherapeuticGoals";
import { SessionTasks } from "@/components/sessions/SessionTasks";
import { MentalExamDropdowns, type MentalExamData } from "@/components/sessions/MentalExamDropdowns";
import { searchCie11, type Cie11Entry } from "@/data/cie11_codes";

// ─── Constants ────────────────────────────────────────────────────────────────
const CUPS_OPTIONS = [
  { code: "890101", label: "890101 — Consulta de primera vez" },
  { code: "890102", label: "890102 — Consulta de control" },
  { code: "890403", label: "890403 — Psicoterapia individual adultos" },
  { code: "890404", label: "890404 — Psicoterapia individual niños/adolescentes" },
  { code: "890601", label: "890601 — Psicoterapia de pareja" },
  { code: "890701", label: "890701 — Psicoterapia familiar" },
];

const TIPO_DX_OPTIONS = [
  { value: "1", label: "1 — Impresión diagnóstica" },
  { value: "2", label: "2 — Confirmado nuevo" },
  { value: "3", label: "3 — Confirmado repetido" },
];

function toLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Field helpers ─────────────────────────────────────────────────────────────
const inputClass = "w-full rounded-md border px-3 py-2 text-[13px] focus:outline-none";
const inputStyle = (readOnly: boolean) => ({
  border: `1px solid var(--psy-line)`,
  background: readOnly ? "var(--psy-bg-soft)" : "var(--psy-surface)",
  color: "var(--psy-ink-1)",
  cursor: readOnly ? "default" : undefined,
});
const labelClass = "block text-[11px] font-semibold uppercase tracking-wide mb-1";
const labelStyle = { color: "var(--psy-ink-3)" };

// ─── Component ────────────────────────────────────────────────────────────────
export function SessionDocPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const autoStart = searchParams.get("autostart") === "1";

  const {
    data: sess,
    isLoading,
    isError,
  } = useQuery<SessionDetail>({
    queryKey: ["session", sessionId],
    queryFn: () => api.sessions.get(sessionId!),
    enabled: !!sessionId,
  });

  const [editOverride, setEditOverride] = useState(false);
  const readOnly = sess?.status === "signed" && !editOverride;

  // ── Clinical fields state ──────────────────────────────────────────────────
  const [form, setForm] = useState({
    actual_start: "",
    actual_end: "",
    diagnosis_cie11: "",
    diagnosis_description: "",
    cups_code: "890102",
    tipo_dx_principal: "1",
    is_emergency: false,
    consultation_reason: "",
    intervention: "",
    evolution: "",
    next_session_plan: "",
    session_fee: "0",
    authorization_number: "",
  });
  const [mentalExam, setMentalExam] = useState<MentalExamData>({});
  const [cie11Query, setCie11Query] = useState("");
  const [cie11Results, setCie11Results] = useState<Cie11Entry[]>([]);

  // ── Right panel state ──────────────────────────────────────────────────────
  const [patientSummary, setPatientSummary] = useState("");
  const [homework, setHomework] = useState("");

  // Sync state when session loads
  useEffect(() => {
    if (!sess) return;
    setForm({
      actual_start: toLocal(sess.actual_start),
      actual_end: toLocal(sess.actual_end),
      diagnosis_cie11: sess.diagnosis_cie11,
      diagnosis_description: sess.diagnosis_description,
      cups_code: sess.cups_code,
      tipo_dx_principal: sess.tipo_dx_principal,
      is_emergency: sess.is_emergency,
      consultation_reason: sess.consultation_reason,
      intervention: sess.intervention,
      evolution: sess.evolution ?? "",
      next_session_plan: sess.next_session_plan ?? "",
      session_fee: String(sess.session_fee),
      authorization_number: sess.authorization_number ?? "",
    });
    setMentalExam((sess.mental_exam as MentalExamData) ?? {});
    setCie11Query(`${sess.diagnosis_cie11} — ${sess.diagnosis_description}`);
    setPatientSummary(sess.patient_summary_text ?? "");
    setHomework(sess.homework_assigned ?? "");
  }, [sess?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cie11Query.length >= 2) setCie11Results(searchCie11(cie11Query).slice(0, 6));
    else setCie11Results([]);
  }, [cie11Query]);

  const set = (field: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  // ── Save draft ─────────────────────────────────────────────────────────────
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: SessionUpdatePayload = {
        actual_start: new Date(form.actual_start).toISOString(),
        actual_end: new Date(form.actual_end).toISOString(),
        diagnosis_cie11: form.diagnosis_cie11,
        diagnosis_description: form.diagnosis_description,
        cups_code: form.cups_code,
        tipo_dx_principal: form.tipo_dx_principal,
        is_emergency: form.is_emergency,
        consultation_reason: form.consultation_reason,
        intervention: form.intervention,
        evolution: form.evolution || undefined,
        next_session_plan: form.next_session_plan || undefined,
        homework_assigned: homework || undefined,
        patient_summary_text: patientSummary || undefined,
        session_fee: Number(form.session_fee),
        authorization_number: form.authorization_number || undefined,
        mental_exam: Object.values(mentalExam).some(Boolean)
          ? (mentalExam as Record<string, string>)
          : undefined,
      };
      return api.sessions.update(sessionId!, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session", sessionId] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
      setSaveError(null);
      navigate("/agenda");
    },
    onError: (err) => setSaveError(err instanceof ApiError ? err.message : "Error al guardar."),
  });

  // ── Send summary ───────────────────────────────────────────────────────────
  const [sendError, setSendError] = useState<string | null>(null);
  const sendSummaryMutation = useMutation({
    mutationFn: async () => {
      // Save patient_summary_text first, then send
      await api.sessions.update(sessionId!, { patient_summary_text: patientSummary });
      return api.sessions.sendPatientSummary(sessionId!);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session", sessionId] });
      setSendError(null);
    },
    onError: (err) => setSendError(err instanceof ApiError ? err.message : "Error al enviar."),
  });

  // ── Sign ───────────────────────────────────────────────────────────────────
  const [signConfirm, setSignConfirm] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const signMutation = useMutation({
    mutationFn: async () => {
      // Save pending changes first, then sign
      await saveMutation.mutateAsync();
      return api.sessions.sign(sessionId!);
    },
    onSuccess: (signed) => {
      qc.invalidateQueries({ queryKey: ["session", sessionId] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
      if (signed.appointment_id) {
        qc.invalidateQueries({ queryKey: ["appointment", String(signed.appointment_id)] });
        qc.invalidateQueries({ queryKey: ["appointments"] });
      }
      setSignConfirm(false);
      setSignError(null);
      navigate("/agenda");
    },
    onError: (err) => {
      setSignConfirm(false);
      setSignError(err instanceof ApiError ? err.message : "Error al firmar.");
    },
  });

  // ─── Loading / error states ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--psy-primary)" }} />
      </div>
    );
  }
  if (isError || !sess) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <AlertCircle size={24} style={{ color: "var(--psy-danger, #e74c3c)" }} />
        <span className="psy-mono text-[13px]" style={{ color: "var(--psy-ink-2)" }}>Sesión no encontrada.</span>
      </div>
    );
  }

  const summaryAlreadySent = !!sess.patient_summary_sent_at;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4" style={{ maxWidth: "1400px" }}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/sessions")}
          className="psy-mono text-[12px] flex items-center gap-1 transition-colors"
          style={{ color: "var(--psy-ink-3)" }}
        >
          <ArrowLeft size={14} />
          Sesiones
        </button>
        <span style={{ color: "var(--psy-line)" }}>|</span>
        <span className="psy-mono text-[13px] font-medium" style={{ color: "var(--psy-ink-2)" }}>
          {new Date(sess.actual_start).toLocaleDateString("es-CO", {
            weekday: "long", year: "numeric", month: "long", day: "numeric",
          })}
        </span>
        {readOnly && (
          <span
            className="psy-mono text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1"
            style={{ background: "var(--psy-sage-bg)", color: "var(--psy-sage)" }}
          >
            <Lock size={10} />
            Firmada
          </span>
        )}
        {sess?.status === "signed" && (
          <div className="ml-auto flex items-center gap-2">
            {!editOverride && (
              <button
                type="button"
                onClick={() => setEditOverride(true)}
                className="psy-mono text-[11px] px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors"
                style={{ background: "var(--psy-bg-soft)", color: "var(--psy-ink-2)", border: "1px solid var(--psy-line)" }}
              >
                <Pencil size={12} />
                Editar
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                const { blob, filename } = await api.sessions.downloadCertificate(sessionId!);
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = filename; a.click();
                URL.revokeObjectURL(url);
              }}
              className="psy-mono text-[11px] px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors"
              style={{ background: "var(--psy-bg-soft)", color: "var(--psy-primary)", border: "1px solid var(--psy-primary)" }}
            >
              <FileDown size={12} />
              Constancia PDF
            </button>
          </div>
        )}
      </div>

      {/* Two-panel layout */}
      <div className="grid gap-5 grid-cols-1 lg:grid-cols-[55%_1fr]">

        {/* ── LEFT PANEL — Historia clínica ── */}
        <div
          className="rounded-xl p-5 space-y-5 lg:overflow-y-auto"
          style={{
            background: "var(--psy-surface)",
            border: "1px solid var(--psy-line)",
            maxHeight: "calc(100vh - 140px)",
          }}
        >
          <h2 className="psy-mono text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--psy-ink-3)" }}>
            Historia clínica
          </h2>

          {/* Objetivos terapéuticos */}
          <TherapeuticGoals patientId={String(sess.patient_id)} readOnly={readOnly} />

          <hr style={{ borderColor: "var(--psy-line)" }} />

          {/* Tipo DX + Emergencia */}
          <div
            className="p-3 rounded-lg flex items-center justify-between gap-4"
            style={{ background: "var(--psy-bg-soft)", border: "1px solid var(--psy-line)" }}
          >
            <div className="flex-1">
              <label className={labelClass} style={labelStyle}>Tipo diagnóstico</label>
              <select
                className={inputClass}
                style={inputStyle(readOnly)}
                value={form.tipo_dx_principal}
                onChange={(e) => set("tipo_dx_principal", e.target.value)}
                disabled={readOnly}
              >
                {TIPO_DX_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-[13px] cursor-pointer mt-4" style={{ color: "var(--psy-ink-2)" }}>
              <input
                type="checkbox"
                checked={form.is_emergency}
                onChange={(e) => set("is_emergency", e.target.checked)}
                disabled={readOnly}
              />
              Urgencia
            </label>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={labelStyle}>Inicio</label>
              <input
                type="datetime-local" className={inputClass} style={inputStyle(readOnly)}
                value={form.actual_start} onChange={(e) => set("actual_start", e.target.value)}
                disabled={readOnly} required
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Fin</label>
              <input
                type="datetime-local" className={inputClass} style={inputStyle(readOnly)}
                value={form.actual_end} onChange={(e) => set("actual_end", e.target.value)}
                disabled={readOnly} required
              />
            </div>
          </div>

          {/* CIE-11 */}
          <div className="relative">
            <label className={labelClass} style={labelStyle}>Diagnóstico CIE-11</label>
            <input
              className={inputClass} style={inputStyle(readOnly)}
              value={cie11Query}
              onChange={(e) => { setCie11Query(e.target.value); set("diagnosis_cie11", e.target.value); }}
              placeholder="Buscar código CIE-11…"
              disabled={readOnly}
            />
            {!readOnly && cie11Results.length > 0 && (
              <ul
                className="absolute z-20 w-full mt-1 rounded-md shadow-lg overflow-hidden"
                style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
              >
                {cie11Results.map((entry) => (
                  <li
                    key={entry.code}
                    className="px-3 py-2 text-[12px] cursor-pointer hover:bg-[var(--psy-bg-soft)]"
                    style={{ color: "var(--psy-ink-1)" }}
                    onMouseDown={() => {
                      set("diagnosis_cie11", entry.code);
                      set("diagnosis_description", entry.description);
                      setCie11Query(`${entry.code} — ${entry.description}`);
                      setCie11Results([]);
                    }}
                  >
                    <span className="font-semibold psy-mono" style={{ color: "var(--psy-primary)" }}>{entry.code}</span>{" "}— {entry.description}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>Descripción diagnóstico</label>
            <input
              className={inputClass} style={inputStyle(readOnly)}
              value={form.diagnosis_description}
              onChange={(e) => set("diagnosis_description", e.target.value)}
              disabled={readOnly}
            />
          </div>

          {/* CUPS */}
          <div>
            <label className={labelClass} style={labelStyle}>Código CUPS</label>
            <select
              className={inputClass} style={inputStyle(readOnly)}
              value={form.cups_code} onChange={(e) => set("cups_code", e.target.value)}
              disabled={readOnly}
            >
              {CUPS_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
            </select>
          </div>

          {/* Motivo de consulta */}
          <div>
            <label className={labelClass} style={labelStyle}>Motivo de consulta</label>
            <textarea
              className={inputClass} style={inputStyle(readOnly)} rows={3}
              value={form.consultation_reason}
              onChange={(e) => set("consultation_reason", e.target.value)}
              disabled={readOnly}
            />
          </div>

          {/* Intervención */}
          <div>
            <label className={labelClass} style={labelStyle}>Intervención realizada</label>
            <textarea
              className={inputClass} style={inputStyle(readOnly)} rows={4}
              value={form.intervention}
              onChange={(e) => set("intervention", e.target.value)}
              disabled={readOnly}
            />
          </div>

          {/* Evolución */}
          <div>
            <label className={labelClass} style={labelStyle}>Evolución</label>
            <textarea
              className={inputClass} style={inputStyle(readOnly)} rows={3}
              value={form.evolution}
              onChange={(e) => set("evolution", e.target.value)}
              disabled={readOnly}
            />
          </div>

          {/* Plan próxima sesión */}
          <div>
            <label className={labelClass} style={labelStyle}>Plan próxima sesión</label>
            <textarea
              className={inputClass} style={inputStyle(readOnly)} rows={3}
              value={form.next_session_plan}
              onChange={(e) => set("next_session_plan", e.target.value)}
              disabled={readOnly}
            />
          </div>

          {/* Examen mental */}
          <div style={readOnly ? { pointerEvents: "none", opacity: 0.7 } : undefined}>
            <MentalExamDropdowns value={mentalExam} onChange={setMentalExam} />
          </div>

          {/* Valor + Autorización */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={labelStyle}>Valor sesión (COP)</label>
              <input
                type="number" className={inputClass} style={inputStyle(readOnly)}
                value={form.session_fee}
                onChange={(e) => set("session_fee", e.target.value)}
                min={0} disabled={readOnly}
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>N° autorización</label>
              <input
                className={inputClass} style={inputStyle(readOnly)}
                value={form.authorization_number}
                onChange={(e) => set("authorization_number", e.target.value)}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* Save button */}
          {!readOnly && (
            <div className="pt-1">
              {saveError && <p className="psy-mono text-[12px] mb-2" style={{ color: "var(--psy-danger, #e74c3c)" }}>{saveError}</p>}
              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="w-full py-2.5 rounded-lg psy-mono text-[13px] font-semibold transition-opacity disabled:opacity-60"
                style={{ background: "var(--psy-primary)", color: "#fff" }}
              >
                {saveMutation.isPending ? "Guardando…" : "Guardar borrador"}
              </button>
              {saveMutation.isSuccess && (
                <p className="psy-mono text-[11px] mt-1 text-center" style={{ color: "var(--psy-sage)" }}>
                  Guardado correctamente
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL — Video + Resumen + Tareas ── */}
        <div className="flex flex-col gap-4 lg:overflow-y-auto" style={{ maxHeight: "calc(100vh - 140px)" }}>

          {/* Video call */}
          <HmsVideoPanel appointmentId={sess.appointment_id ? String(sess.appointment_id) : null} autoStart={autoStart} />

          {/* Resumen para el paciente */}
          <div
            className="rounded-xl p-4 space-y-3"
            style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
          >
            <div className="flex items-center justify-between">
              <label className={labelClass} style={labelStyle}>Resumen para el paciente</label>
              {summaryAlreadySent && (
                <span className="psy-mono text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--psy-sage-bg)", color: "var(--psy-sage)" }}>
                  Enviado
                </span>
              )}
            </div>
            <textarea
              className={`${inputClass} resize-none`}
              style={inputStyle(readOnly || summaryAlreadySent)}
              rows={6}
              value={patientSummary}
              onChange={(e) => setPatientSummary(e.target.value)}
              disabled={readOnly || summaryAlreadySent}
              placeholder="Escribe un resumen de la sesión para enviar al paciente antes de firmar…"
            />
            {!readOnly && !summaryAlreadySent && (
              <div>
                {sendError && <p className="psy-mono text-[11px] mb-1" style={{ color: "var(--psy-danger, #e74c3c)" }}>{sendError}</p>}
                <button
                  type="button"
                  onClick={() => sendSummaryMutation.mutate()}
                  disabled={sendSummaryMutation.isPending || patientSummary.trim().length < 10}
                  className="w-full py-2 rounded-lg psy-mono text-[12px] font-medium flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
                  style={{ background: "var(--psy-bg-soft)", color: "var(--psy-primary)", border: "1px solid var(--psy-primary)" }}
                >
                  <Send size={13} />
                  {sendSummaryMutation.isPending ? "Enviando…" : "Enviar resumen al paciente"}
                </button>
              </div>
            )}
            {summaryAlreadySent && sess.patient_summary_sent_at && (
              <p className="psy-mono text-[11px]" style={{ color: "var(--psy-ink-3)" }}>
                Enviado el {new Date(sess.patient_summary_sent_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
              </p>
            )}
          </div>

          {/* Tareas estructuradas */}
          <SessionTasks
            sessionId={sessionId!}
            patientId={String(sess.patient_id)}
            readOnly={readOnly}
          />
        </div>
      </div>

      {/* Firmar sesión — sección full-width al final */}
      {!readOnly && (
        <div
          className="rounded-xl p-4"
          style={{ background: "var(--psy-bg-soft)", border: "1px solid var(--psy-warn, #f39c12)" }}
        >
          <div className="flex items-center justify-between gap-6 flex-wrap">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <Lock size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--psy-warn, #f39c12)" }} />
              <p className="psy-mono text-[11px] leading-relaxed" style={{ color: "var(--psy-ink-2)" }}>
                Al firmar la sesión, todos los campos quedan <strong>inmutables</strong> según la Resolución 1995/1999.
                Asegúrate de enviar el resumen al paciente antes de firmar.
              </p>
            </div>

            {!signConfirm ? (
              <button
                type="button"
                onClick={() => setSignConfirm(true)}
                className="py-2.5 px-6 rounded-lg psy-mono text-[13px] font-semibold flex items-center gap-2 transition-opacity flex-shrink-0"
                style={{ background: "var(--psy-primary)", color: "#fff" }}
              >
                <PenLine size={14} />
                Firmar sesión
              </button>
            ) : (
              <div className="flex items-center gap-3 flex-shrink-0">
                {signError && <p className="psy-mono text-[11px]" style={{ color: "var(--psy-danger, #e74c3c)" }}>{signError}</p>}
                <p className="psy-mono text-[12px] font-semibold" style={{ color: "var(--psy-ink-1)" }}>
                  ¿Confirmar? Esta acción no se puede deshacer.
                </p>
                <button
                  type="button"
                  onClick={() => signMutation.mutate()}
                  disabled={signMutation.isPending}
                  className="py-2 px-5 rounded-lg psy-mono text-[12px] font-semibold disabled:opacity-60 transition-opacity"
                  style={{ background: "var(--psy-primary)", color: "#fff" }}
                >
                  {signMutation.isPending ? "Firmando…" : "Sí, firmar"}
                </button>
                <button
                  type="button"
                  onClick={() => setSignConfirm(false)}
                  className="py-2 px-4 rounded-lg psy-mono text-[12px] transition-colors"
                  style={{ background: "var(--psy-surface)", color: "var(--psy-ink-2)", border: "1px solid var(--psy-line)" }}
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
