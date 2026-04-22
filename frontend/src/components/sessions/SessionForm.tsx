import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SessionCreatePayload } from "@/lib/api";

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

export function SessionForm({
  defaultAppointmentId = "",
  defaultPatientId = "",
  defaultStart,
  defaultEnd,
  onSubmit,
  isSubmitting,
  error,
}: Props) {
  const [diagnosisCie11, setDiagnosisCie11] = useState("");
  const [diagnosisDesc, setDiagnosisDesc] = useState("");
  const [cupsCode, setCupsCode] = useState("890403");
  const [reason, setReason] = useState("");
  const [intervention, setIntervention] = useState("");
  const [evolution, setEvolution] = useState("");
  const [nextPlan, setNextPlan] = useState("");
  const [fee, setFee] = useState("150000");
  const [authNumber, setAuthNumber] = useState("");
  const [actualStart, setActualStart] = useState(
    defaultStart ? toLocalDatetimeValue(defaultStart) : ""
  );
  const [actualEnd, setActualEnd] = useState(
    defaultEnd ? toLocalDatetimeValue(defaultEnd) : ""
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      appointment_id: defaultAppointmentId,
      patient_id: defaultPatientId,
      actual_start: new Date(actualStart).toISOString(),
      actual_end: new Date(actualEnd).toISOString(),
      diagnosis_cie11: diagnosisCie11,
      diagnosis_description: diagnosisDesc,
      cups_code: cupsCode,
      consultation_reason: reason,
      intervention,
      evolution: evolution || undefined,
      next_session_plan: nextPlan || undefined,
      session_fee: parseInt(fee, 10),
      authorization_number: authNumber || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-[#E74C3C]" role="alert">
          {error}
        </div>
      )}

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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">
            Diagnóstico CIE-11 <span className="text-[#E74C3C]">*</span>
          </label>
          <Input
            value={diagnosisCie11}
            onChange={(e) => setDiagnosisCie11(e.target.value.toUpperCase())}
            placeholder="Ej: 6A70"
            required
            maxLength={20}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Código CUPS <span className="text-[#E74C3C]">*</span>
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

      <div>
        <label className="block text-sm font-medium mb-1">
          Descripción del diagnóstico <span className="text-[#E74C3C]">*</span>
        </label>
        <Input
          value={diagnosisDesc}
          onChange={(e) => setDiagnosisDesc(e.target.value)}
          placeholder="Nombre completo del diagnóstico CIE-11"
          required
          minLength={5}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Motivo de consulta <span className="text-[#E74C3C]">*</span>
        </label>
        <textarea
          className="w-full rounded-md border border-input px-3 py-2 text-sm min-h-[80px]"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          minLength={10}
          placeholder="Descripción del motivo de la consulta..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Intervención realizada <span className="text-[#E74C3C]">*</span>
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

      <div>
        <label className="block text-sm font-medium mb-1">Evolución (opcional)</label>
        <textarea
          className="w-full rounded-md border border-input px-3 py-2 text-sm min-h-[60px]"
          value={evolution}
          onChange={(e) => setEvolution(e.target.value)}
          placeholder="Observaciones sobre el progreso del paciente..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Plan próxima sesión (opcional)</label>
        <textarea
          className="w-full rounded-md border border-input px-3 py-2 text-sm min-h-[60px]"
          value={nextPlan}
          onChange={(e) => setNextPlan(e.target.value)}
          placeholder="Objetivos y actividades para la próxima sesión..."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">
            Valor sesión (COP) <span className="text-[#E74C3C]">*</span>
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
          className="bg-[#2E86AB] hover:bg-[#1E3A5F] w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Guardando borrador..." : "Guardar borrador"}
        </Button>
      </div>
    </form>
  );
}
