import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type SessionDetail, type SessionUpdatePayload, ApiError } from "@/lib/api";
import { MentalExamDropdowns, type MentalExamData } from "./MentalExamDropdowns";
import { searchCie11, type Cie11Entry } from "@/data/cie11_codes";

const CUPS_OPTIONS = [
  { code: "890101", label: "890101 — Consulta de primera vez psicología" },
  { code: "890102", label: "890102 — Consulta de control psicología" },
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

function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  sess: SessionDetail;
  onCancel: () => void;
  onSaved: () => void;
}

export function SessionEditForm({ sess, onCancel, onSaved }: Props) {
  const qc = useQueryClient();

  const [form, setForm] = useState({
    actual_start: toLocalDatetimeValue(sess.actual_start),
    actual_end: toLocalDatetimeValue(sess.actual_end),
    diagnosis_cie11: sess.diagnosis_cie11,
    diagnosis_description: sess.diagnosis_description,
    cups_code: sess.cups_code,
    tipo_dx_principal: sess.tipo_dx_principal,
    is_emergency: sess.is_emergency,
    consultation_reason: sess.consultation_reason,
    intervention: sess.intervention,
    evolution: sess.evolution ?? "",
    next_session_plan: sess.next_session_plan ?? "",
    homework_assigned: sess.homework_assigned ?? "",
    session_fee: String(sess.session_fee),
    authorization_number: sess.authorization_number ?? "",
  });

  const [mentalExam, setMentalExam] = useState<MentalExamData>(
    (sess.mental_exam as MentalExamData) ?? {}
  );
  const [cie11Query, setCie11Query] = useState(sess.diagnosis_cie11);
  const [cie11Results, setCie11Results] = useState<Cie11Entry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cie11Query.length >= 2) {
      setCie11Results(searchCie11(cie11Query).slice(0, 6));
    } else {
      setCie11Results([]);
    }
  }, [cie11Query]);

  const set = (field: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  const mutation = useMutation({
    mutationFn: (payload: SessionUpdatePayload) => api.sessions.update(sess.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session", sess.id] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
      onSaved();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Error al guardar.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
      homework_assigned: form.homework_assigned || undefined,
      session_fee: Number(form.session_fee),
      authorization_number: form.authorization_number || undefined,
      mental_exam: Object.values(mentalExam).some(Boolean) ? (mentalExam as Record<string, string>) : undefined,
    };
    mutation.mutate(payload);
  };

  const inputClass = "w-full rounded-md border px-3 py-2 text-[13px]";
  const style = { border: "1px solid var(--psy-line)", background: "var(--psy-surface)", color: "var(--psy-ink-1)" };
  const labelClass = "block text-[11px] font-semibold uppercase tracking-wide mb-1";
  const labelStyle = { color: "var(--psy-ink-3)" };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Tipo DX + Is Emergency */}
      <div
        className="p-3 rounded-lg flex items-center justify-between gap-4"
        style={{ background: "var(--psy-sage-bg)", border: "1px solid var(--psy-sage-soft)" }}
      >
        <div className="flex-1">
          <label className={labelClass} style={labelStyle}>Tipo de diagnóstico principal</label>
          <select
            className={inputClass}
            style={style}
            value={form.tipo_dx_principal}
            onChange={(e) => set("tipo_dx_principal", e.target.value)}
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
          />
          Urgencia / emergencia
        </label>
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} style={labelStyle}>Inicio</label>
          <input type="datetime-local" className={inputClass} style={style} value={form.actual_start} onChange={(e) => set("actual_start", e.target.value)} required />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Fin</label>
          <input type="datetime-local" className={inputClass} style={style} value={form.actual_end} onChange={(e) => set("actual_end", e.target.value)} required />
        </div>
      </div>

      {/* CIE-11 */}
      <div className="relative">
        <label className={labelClass} style={labelStyle}>Diagnóstico CIE-11</label>
        <input
          className={inputClass}
          style={style}
          value={cie11Query}
          onChange={(e) => {
            setCie11Query(e.target.value);
            set("diagnosis_cie11", e.target.value);
          }}
          placeholder="Buscar código CIE-11…"
          required
        />
        {cie11Results.length > 0 && (
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
                <span className="font-semibold psy-mono" style={{ color: "var(--psy-primary)" }}>{entry.code}</span>
                {" "}— {entry.description}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Descripción diagnóstico</label>
        <input className={inputClass} style={style} value={form.diagnosis_description} onChange={(e) => set("diagnosis_description", e.target.value)} required />
      </div>

      {/* CUPS */}
      <div>
        <label className={labelClass} style={labelStyle}>Código CUPS</label>
        <select className={inputClass} style={style} value={form.cups_code} onChange={(e) => set("cups_code", e.target.value)} required>
          {CUPS_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
        </select>
      </div>

      {/* Motivo */}
      <div>
        <label className={labelClass} style={labelStyle}>Motivo de consulta</label>
        <textarea className={inputClass} style={style} rows={3} value={form.consultation_reason} onChange={(e) => set("consultation_reason", e.target.value)} required minLength={10} />
      </div>

      {/* Intervención */}
      <div>
        <label className={labelClass} style={labelStyle}>Intervención realizada</label>
        <textarea className={inputClass} style={style} rows={4} value={form.intervention} onChange={(e) => set("intervention", e.target.value)} required minLength={10} />
      </div>

      {/* Evolución */}
      <div>
        <label className={labelClass} style={labelStyle}>Evolución</label>
        <textarea className={inputClass} style={style} rows={3} value={form.evolution} onChange={(e) => set("evolution", e.target.value)} />
      </div>

      {/* Plan + Tareas */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} style={labelStyle}>Plan próxima sesión</label>
          <textarea className={inputClass} style={style} rows={3} value={form.next_session_plan} onChange={(e) => set("next_session_plan", e.target.value)} />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Tareas asignadas al paciente</label>
          <textarea className={inputClass} style={style} rows={3} value={form.homework_assigned} onChange={(e) => set("homework_assigned", e.target.value)} />
        </div>
      </div>

      {/* Examen mental */}
      <MentalExamDropdowns value={mentalExam} onChange={setMentalExam} />

      {/* Valor + Autorización */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} style={labelStyle}>Valor sesión (COP)</label>
          <input type="number" className={inputClass} style={style} value={form.session_fee} onChange={(e) => set("session_fee", e.target.value)} min={0} required />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>N° autorización</label>
          <input className={inputClass} style={style} value={form.authorization_number} onChange={(e) => set("authorization_number", e.target.value)} />
        </div>
      </div>

      {error && <p className="text-[13px]" style={{ color: "var(--psy-danger)" }}>{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex-1 py-2 rounded-md text-[13px] font-semibold transition-colors"
          style={{ background: "var(--psy-primary)", color: "#fff" }}
        >
          {mutation.isPending ? "Guardando…" : "Guardar cambios"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-md text-[13px] transition-colors hover:bg-[var(--psy-bg-soft)]"
          style={{ border: "1px solid var(--psy-line)", color: "var(--psy-ink-2)" }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
