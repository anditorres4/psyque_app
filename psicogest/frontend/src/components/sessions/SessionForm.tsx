import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { PatientSummary, SessionCreatePayload } from "@/lib/api";
import { searchCie11, type Cie11Entry } from "@/data/cie11_codes";
import { useAiFeatures } from "@/hooks/useAiFeatures";
import { AiSessionSummarySection } from "@/components/patients/AiSessionSummarySection";
import { MentalExamDropdowns, type MentalExamData } from "./MentalExamDropdowns";

interface Props {
  defaultAppointmentId?: string;
  defaultPatientId?: string;
  defaultStart?: string;
  defaultEnd?: string;
  onSubmit: (payload: SessionCreatePayload) => void;
  isSubmitting: boolean;
  error?: string | null;
}

const CUPS_OPTIONS = [
  { code: "890101", label: "890101 — Consulta de primera vez psicología" },
  { code: "890102", label: "890102 — Consulta de control psicología" },
  { code: "890403", label: "890403 — Psicoterapia individual adultos" },
  { code: "890404", label: "890404 — Psicoterapia individual niños/adolescentes" },
  { code: "890601", label: "890601 — Psicoterapia de pareja" },
  { code: "890701", label: "890701 — Psicoterapia familiar" },
];

function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ── Patient picker ────────────────────────────────────────────────────────────

function PatientPicker({
  selected,
  onSelect,
  onClear,
}: {
  selected: PatientSummary | null;
  onSelect: (p: PatientSummary) => void;
  onClear: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const debouncedQuery = useDebounce(searchQuery, 300);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: searchResults, isFetching } = useQuery({
    queryKey: ["patient-search-session", debouncedQuery],
    queryFn: () => api.patients.list({ search: debouncedQuery, page_size: 6 }),
    enabled: debouncedQuery.length >= 2 && !selected,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (selected) {
    const surnames = [selected.first_surname, selected.second_surname].filter(Boolean).join(" ");
    return (
      <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-slate-50 text-sm">
        <span className="flex-1 truncate">{surnames}, {selected.first_name} — {selected.doc_type} {selected.doc_number}</span>
        <button type="button" className="text-muted-foreground hover:text-foreground shrink-0" onClick={onClear} aria-label="Cambiar paciente">✕</button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={searchQuery}
        onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
        onFocus={() => setShowResults(true)}
        placeholder="Buscar por nombre, apellido o documento..."
        autoComplete="off"
        required
      />
      {showResults && debouncedQuery.length >= 2 && (
        <div className="absolute z-10 top-full mt-1 w-full bg-white border rounded-md shadow-lg max-h-52 overflow-y-auto">
          {isFetching && <p className="text-xs text-muted-foreground p-3">Buscando...</p>}
          {!isFetching && searchResults?.items.length === 0 && (
            <p className="text-xs text-muted-foreground p-3">Sin resultados para "{debouncedQuery}"</p>
          )}
          {searchResults?.items.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 border-b last:border-b-0"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelect(p); setSearchQuery(""); setShowResults(false); }}
            >
              <span className="font-medium">{[p.first_surname, p.second_surname].filter(Boolean).join(" ")}, {p.first_name}</span>
              <span className="text-muted-foreground ml-2 text-xs">{p.doc_type} {p.doc_number}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── CIE-11 bidirectional autocomplete ────────────────────────────────────────

function Cie11Autocomplete({
  label,
  searchKey,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  searchKey: "code" | "description";
  value: string;
  onChange: (entry: Cie11Entry) => void;
  placeholder: string;
  required?: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Cie11Entry[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = (v: string) => {
    setQuery(v);
    const hits = searchCie11(v);
    setResults(hits);
    setShowDropdown(hits.length > 0);
  };

  const handleSelect = (entry: Cie11Entry) => {
    setQuery(searchKey === "code" ? entry.code : entry.description);
    setShowDropdown(false);
    onChange(entry);
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium mb-1">
        {label} {required && <span style={{ color: "var(--psy-danger)" }}>*</span>}
      </label>
      <Input
        value={query}
        onChange={(e) => handleChange(searchKey === "code" ? e.target.value.toUpperCase() : e.target.value)}
        onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
      />
      {showDropdown && (
        <div className="absolute z-10 top-full mt-1 w-full rounded-[var(--radius)] shadow-lg max-h-52 overflow-y-auto" style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}>
          {results.map((entry) => (
            <button
              key={entry.code}
              type="button"
              className="w-full text-left px-3 py-2 text-sm transition-colors"
              style={{ borderBottom: "1px solid var(--psy-line)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--psy-bg-soft)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(entry)}
            >
              <span className="font-mono font-medium" style={{ color: "var(--psy-primary)" }}>{entry.code}</span>
              <span className="ml-2" style={{ color: "var(--psy-ink-3)" }}>{entry.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

export function SessionForm({
  defaultAppointmentId,
  defaultPatientId,
  defaultStart,
  defaultEnd,
  onSubmit,
  isSubmitting,
  error,
}: Props) {
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | null>(null);
  const [patientError, setPatientError] = useState<string | null>(null);

  const [tipoDxPrincipal, setTipoDxPrincipal] = useState("1");
  const [isEmergency, setIsEmergency] = useState(false);
  const [cie11Code, setCie11Code] = useState("");
  const [cie11Desc, setCie11Desc] = useState("");
  const [cupsCode, setCupsCode] = useState("890403");
  const [reason, setReason] = useState("");
  const [intervention, setIntervention] = useState("");
  const [evolution, setEvolution] = useState("");
  const [nextPlan, setNextPlan] = useState("");
  const [homeworkAssigned, setHomeworkAssigned] = useState("");
  const [fee, setFee] = useState("150000");
  const [authNumber, setAuthNumber] = useState("");
  const [mentalExam, setMentalExam] = useState<MentalExamData>({});
  const [actualStart, setActualStart] = useState(
    defaultStart ? toLocalDatetimeValue(defaultStart) : ""
  );
  const [actualEnd, setActualEnd] = useState(
    defaultEnd ? toLocalDatetimeValue(defaultEnd) : ""
  );

  const resolvedPatientId = selectedPatient?.id ?? defaultPatientId ?? "";
  const { canSummarize } = useAiFeatures();

  // ── Auto-carry: pre-fill context from previous sessions ──────────────────
  const { data: sessionCtx } = useQuery({
    queryKey: ["session-context", resolvedPatientId],
    queryFn: () => api.sessions.context(resolvedPatientId),
    enabled: !!resolvedPatientId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!sessionCtx) return;
    // Auto-fill consultation reason from first session (unless emergency)
    if (sessionCtx.consultation_reason && !sessionCtx.is_first_session && !isEmergency) {
      setReason(sessionCtx.consultation_reason);
    }
    // Auto-fill mental exam from last session
    if (sessionCtx.last_mental_exam) {
      setMentalExam(sessionCtx.last_mental_exam as MentalExamData);
    }
    // First session → default to "Impresión diagnóstica"
    if (sessionCtx.is_first_session) {
      setTipoDxPrincipal("1");
    }
  }, [sessionCtx, isEmergency]);

  const handleCie11Select = (entry: Cie11Entry) => {
    setCie11Code(entry.code);
    setCie11Desc(entry.description);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedPatientId) {
      setPatientError("Selecciona un paciente");
      return;
    }
    setPatientError(null);
    onSubmit({
      appointment_id: defaultAppointmentId || undefined,
      patient_id: resolvedPatientId,
      actual_start: new Date(actualStart).toISOString(),
      actual_end: new Date(actualEnd).toISOString(),
      diagnosis_cie11: cie11Code,
      diagnosis_description: cie11Desc,
      cups_code: cupsCode,
      consultation_reason: reason,
      intervention,
      evolution: evolution || undefined,
      next_session_plan: nextPlan || undefined,
      homework_assigned: homeworkAssigned || undefined,
      session_fee: parseInt(fee, 10),
      authorization_number: authNumber || undefined,
      tipo_dx_principal: tipoDxPrincipal,
      mental_exam: Object.keys(mentalExam).length > 0 ? mentalExam as Record<string, string> : undefined,
      is_emergency: isEmergency,
    });
  };

  const isFollowUp = sessionCtx && !sessionCtx.is_first_session;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-md p-3 text-sm" role="alert" style={{ background: "color-mix(in srgb, var(--psy-danger) 8%, var(--psy-surface))", color: "var(--psy-danger)" }}>
          {error}
        </div>
      )}

      {/* Patient picker */}
      {!defaultPatientId && (
        <div>
          <label className="block text-sm font-medium mb-1">
            Paciente <span style={{ color: "var(--psy-danger)" }}>*</span>
          </label>
          <PatientPicker
            selected={selectedPatient}
            onSelect={(p) => { setSelectedPatient(p); setPatientError(null); }}
            onClear={() => setSelectedPatient(null)}
          />
          {patientError && <p className="mt-1 text-xs text-xs" style={{ color: "var(--psy-danger)" }}>{patientError}</p>}
        </div>
      )}

      {/* ── Tipo de diagnóstico — al inicio para primera sesión ── */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
        <div>
          <label className="block text-sm font-semibold mb-1">
            Tipo de diagnóstico principal <span style={{ color: "var(--psy-danger)" }}>*</span>
          </label>
          <select
            className="h-10 w-full rounded-md border border-input px-3 text-sm bg-white"
            value={tipoDxPrincipal}
            onChange={(e) => setTipoDxPrincipal(e.target.value)}
          >
            <option value="1">1 — Impresión diagnóstica</option>
            <option value="2">2 — Diagnóstico confirmado</option>
            <option value="3">3 — Diagnóstico descartado</option>
          </select>
          {sessionCtx?.is_first_session && (
            <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
              <Info size={12} /> Primera sesión: se recomienda "Impresión diagnóstica" para cumplimiento ético en RIPS.
            </p>
          )}
        </div>

        {isFollowUp && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_emergency"
              checked={isEmergency}
              onChange={(e) => {
                setIsEmergency(e.target.checked);
                if (e.target.checked) setReason("");
              }}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="is_emergency" className="text-sm flex items-center gap-1 text-amber-700 cursor-pointer">
              <AlertTriangle size={14} /> Sesión de emergencia (requiere nuevo motivo de consulta)
            </label>
          </div>
        )}
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Inicio real</label>
          <Input type="datetime-local" value={actualStart} onChange={(e) => setActualStart(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Fin real</label>
          <Input type="datetime-local" value={actualEnd} onChange={(e) => setActualEnd(e.target.value)} required />
        </div>
      </div>

      {/* CIE-11 */}
      <div className="grid grid-cols-2 gap-3">
        <Cie11Autocomplete
          label="Código CIE-11"
          searchKey="code"
          value={cie11Code}
          onChange={handleCie11Select}
          placeholder="Ej: 6A70"
          required
        />
        <div>
          <label className="block text-sm font-medium mb-1">
            Código CUPS <span style={{ color: "var(--psy-danger)" }}>*</span>
          </label>
          <select
            className="h-10 w-full rounded-md border border-input px-3 text-sm"
            value={cupsCode}
            onChange={(e) => setCupsCode(e.target.value)}
          >
            {CUPS_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <Cie11Autocomplete
        label="Descripción del diagnóstico"
        searchKey="description"
        value={cie11Desc}
        onChange={handleCie11Select}
        placeholder="Buscar diagnóstico por nombre..."
        required
      />

      {/* Motivo de consulta */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Motivo de consulta <span style={{ color: "var(--psy-danger)" }}>*</span>
          {isFollowUp && !isEmergency && (
            <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full" style={{ color: "var(--psy-info)", background: "color-mix(in srgb, var(--psy-info) 10%, var(--psy-surface))" }}>
              Auto-cargado de primera sesión
            </span>
          )}
        </label>
        <textarea
          className="w-full rounded-md border border-input px-3 py-2 text-sm min-h-[80px]"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          minLength={10}
          placeholder={isEmergency ? "Describe el motivo de emergencia..." : "Descripción del motivo de la consulta..."}
        />
      </div>

      {/* ── Examen Mental — visible y colapsable ── */}
      <MentalExamDropdowns
        value={mentalExam}
        onChange={setMentalExam}
        collapsed={false}
      />

      {/* Intervención */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Intervención realizada <span style={{ color: "var(--psy-danger)" }}>*</span>
        </label>
        <textarea
          className="w-full rounded-md border border-input px-3 py-2 text-sm min-h-[80px]"
          value={intervention}
          onChange={(e) => setIntervention(e.target.value)}
          required
          minLength={10}
          placeholder="Técnicas y procedimientos aplicados..."
        />
      </div>

      {/* Evolución */}
      <div>
        <label className="block text-sm font-medium mb-1">Evolución (opcional)</label>
        <textarea
          className="w-full rounded-md border border-input px-3 py-2 text-sm min-h-[60px]"
          value={evolution}
          onChange={(e) => setEvolution(e.target.value)}
          placeholder="Observaciones sobre el progreso del paciente..."
        />
      </div>

      {/* Plan próxima sesión + Tareas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Plan próxima sesión (opcional)</label>
          <textarea
            className="w-full rounded-md border border-input px-3 py-2 text-sm min-h-[80px]"
            value={nextPlan}
            onChange={(e) => setNextPlan(e.target.value)}
            placeholder="Objetivos y enfoque de la próxima sesión..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Tareas asignadas al paciente (opcional)
          </label>
          <textarea
            className="w-full rounded-md border border-input px-3 py-2 text-sm min-h-[80px]"
            value={homeworkAssigned}
            onChange={(e) => setHomeworkAssigned(e.target.value)}
            placeholder="Actividades y tareas para realizar entre sesiones..."
          />
        </div>
      </div>

      {/* Valor + autorización */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">
            Valor sesión (COP) <span style={{ color: "var(--psy-danger)" }}>*</span>
          </label>
          <Input
            type="number"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            required
            min={0}
            placeholder="150000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">N° autorización (opcional)</label>
          <Input
            value={authNumber}
            onChange={(e) => setAuthNumber(e.target.value)}
            placeholder="Para pacientes EPS"
            maxLength={30}
          />
        </div>
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          className="bg-[var(--psy-primary)] hover:bg-[var(--psy-primary-soft)] w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Guardando borrador..." : "Guardar borrador"}
        </Button>
      </div>

      {/* ── Psyque IA · Resumen (post-guardado) ── */}
      <div
        className="rounded-lg p-5 mt-4"
        style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
      >
        <AiSessionSummarySection
          sessionId={null}
          canSummarize={canSummarize}
          intervention={intervention}
          evolution={evolution}
        />
      </div>
    </form>
  );
}
