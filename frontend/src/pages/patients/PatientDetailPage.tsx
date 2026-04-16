/**
 * Patient profile page — RF-PAC-03
 * 5 tabs: Información general, Historia clínica, Sesiones, Documentos, RIPS
 */
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePatient, useUpdatePatient } from "@/hooks/usePatients";
import { PatientForm } from "@/components/patients/PatientForm";
import { Button } from "@/components/ui/button";
import type { PatientCreatePayload } from "@/lib/api";

type Tab = "info" | "historia" | "sesiones" | "documentos" | "rips";

const TABS: { id: Tab; label: string }[] = [
  { id: "info", label: "Información general" },
  { id: "historia", label: "Historia clínica" },
  { id: "sesiones", label: "Sesiones" },
  { id: "documentos", label: "Documentos" },
  { id: "rips", label: "RIPS" },
];

const DOC_TYPE_LABELS: Record<string, string> = {
  CC: "Cédula de Ciudadanía", TI: "Tarjeta de Identidad",
  CE: "Cédula de Extranjería", PA: "Pasaporte",
  RC: "Registro Civil", MS: "Menor sin identificación",
};
const SEX_LABELS: Record<string, string> = { M: "Masculino", F: "Femenino", I: "Indeterminado" };
const MARITAL_LABELS: Record<string, string> = {
  S: "Soltero/a", C: "Casado/a", U: "Unión libre",
  D: "Divorciado/a", V: "Viudo/a", SE: "Separado/a",
};
const ZONE_LABELS: Record<string, string> = { U: "Urbana", R: "Rural" };
const PAYER_LABELS: Record<string, string> = {
  PA: "Particular", CC: "Contributivo", SS: "Subsidiado", PE: "Especial", SE: "Excepción",
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="py-2 border-b last:border-0">
      <dt className="text-xs text-muted-foreground uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [isEditing, setIsEditing] = useState(false);

  const { data: patient, isLoading, isError } = usePatient(id ?? "");
  const updateMutation = useUpdatePatient(id ?? "");

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Cargando paciente...</div>;
  }
  if (isError || !patient) {
    return (
      <div className="p-8">
        <p className="text-[#E74C3C]">Paciente no encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/patients")}>
          ← Volver a pacientes
        </Button>
      </div>
    );
  }

  const fullName = [patient.first_surname, patient.second_surname, patient.first_name, patient.second_name]
    .filter(Boolean).join(" ");

  const handleUpdate = async (data: PatientCreatePayload) => {
    await updateMutation.mutateAsync(data);
    setIsEditing(false);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/patients")}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            ← Pacientes
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#1E3A5F]">{fullName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                {patient.hc_number}
              </span>
              {patient.current_diagnosis_cie11 && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono">
                  {patient.current_diagnosis_cie11}
                </span>
              )}
              {!patient.is_active && (
                <span className="text-xs bg-red-50 text-[#E74C3C] px-2 py-0.5 rounded">
                  Inactivo
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? "Cancelar edición" : "Editar"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6">
        <nav className="flex gap-1 -mb-px" aria-label="Pestañas del perfil">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id); setIsEditing(false); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-[#2E86AB] text-[#2E86AB]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "info" && (
        isEditing ? (
          <div className="max-w-2xl">
            <PatientForm
              onSubmit={handleUpdate}
              defaultValues={patient}
              isEdit
              isSubmitting={updateMutation.isPending}
            />
          </div>
        ) : (
          <div className="max-w-xl">
            <dl className="divide-y">
              <InfoRow label="Documento" value={`${DOC_TYPE_LABELS[patient.doc_type] ?? patient.doc_type} ${patient.doc_number}`} />
              <InfoRow label="Fecha de nacimiento" value={`${patient.birth_date} (${calcAge(patient.birth_date)} años)`} />
              <InfoRow label="Sexo biológico" value={SEX_LABELS[patient.biological_sex] ?? patient.biological_sex} />
              <InfoRow label="Género de identidad" value={patient.gender_identity} />
              <InfoRow label="Estado civil" value={MARITAL_LABELS[patient.marital_status] ?? patient.marital_status} />
              <InfoRow label="Ocupación" value={patient.occupation} />
              <InfoRow label="Dirección" value={patient.address} />
              <InfoRow label="Municipio (DANE)" value={patient.municipality_dane} />
              <InfoRow label="Zona" value={ZONE_LABELS[patient.zone] ?? patient.zone} />
              <InfoRow label="Teléfono" value={patient.phone} />
              <InfoRow label="Email" value={patient.email} />
              <InfoRow label="Contacto de emergencia" value={patient.emergency_contact_name} />
              <InfoRow label="Teléfono emergencia" value={patient.emergency_contact_phone} />
              <InfoRow label="Vinculación" value={PAYER_LABELS[patient.payer_type] ?? patient.payer_type} />
              <InfoRow label="EPS" value={patient.eps_name} />
              <InfoRow label="Consentimiento" value={`Firmado el ${new Date(patient.consent_signed_at).toLocaleString("es-CO")}`} />
            </dl>
          </div>
        )
      )}

      {activeTab === "historia" && (
        <div className="max-w-xl">
          <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-800">
            El módulo de Historia Clínica se implementará en Sprint 5 (Panel de Sesión).
            Las notas firmadas aparecerán aquí en orden cronológico inverso.
          </div>
        </div>
      )}

      {activeTab === "sesiones" && (
        <div className="max-w-xl">
          <div className="rounded-lg border bg-slate-50 p-4 text-sm text-muted-foreground">
            El historial de sesiones estará disponible en Sprint 5.
          </div>
        </div>
      )}

      {activeTab === "documentos" && (
        <div className="max-w-xl">
          <div className="rounded-lg border bg-slate-50 p-4 text-sm text-muted-foreground">
            Documentos clínicos (consentimientos PDF, adjuntos) — Sprint 7.
          </div>
        </div>
      )}

      {activeTab === "rips" && (
        <div className="max-w-xl">
          <div className="rounded-lg border bg-slate-50 p-4 text-sm text-muted-foreground">
            Historial de RIPS generados para este paciente — Sprint 6.
          </div>
        </div>
      )}
    </div>
  );
}

function calcAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) {
    age--;
  }
  return age;
}
