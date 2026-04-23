import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { AppointmentCreatePayload, Modality, PatientSummary, SessionType } from "@/lib/api";

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

export function AppointmentForm({ defaultDate, defaultPatientId, onSubmit, isSubmitting, error }: Props) {
  const now = defaultDate ?? new Date();
  const endDefault = new Date(now.getTime() + 50 * 60 * 1000);

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

  const { data: searchResults, isFetching } = useQuery({
    queryKey: ["patient-search-appt", debouncedQuery],
    queryFn: () => api.patients.list({ search: debouncedQuery, page_size: 6 }),
    enabled: debouncedQuery.length >= 2 && !selectedPatient && !defaultPatientId,
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

  const patientId = selectedPatient?.id ?? defaultPatientId ?? "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) {
      setPatientError("Selecciona un paciente");
      return;
    }
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

  const handleSelectPatient = (p: PatientSummary) => {
    setSelectedPatient(p);
    setSearchQuery("");
    setShowResults(false);
    setPatientError(null);
  };

  const handleClearPatient = () => {
    setSelectedPatient(null);
    setSearchQuery("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-[#E74C3C]" role="alert">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Paciente</label>

        {defaultPatientId ? (
          <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted text-sm text-muted-foreground">
            Paciente preseleccionado
          </div>
        ) : selectedPatient ? (
          <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-slate-50 text-sm">
            <span className="flex-1 truncate">{patientLabel(selectedPatient)}</span>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground shrink-0"
              onClick={handleClearPatient}
              aria-label="Limpiar selección"
            >
              ✕
            </button>
          </div>
        ) : (
          <div ref={containerRef} className="relative">
            <Input
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
              onFocus={() => setShowResults(true)}
              placeholder="Buscar por nombre, apellido o documento..."
              autoComplete="off"
            />
            {showResults && debouncedQuery.length >= 2 && (
              <div className="absolute z-10 top-full mt-1 w-full bg-white border rounded-md shadow-lg max-h-52 overflow-y-auto">
                {isFetching && (
                  <p className="text-xs text-muted-foreground p-3">Buscando...</p>
                )}
                {!isFetching && searchResults?.items.length === 0 && (
                  <p className="text-xs text-muted-foreground p-3">
                    No se encontraron pacientes con "{debouncedQuery}"
                  </p>
                )}
                {searchResults?.items.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 border-b last:border-b-0"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectPatient(p)}
                  >
                    <span className="font-medium">
                      {[p.first_surname, p.second_surname].filter(Boolean).join(" ")},{" "}
                      {p.first_name}
                    </span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {p.doc_type} {p.doc_number}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {patientError && (
          <p className="mt-1 text-xs text-[#E74C3C]">{patientError}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Inicio</label>
          <Input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Fin</label>
          <Input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Tipo de sesión</label>
          <select
            className="h-10 w-full rounded-md border border-input px-3 text-sm"
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value as SessionType)}
          >
            {(Object.keys(SESSION_TYPE_LABELS) as SessionType[]).map((k) => (
              <option key={k} value={k}>{SESSION_TYPE_LABELS[k]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Modalidad</label>
          <select
            className="h-10 w-full rounded-md border border-input px-3 text-sm"
            value={modality}
            onChange={(e) => setModality(e.target.value as Modality)}
          >
            {(Object.keys(MODALITY_LABELS) as Modality[]).map((k) => (
              <option key={k} value={k}>{MODALITY_LABELS[k]}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Notas (opcional)</label>
        <textarea
          className="w-full rounded-md border border-input px-3 py-2 text-sm min-h-[80px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
          placeholder="Observaciones para la cita..."
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          className="bg-[#2E86AB] hover:bg-[#1E3A5F]"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Guardando..." : "Agendar cita"}
        </Button>
      </div>
    </form>
  );
}
