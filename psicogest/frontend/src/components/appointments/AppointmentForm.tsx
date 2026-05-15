import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type {
  AppointmentCreatePayload,
  AppointmentSeriesCreate,
  Modality,
  PatientSummary,
  SessionType,
} from "@/lib/api";
import { Repeat, CalendarDays } from "lucide-react";

interface Props {
  defaultDate?: Date;
  defaultPatientId?: string;
  onSubmit: (payload: AppointmentCreatePayload) => void;
  isSubmitting: boolean;
  error?: string | null;
}

const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  individual: "Individual",
  couple: "Pareja",
  family: "Familia",
  followup: "Seguimiento",
};

const MODALITY_LABELS: Record<Modality, string> = {
  presential: "Presencial",
  virtual: "Virtual",
};

const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function toLocalDatetimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toISOWithOffset(localValue: string): string {
  return new Date(localValue).toISOString();
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function patientLabel(p: PatientSummary): string {
  const surnames = [p.first_surname, p.second_surname].filter(Boolean).join(" ");
  return `${surnames}, ${p.first_name} — ${p.doc_type} ${p.doc_number}`;
}

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function AppointmentForm({ defaultDate, defaultPatientId, onSubmit, isSubmitting, error }: Props) {
  const qc = useQueryClient();
  const now = defaultDate ?? new Date();
  const endDefault = new Date(now.getTime() + 50 * 60 * 1000);

  const [mode, setMode] = useState<"single" | "recurring">("single");

  // ── Single appointment state ──────────────────────────────────────────────
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [patientError, setPatientError] = useState<string | null>(null);
  const debouncedQuery = useDebounce(searchQuery, 300);
  const containerRef = useRef<HTMLDivElement>(null);

  const [start, setStart] = useState(toLocalDatetimeValue(now));
  const [end, setEnd] = useState(toLocalDatetimeValue(endDefault));
  const [sessionType, setSessionType] = useState<SessionType>("individual");
  const [modality, setModality] = useState<Modality>("presential");
  const [notes, setNotes] = useState("");

  // ── Recurring series state ────────────────────────────────────────────────
  const [seriesPatient, setSeriesPatient] = useState<PatientSummary | null>(null);
  const [seriesSearch, setSeriesSearch] = useState("");
  const [seriesShowResults, setSeriesShowResults] = useState(false);
  const [seriesPatientError, setSeriesPatientError] = useState<string | null>(null);
  const debouncedSeriesSearch = useDebounce(seriesSearch, 300);
  const seriesContainerRef = useRef<HTMLDivElement>(null);

  const [dayOfWeek, setDayOfWeek] = useState(now.getDay() === 0 ? 6 : now.getDay() - 1);
  const [timeHour, setTimeHour] = useState(now.getHours());
  const [timeMinute, setTimeMinute] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(50);
  const [seriesSessionType, setSeriesSessionType] = useState<SessionType>("individual");
  const [seriesModality, setSeriesModality] = useState<Modality>("presential");
  const [nRepetitions, setNRepetitions] = useState(8);
  const [firstDate, setFirstDate] = useState(todayISO());
  const [seriesNotes, setSeriesNotes] = useState("");
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [seriesSuccess, setSeriesSuccess] = useState<string | null>(null);

  const { data: searchResults, isFetching } = useQuery({
    queryKey: ["patient-search-appt", debouncedQuery],
    queryFn: () => api.patients.list({ search: debouncedQuery, page_size: 6 }),
    enabled: debouncedQuery.length >= 2 && !selectedPatient && !defaultPatientId && mode === "single",
  });

  const { data: seriesSearchResults, isFetching: isFetchingSeries } = useQuery({
    queryKey: ["patient-search-series", debouncedSeriesSearch],
    queryFn: () => api.patients.list({ search: debouncedSeriesSearch, page_size: 6 }),
    enabled: debouncedSeriesSearch.length >= 2 && !seriesPatient && !defaultPatientId && mode === "recurring",
  });

  const seriesMutation = useMutation({
    mutationFn: (body: AppointmentSeriesCreate) => api.appointments.createSeries(body),
    onSuccess: (res) => {
      setSeriesSuccess(
        `Serie creada: ${res.appointments_created} de ${nRepetitions} citas agendadas.`
      );
      setSeriesError(null);
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (err: Error) => {
      setSeriesError(err.message);
      setSeriesSuccess(null);
    },
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setShowResults(false);
      if (seriesContainerRef.current && !seriesContainerRef.current.contains(e.target as Node))
        setSeriesShowResults(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const patientId = selectedPatient?.id ?? defaultPatientId ?? "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) { setPatientError("Selecciona un paciente"); return; }
    setPatientError(null);
    onSubmit({
      patient_id: patientId,
      scheduled_start: toISOWithOffset(start),
      scheduled_end: toISOWithOffset(end),
      session_type: sessionType,
      modality,
      notes: notes || undefined,
    });
  };

  const handleSubmitSeries = (e: React.FormEvent) => {
    e.preventDefault();
    const pid = seriesPatient?.id ?? defaultPatientId ?? "";
    if (!pid) { setSeriesPatientError("Selecciona un paciente"); return; }
    setSeriesPatientError(null);
    seriesMutation.mutate({
      patient_id: pid,
      day_of_week: dayOfWeek,
      time_hour: timeHour,
      time_minute: timeMinute,
      duration_minutes: durationMinutes,
      session_type: seriesSessionType,
      modality: seriesModality,
      n_repetitions: nRepetitions,
      first_date: firstDate,
      notes: seriesNotes || undefined,
    });
  };

  // ── Patient search helpers ────────────────────────────────────────────────
  function PatientPicker({
    selected, onSelect, onClear, query, setQuery, showRes, setShowRes,
    results, fetching, ref: pRef, error: pErr,
  }: {
    selected: PatientSummary | null;
    onSelect: (p: PatientSummary) => void;
    onClear: () => void;
    query: string; setQuery: (v: string) => void;
    showRes: boolean; setShowRes: (v: boolean) => void;
    results: PatientSummary[] | undefined; fetching: boolean;
    ref: React.RefObject<HTMLDivElement>;
    error: string | null;
  }) {
    return (
      <div>
        <label className="block text-sm font-medium mb-1">Paciente</label>
        {defaultPatientId ? (
          <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted text-sm text-muted-foreground">
            Paciente preseleccionado
          </div>
        ) : selected ? (
          <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-slate-50 text-sm">
            <span className="flex-1 truncate">{patientLabel(selected)}</span>
            <button type="button" className="text-muted-foreground hover:text-foreground shrink-0" onClick={onClear}>✕</button>
          </div>
        ) : (
          <div ref={pRef} className="relative">
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowRes(true); }}
              onFocus={() => setShowRes(true)}
              placeholder="Buscar por nombre, apellido o documento..."
              autoComplete="off"
            />
            {showRes && query.length >= 2 && (
              <div className="absolute z-10 top-full mt-1 w-full bg-white border rounded-md shadow-lg max-h-52 overflow-y-auto">
                {fetching && <p className="text-xs text-muted-foreground p-3">Buscando...</p>}
                {!fetching && results?.length === 0 && <p className="text-xs text-muted-foreground p-3">Sin resultados para "{query}"</p>}
                {results?.map((p) => (
                  <button key={p.id} type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 border-b last:border-b-0"
                    onMouseDown={(e) => e.preventDefault()} onClick={() => onSelect(p)}>
                    <span className="font-medium">{[p.first_surname, p.second_surname].filter(Boolean).join(" ")}, {p.first_name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">{p.doc_type} {p.doc_number}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {pErr && <p className="mt-1 text-xs" style={{ color: "var(--psy-danger)" }}>{pErr}</p>}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex rounded-lg border border-input overflow-hidden text-sm">
        <button
          type="button"
          onClick={() => setMode("single")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 transition-colors ${
            mode === "single" ? "bg-[var(--psy-primary)] text-white font-semibold" : "bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <CalendarDays size={15} />
          Cita única
        </button>
        <button
          type="button"
          onClick={() => setMode("recurring")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 transition-colors ${
            mode === "recurring" ? "bg-[var(--psy-primary)] text-white font-semibold" : "bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Repeat size={15} />
          Cita recurrente
        </button>
      </div>

      {/* ── Single appointment ── */}
      {mode === "single" && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md p-3 text-sm" role="alert" style={{ background: "color-mix(in srgb, var(--psy-danger) 8%, var(--psy-surface))", color: "var(--psy-danger)" }}>
              {error}
            </div>
          )}

          <PatientPicker
            selected={selectedPatient} onSelect={(p) => { setSelectedPatient(p); setSearchQuery(""); setShowResults(false); setPatientError(null); }}
            onClear={() => { setSelectedPatient(null); setSearchQuery(""); }}
            query={searchQuery} setQuery={setSearchQuery}
            showRes={showResults} setShowRes={setShowResults}
            results={searchResults?.items} fetching={isFetching}
            ref={containerRef} error={patientError}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Inicio</label>
              <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fin</label>
              <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Tipo de sesión</label>
              <select className="h-10 w-full rounded-md border border-input px-3 text-sm" value={sessionType} onChange={(e) => setSessionType(e.target.value as SessionType)}>
                {(Object.keys(SESSION_TYPE_LABELS) as SessionType[]).map((k) => <option key={k} value={k}>{SESSION_TYPE_LABELS[k]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Modalidad</label>
              <select className="h-10 w-full rounded-md border border-input px-3 text-sm" value={modality} onChange={(e) => setModality(e.target.value as Modality)}>
                {(Object.keys(MODALITY_LABELS) as Modality[]).map((k) => <option key={k} value={k}>{MODALITY_LABELS[k]}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notas (opcional)</label>
            <textarea className="w-full rounded-md border border-input px-3 py-2 text-sm min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="Observaciones para la cita..." />
          </div>

          <Button type="submit" className="bg-[var(--psy-primary)] hover:bg-[var(--psy-primary-soft)]" disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : "Agendar cita"}
          </Button>
        </form>
      )}

      {/* ── Recurring series ── */}
      {mode === "recurring" && (
        <form onSubmit={handleSubmitSeries} className="space-y-4">
          {seriesError && (
            <div className="rounded-md p-3 text-sm" role="alert" style={{ background: "color-mix(in srgb, var(--psy-danger) 8%, var(--psy-surface))", color: "var(--psy-danger)" }}>
              {seriesError}
            </div>
          )}
          {seriesSuccess && (
            <div className="rounded-md p-3 text-sm bg-green-50 text-green-700 border border-green-200">
              {seriesSuccess}
            </div>
          )}

          <PatientPicker
            selected={seriesPatient} onSelect={(p) => { setSeriesPatient(p); setSeriesSearch(""); setSeriesShowResults(false); setSeriesPatientError(null); }}
            onClear={() => { setSeriesPatient(null); setSeriesSearch(""); }}
            query={seriesSearch} setQuery={setSeriesSearch}
            showRes={seriesShowResults} setShowRes={setSeriesShowResults}
            results={seriesSearchResults?.items} fetching={isFetchingSeries}
            ref={seriesContainerRef} error={seriesPatientError}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Día de la semana</label>
              <select className="h-10 w-full rounded-md border border-input px-3 text-sm" value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
                {DAY_LABELS.map((label, i) => <option key={i} value={i}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Primera fecha</label>
              <Input type="date" value={firstDate} onChange={(e) => setFirstDate(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Hora</label>
              <select className="h-10 w-full rounded-md border border-input px-3 text-sm" value={timeHour} onChange={(e) => setTimeHour(Number(e.target.value))}>
                {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Minutos</label>
              <select className="h-10 w-full rounded-md border border-input px-3 text-sm" value={timeMinute} onChange={(e) => setTimeMinute(Number(e.target.value))}>
                {[0, 15, 30, 45].map((m) => <option key={m} value={m}>{String(m).padStart(2, "0")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Duración (min)</label>
              <select className="h-10 w-full rounded-md border border-input px-3 text-sm" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))}>
                {[30, 45, 50, 60, 90].map((d) => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Repeticiones</label>
              <Input type="number" min={1} max={52} value={nRepetitions} onChange={(e) => setNRepetitions(Number(e.target.value))} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo de sesión</label>
              <select className="h-10 w-full rounded-md border border-input px-3 text-sm" value={seriesSessionType} onChange={(e) => setSeriesSessionType(e.target.value as SessionType)}>
                {(Object.keys(SESSION_TYPE_LABELS) as SessionType[]).map((k) => <option key={k} value={k}>{SESSION_TYPE_LABELS[k]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Modalidad</label>
              <select className="h-10 w-full rounded-md border border-input px-3 text-sm" value={seriesModality} onChange={(e) => setSeriesModality(e.target.value as Modality)}>
                {(Object.keys(MODALITY_LABELS) as Modality[]).map((k) => <option key={k} value={k}>{MODALITY_LABELS[k]}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notas (opcional)</label>
            <textarea className="w-full rounded-md border border-input px-3 py-2 text-sm min-h-[60px]" value={seriesNotes} onChange={(e) => setSeriesNotes(e.target.value)} maxLength={1000} placeholder="Ej: todos los lunes a las 8pm — 8 sesiones" />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
            <Repeat size={13} />
            Se generarán hasta {nRepetitions} citas semanales los {DAY_LABELS[dayOfWeek]} a las {String(timeHour).padStart(2, "0")}:{String(timeMinute).padStart(2, "0")}, desde el {firstDate || "…"}.
          </div>

          <Button type="submit" className="bg-[var(--psy-primary)] hover:bg-[var(--psy-primary-soft)]" disabled={seriesMutation.isPending}>
            {seriesMutation.isPending ? "Creando serie..." : `Crear serie (${nRepetitions} citas)`}
          </Button>
        </form>
      )}
    </div>
  );
}
