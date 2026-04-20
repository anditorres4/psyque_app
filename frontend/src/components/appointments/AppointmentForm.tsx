import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AppointmentCreatePayload, SessionType, Modality } from "@/lib/api";

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

export function AppointmentForm({ defaultDate, defaultPatientId, onSubmit, isSubmitting, error }: Props) {
  const now = defaultDate ?? new Date();
  const endDefault = new Date(now.getTime() + 50 * 60 * 1000);

  const [patientId, setPatientId] = useState(defaultPatientId ?? "");
  const [start, setStart] = useState(toLocalDatetimeValue(now));
  const [end, setEnd] = useState(toLocalDatetimeValue(endDefault));
  const [sessionType, setSessionType] = useState<SessionType>("individual");
  const [modality, setModality] = useState<Modality>("presential");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      patient_id: patientId,
      scheduled_start: toISOWithOffset(start),
      scheduled_end: toISOWithOffset(end),
      session_type: sessionType,
      modality,
      notes: notes || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-[#E74C3C]" role="alert">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">ID del paciente</label>
        <Input
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          placeholder="UUID del paciente"
          required
          disabled={!!defaultPatientId}
        />
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
