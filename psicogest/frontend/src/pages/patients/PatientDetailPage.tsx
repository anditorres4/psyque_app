/**
 * Patient profile page — RF-PAC-03
 * 5 tabs: Información general, Historia clínica, Sesiones, Documentos, RIPS
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { usePatient, useUpdatePatient } from "@/hooks/usePatients";
import { PatientForm } from "@/components/patients/PatientForm";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import type { PatientCreatePayload } from "@/lib/api";
import { useSessions, useCreateSession } from "@/hooks/useSessions";
import { SessionForm } from "@/components/sessions/SessionForm";
import { SessionDetail } from "@/components/sessions/SessionDetail";
import type { SessionCreatePayload } from "@/lib/api";
import { ApiError, api } from "@/lib/api";
import { useClinicalRecord } from "@/hooks/useClinicalRecord";
import { DocumentsTab } from "@/components/patients/DocumentsTab";
import { ClinicalRecordSection } from "@/components/patients/ClinicalRecordSection";
import { SessionTimeline } from "@/components/patients/SessionTimeline";
import { IndicatorsTab } from "@/components/patients/IndicatorsTab";
import { ReferralsTab } from "@/components/patients/ReferralsTab";
import { AiDiagnosisPanel } from "@/components/patients/AiDiagnosisPanel";
import { AiSummariesPanel } from "@/components/patients/AiSummariesPanel";
import { AiDocumentsPanel } from "@/components/patients/AiDocumentsPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type Tab = "info" | "historia" | "sesiones" | "documentos" | "rips" | "seguimiento" | "remisiones" | "psyque-ia";

const TABS: { id: Tab; label: string }[] = [
  { id: "info", label: "Información general" },
  { id: "historia", label: "Historia clínica" },
  { id: "sesiones", label: "Sesiones" },
  { id: "documentos", label: "Documentos" },
  { id: "rips", label: "RIPS" },
  { id: "seguimiento", label: "Seguimiento" },
  { id: "remisiones", label: "Remisiones" },
  { id: "psyque-ia", label: "Psyque IA" },
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
  const [initialSessionId, setInitialSessionId] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    include_diagnosis: true,
    include_treatment: true,
    include_evolution: true,
    patient_profile: "adulto" as "adulto" | "infante" | "familiar",
  });
  const [isExporting, setIsExporting] = useState(false);

  const { data: patient, isLoading, isError } = usePatient(id ?? "");
  const updateMutation = useUpdatePatient(id ?? "");
  const { data: clinicalRecord } = useClinicalRecord(id ?? "");

  if (isLoading) {
    return (
      <div className="p-8 space-y-4 max-w-xl">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }
  if (isError || !patient) {
    return (
      <div className="p-8 max-w-xl">
        <ErrorState onRetry={() => window.location.reload()} />
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

  const handleExportHistory = async () => {
    if (!id) return;
    setIsExporting(true);
    try {
      const result = await api.patients.exportHistory(id, exportOptions);
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      setExportModalOpen(false);
    } catch (err) {
      console.error("Error exporting history:", err);
    } finally {
      setIsExporting(false);
    }
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
          <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Exportar HC</Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Opciones de exportación</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Perfil del paciente</p>
                  <div className="flex gap-4">
                    {(["adulto", "infante", "familiar"] as const).map((p) => (
                      <label key={p} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="patient_profile"
                          value={p}
                          checked={exportOptions.patient_profile === p}
                          onChange={() => setExportOptions((o) => ({ ...o, patient_profile: p }))}
                          className="accent-primary"
                        />
                        <span className="text-sm capitalize">{p}</span>
                      </label>
                    ))}
                  </div>
                  {exportOptions.patient_profile === "infante" && (
                    <p className="text-xs text-muted-foreground">
                      Incluye responsable legal desde contacto de emergencia.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Secciones a incluir</p>
                  {(
                    [
                      { key: "include_diagnosis", label: "Diagnóstico (CIE-11)" },
                      { key: "include_treatment", label: "Intervención y plan" },
                      { key: "include_evolution", label: "Evolución" },
                    ] as const
                  ).map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      <Checkbox
                        id={key}
                        checked={exportOptions[key]}
                        onCheckedChange={(checked) =>
                          setExportOptions((o) => ({ ...o, [key]: !!checked }))
                        }
                      />
                      <Label htmlFor={key} className="text-sm font-normal cursor-pointer">
                        {label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setExportModalOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleExportHistory} disabled={isExporting}>
                  {isExporting ? "Generando..." : "Descargar PDF"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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

      {activeTab === "historia" && id && (
        <div className="max-w-2xl space-y-8">
          <ClinicalRecordSection patientId={id} />
          <div>
            <h3 className="text-sm font-semibold text-[#1E3A5F] mb-3">Evolución — Sesiones</h3>
            <SessionTimeline
              patientId={id}
              onOpenSession={(sessionId) => {
                setInitialSessionId(sessionId);
                setActiveTab("sesiones");
              }}
            />
          </div>
        </div>
      )}

      {activeTab === "sesiones" && id && (
        <PatientSessionsTab
          patientId={id}
          initialSessionId={initialSessionId}
          onInitialSessionConsumed={() => setInitialSessionId(null)}
        />
      )}

      {activeTab === "documentos" && id && (
        <DocumentsTab patientId={id} />
      )}

      {activeTab === "rips" && id && (
        <RipsTab />
      )}

      {activeTab === "seguimiento" && id && (
        <IndicatorsTab patientId={id} />
      )}

      {activeTab === "remisiones" && id && (
        <ReferralsTab patientId={id} />
      )}

      {activeTab === "psyque-ia" && id && patient && (
        <div className="space-y-6">
          <AiDiagnosisPanel
            patientId={id}
            clinicalRecord={clinicalRecord ?? null}
            recentSessions={[]}
          />
          <AiSummariesPanel patientId={id} />
          <AiDocumentsPanel patientId={id} />
        </div>
      )}
    </div>
  );
}

function PatientSessionsTab({
  patientId,
  initialSessionId,
  onInitialSessionConsumed,
}: {
  patientId: string;
  initialSessionId: string | null;
  onInitialSessionConsumed: () => void;
}) {
  const { data, isLoading, isError } = useSessions({ patient_id: patientId });
  const createMutation = useCreateSession();
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSessionId && selectedId !== initialSessionId) {
      setSelectedId(initialSessionId);
      onInitialSessionConsumed();
    }
  }, [initialSessionId, onInitialSessionConsumed, selectedId]);

  const handleCreate = async (payload: SessionCreatePayload) => {
    setCreateError(null);
    try {
      const sess = await createMutation.mutateAsync(payload);
      setSelectedId(sess.id);
      setShowForm(false);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Error al crear sesión.");
    }
  };

  if (selectedId) {
    return (
      <div className="max-w-2xl">
        <SessionDetail sessionId={selectedId} onBack={() => setSelectedId(null)} />
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="max-w-2xl">
        <button type="button" onClick={() => setShowForm(false)} className="text-sm text-muted-foreground mb-4 block">← Volver</button>
        <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Nueva nota de sesión</h3>
        <SessionForm
          defaultPatientId={patientId}
          onSubmit={handleCreate}
          isSubmitting={createMutation.isPending}
          error={createError}
        />
      </div>
    );
  }

  const STATUS_COLORS: Record<string, string> = {
    draft: "bg-amber-50 text-amber-700",
    signed: "bg-green-50 text-green-700",
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-[#1E3A5F]">Historial de sesiones</h3>
        <Button size="sm" className="bg-[#2E86AB] hover:bg-[#1E3A5F] text-white" onClick={() => setShowForm(true)}>
          + Nueva sesión
        </Button>
      </div>

      {isLoading && <Skeleton className="h-20" />}

      {isError && !isLoading && <ErrorState message="Error al cargar sesiones." />}

      {!isLoading && !isError && data && data.items.length === 0 && (
        <EmptyState
          title="Sin sesiones registradas"
          description="Crea la primera nota de sesión para este paciente."
          icon="📝"
        />
      )}

      {!isLoading && data && data.items.length > 0 && (
        <div className="space-y-2">
          {data.items.map((sess) => (
            <button
              key={sess.id}
              type="button"
              onClick={() => setSelectedId(sess.id)}
              className="w-full text-left border rounded-lg p-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#1E3A5F]">
                  {new Date(sess.actual_start).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[sess.status] ?? ""}`}>
                  {sess.status === "signed" ? "Firmada" : "Borrador"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                CIE-11: {sess.diagnosis_cie11} · CUPS: {sess.cups_code} · ${Number(sess.session_fee).toLocaleString("es-CO")} COP
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RipsTab() {
  const { data: exports, isLoading, isError } = useQuery({
    queryKey: ["rips"],
    queryFn: () => api.rips.list(),
  });

  const MONTH_NAMES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  if (isLoading) return <Skeleton className="h-24 max-w-xl" />;
  if (isError) return <ErrorState message="Error al cargar RIPS." />;

  if (!exports || exports.length === 0) {
    return (
      <div className="max-w-xl">
        <EmptyState
          title="Sin RIPS generados"
          description="Genera RIPS desde la página de RIPS después de firmar sesiones."
          icon="📦"
        />
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-3">
      <p className="text-sm text-muted-foreground">
        Exportaciones RIPS del consultorio. Incluyen todas las sesiones firmadas del período.
      </p>
      {exports.map((exp) => (
        <div key={exp.id} className="border rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#1E3A5F]">
              {MONTH_NAMES[(exp.period_month ?? 1) - 1]} {exp.period_year}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {exp.sessions_count} sesión(es) · ${Number(exp.total_value_cop).toLocaleString("es-CO")} COP
            </p>
            {exp.generated_at && (
              <p className="text-xs text-muted-foreground">
                Generado: {new Date(exp.generated_at).toLocaleDateString("es-CO")}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => api.rips.download(exp.id).then(({ blob, filename }) => {
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = filename;
              a.click();
              URL.revokeObjectURL(url);
            })}
          >
            Descargar
          </Button>
        </div>
      ))}
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
