/**
 * PatientCard — PRD §8.4 spec
 * Used in patient list and global search results.
 */
import type { PatientSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

const PAYER_LABELS: Record<string, string> = {
  PA: "Particular",
  CC: "Contributivo",
  SS: "Subsidiado",
  PE: "Especial",
  SE: "Excepción",
};

interface PatientCardProps {
  patient: PatientSummary;
  onClick?: () => void;
  className?: string;
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const letters = parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="h-10 w-10 rounded-full bg-[#2E86AB] text-white flex items-center justify-center text-sm font-semibold shrink-0">
      {letters}
    </div>
  );
}

export function PatientCard({ patient, onClick, className }: PatientCardProps) {
  const fullName = [
    patient.first_surname,
    patient.second_surname,
    patient.first_name,
    patient.second_name,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-lg border bg-white hover:bg-slate-50 transition-colors text-left",
        !patient.is_active && "opacity-60",
        className
      )}
    >
      <Initials name={fullName} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[#1E3A5F] truncate">{fullName}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {patient.current_diagnosis_cie11 && (
            <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono">
              {patient.current_diagnosis_cie11}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {PAYER_LABELS[patient.payer_type] ?? patient.payer_type}
          </span>
          {!patient.is_active && (
            <span className="text-xs text-[#E74C3C]">Inactivo</span>
          )}
        </div>
      </div>
      <span className="text-xs text-muted-foreground shrink-0 font-mono">
        {patient.hc_number}
      </span>
    </button>
  );
}
