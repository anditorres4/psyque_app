/**
 * Patient profile page — RF-PAC-03
 * 5 tabs: Información general, Historia clínica, Sesiones, Documentos, RIPS
 */
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { usePatient, useUpdatePatient } from "@/hooks/usePatients";
import { PatientForm } from "@/components/patients/PatientForm";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import type { PatientCreatePayload, SessionSummary } from "@/lib/api";
import { useSessions } from "@/hooks/useSessions";
import { SessionDetail } from "@/components/sessions/SessionDetail";
import { api } from "@/lib/api";
import { PsyButton, PsyCard, Tag } from "@/components/ui/psy";
import { DocumentsTab } from "@/components/patients/DocumentsTab";
import { ClinicalRecordSection } from "@/components/patients/ClinicalRecordSection";
import { SessionTimeline } from "@/components/patients/SessionTimeline";
import { IndicatorsTab } from "@/components/patients/IndicatorsTab";
import { ReferralsTab } from "@/components/patients/ReferralsTab";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type Tab = "info" | "historia" | "sesiones" | "documentos" | "rips" | "seguimiento" | "remisiones";

const TABS: { id: Tab; label: string }[] = [
  { id: "info", label: "Información general" },
  { id: "historia", label: "Historia clínica" },
  { id: "sesiones", label: "Sesiones" },
  { id: "documentos", label: "Documentos" },
  { id: "rips", label: "RIPS" },
  { id: "seguimiento", label: "Seguimiento" },
  { id: "remisiones", label: "Remisiones" },
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

function PsyInfoCard({ title, badge, children }: { title: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <div
      className="rounded-[var(--radius)] overflow-hidden"
      style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--psy-line)" }}
      >
        <span className="psy-mono text-[10.5px] uppercase tracking-wider" style={{ color: "var(--psy-ink-3)" }}>
          {title}
        </span>
        {badge}
      </div>
      <dl className="px-4 py-3 space-y-3">{children}</dl>
    </div>
  );
}

function PsyFieldRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <dt className="psy-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--psy-ink-3)" }}>
        {label}
      </dt>
      <dd
        className={`text-[13px] mt-0.5${mono ? " psy-mono" : ""}`}
        style={{ color: "var(--psy-ink-1)" }}
      >
        {value}
      </dd>
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

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-xl">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }
  if (isError || !patient) {
    return (
      <div className="max-w-xl">
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

  const initials = [patient.first_name, patient.first_surname]
    .filter(Boolean)
    .map((s) => s![0].toUpperCase())
    .join("");

  return (
    <div className="space-y-5">
      {/* Patient header */}
      <div
        className="rounded-[var(--radius)] p-5"
        style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
      >
        <div className="grid gap-4 md:grid-cols-[auto_1fr_auto]">
          {/* Avatar */}
          <div
            className="w-[68px] h-[68px] rounded-full grid place-items-center shrink-0"
            style={{
              background: "linear-gradient(135deg, var(--psy-sage-bg), var(--psy-surface))",
              border: "1px solid var(--psy-sage-soft)",
            }}
          >
            <span className="psy-serif text-[30px]" style={{ color: "var(--psy-primary)" }}>{initials}</span>
          </div>

          {/* Identity */}
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="psy-mono text-[11px]" style={{ color: "var(--psy-ink-3)" }}>{patient.hc_number}</span>
              <span className="psy-tag psy-tag-sage">{patient.is_active ? "activa" : "inactiva"}</span>
              {patient.current_diagnosis_cie11 && (
                <span className="psy-tag psy-tag-info">{patient.current_diagnosis_cie11}</span>
              )}
            </div>
            <h1 className="psy-page-title" style={{ fontSize: 30 }}>{fullName}</h1>
            {patient.birth_date && (
              <div className="psy-mono text-[12px] mt-1" style={{ color: "var(--psy-ink-3)" }}>
                {new Date(patient.birth_date).toLocaleDateString("es-CO")} · {Math.floor((Date.now() - new Date(patient.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))}a
              </div>
            )}
          </div>

          {/* Actions */}
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
        </div>{/* close grid */}
      </div>{/* close header card */}

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid var(--psy-line)" }}>
        <nav className="flex gap-0.5 overflow-x-auto pb-1 psy-no-scrollbar" aria-label="Pestañas del perfil">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id); setIsEditing(false); }}
              className="px-4 py-2.5 text-[13px] font-medium transition-colors relative"
              style={{
                color: activeTab === tab.id ? "var(--psy-primary)" : "var(--psy-ink-3)",
                borderBottom: activeTab === tab.id ? "2px solid var(--psy-sage)" : "2px solid transparent",
              }}
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
          <div className="psy-grid-split-info">
            {/* Left: grouped cards */}
            <div className="flex flex-col gap-4">
              <PsyInfoCard title="Identificación">
                <PsyFieldRow label="Documento" value={`${DOC_TYPE_LABELS[patient.doc_type] ?? patient.doc_type} ${patient.doc_number}`} mono />
                <PsyFieldRow label="Nacimiento" value={patient.birth_date ? `${patient.birth_date} · ${calcAge(patient.birth_date)}a` : undefined} mono />
                <PsyFieldRow label="Sexo / Género" value={[SEX_LABELS[patient.biological_sex], patient.gender_identity].filter(Boolean).join(" / ")} />
                <PsyFieldRow label="Estado civil" value={MARITAL_LABELS[patient.marital_status] ?? patient.marital_status} />
                <PsyFieldRow label="Ocupación" value={patient.occupation} />
              </PsyInfoCard>

              <PsyInfoCard title="Contacto">
                <PsyFieldRow label="Teléfono" value={patient.phone} mono />
                <PsyFieldRow label="Email" value={patient.email} mono />
                <PsyFieldRow label="Dirección" value={[patient.address, patient.municipality_dane, ZONE_LABELS[patient.zone]].filter(Boolean).join(" · ")} />
                <PsyFieldRow label="Emergencia" value={[patient.emergency_contact_name, patient.emergency_contact_phone].filter(Boolean).join(" · ")} mono />
              </PsyInfoCard>

              <PsyInfoCard
                title="Vinculación"
                badge={patient.eps_name ? <span className="psy-tag psy-tag-info">{patient.eps_name}</span> : undefined}
              >
                <PsyFieldRow label="Régimen" value={PAYER_LABELS[patient.payer_type] ?? patient.payer_type} />
                <PsyFieldRow label="EPS" value={patient.eps_name} />
              </PsyInfoCard>
            </div>

            {/* Right: clinical summary + sessions */}
            <div className="flex flex-col gap-4">
              {patient.current_diagnosis_cie11 && (
                <div
                  className="rounded-[var(--radius)] p-4"
                  style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
                >
                  <div className="psy-mono text-[10.5px] uppercase tracking-wider mb-3" style={{ color: "var(--psy-ink-3)" }}>
                    Diagnóstico activo · CIE-11
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="psy-mono text-[28px] font-semibold leading-none" style={{ color: "var(--psy-primary)" }}>
                      {patient.current_diagnosis_cie11}
                    </div>
                    <span className="psy-tag psy-tag-sage">activo</span>
                  </div>
                </div>
              )}

              <div
                className="rounded-[var(--radius)] p-4"
                style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
              >
                <div className="psy-mono text-[10.5px] uppercase tracking-wider mb-3" style={{ color: "var(--psy-ink-3)" }}>
                  Historia clínica
                </div>
                {id && (
                  <SessionTimeline
                    patientId={id}
                    onOpenSession={(sessionId) => {
                      setInitialSessionId(sessionId);
                      setActiveTab("sesiones");
                    }}
                  />
                )}
              </div>

              {/* Habeas data */}
              <div
                className="flex items-center gap-3 p-4 rounded-[var(--radius)]"
                style={{ background: "var(--psy-bg-soft)", border: "1px solid var(--psy-line)" }}
              >
                <div
                  className="w-8 h-8 rounded-md grid place-items-center shrink-0"
                  style={{ background: "var(--psy-surface)", color: "var(--psy-ok)", border: "1px solid var(--psy-sage-soft)" }}
                >
                  🔒
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium" style={{ color: "var(--psy-ink-1)" }}>
                    Habeas data firmado · Ley 1581/2012
                  </div>
                  {patient.consent_signed_at && (
                    <div className="psy-mono text-[10.5px] mt-0.5" style={{ color: "var(--psy-ink-3)" }}>
                      {new Date(patient.consent_signed_at).toLocaleString("es-CO")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {activeTab === "historia" && id && (
        <div className="max-w-2xl space-y-8">
          <ClinicalRecordSection
            patientId={id}
            patientAge={patient.birth_date ? calcAge(patient.birth_date) : null}
          />
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
  const navigate = useNavigate();
  const { data, isLoading, isError } = useSessions({ patient_id: patientId });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (initialSessionId && selectedId !== initialSessionId) {
      setSelectedId(initialSessionId);
      onInitialSessionConsumed();
    }
  }, [initialSessionId, onInitialSessionConsumed, selectedId]);

  if (selectedId) {
    return (
      <div className="max-w-3xl">
        <SessionDetail sessionId={selectedId} onBack={() => setSelectedId(null)} />
      </div>
    );
  }

  const STATUS_LABELS: Record<string, string> = { draft: "Borrador", signed: "Firmada" };
  const STATUS_TONES: Record<string, "amber" | "sage"> = { draft: "amber", signed: "sage" };
  const items = data?.items ?? [];

  function SessionCard({ session, onClick }: { session: SessionSummary; onClick: () => void }) {
    const start = new Date(session.actual_start);
    return (
      <div
        className="p-4 rounded-[var(--radius)] cursor-pointer transition-colors hover:bg-[var(--psy-bg-soft)]"
        style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
        onClick={onClick}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="psy-mono text-[12px]" style={{ color: "var(--psy-ink-2)" }}>
            {start.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" })}
          </span>
          <Tag tone={STATUS_TONES[session.status] ?? "default"}>
            {STATUS_LABELS[session.status] ?? session.status}
          </Tag>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <span className="psy-mono font-semibold" style={{ color: "var(--psy-primary)" }}>
            {session.diagnosis_cie11}
          </span>
          <span className="psy-mono text-[11px]" style={{ color: "var(--psy-ink-3)" }}>
            {session.cups_code}
          </span>
        </div>
        <span className="psy-mono psy-tab-num text-[14px] font-semibold" style={{ color: "var(--psy-ink-1)" }}>
          ${Number(session.session_fee).toLocaleString("es-CO")}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="psy-mono text-[11px]" style={{ color: "var(--psy-ink-3)" }}>
          {isLoading ? "Cargando…" : `${items.length} sesión${items.length !== 1 ? "es" : ""}`}
        </div>
        <PsyButton
          variant="primary"
          onClick={() => navigate(`/sessions?new&patient_id=${patientId}`)}
        >
          + Nueva sesión
        </PsyButton>
      </div>

      {isLoading && (
        <PsyCard padded={false}>
          <div className="p-4 space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        </PsyCard>
      )}

      {isError && !isLoading && <ErrorState message="Error al cargar sesiones." />}

      {!isLoading && !isError && items.length === 0 && (
        <PsyCard>
          <EmptyState
            title="Sin sesiones registradas"
            description="Crea la primera nota de sesión para este paciente."
            icon="📝"
          />
        </PsyCard>
      )}

      {!isLoading && items.length > 0 && (
        <>
          {/* Tabla — md+ */}
          <div className="hidden md:block">
            <PsyCard padded={false}>
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--psy-line)" }}>
                    {["Fecha", "CIE-11", "CUPS", "Valor", "Estado"].map((h, i) => (
                      <th
                        key={h}
                        className={`px-[18px] py-3 psy-mono text-[10.5px] uppercase tracking-wider font-medium ${i === 3 ? "text-right" : "text-left"}`}
                        style={{ color: "var(--psy-ink-3)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((sess) => (
                    <tr
                      key={sess.id}
                      onClick={() => setSelectedId(sess.id)}
                      className="cursor-pointer transition-colors hover:bg-[var(--psy-bg-soft)]"
                      style={{ borderBottom: "1px solid var(--psy-line)" }}
                    >
                      <td className="px-[18px] py-3 psy-mono text-[12px]" style={{ color: "var(--psy-ink-2)" }}>
                        {new Date(sess.actual_start).toLocaleDateString("es-CO", {
                          year: "numeric", month: "short", day: "numeric",
                        })}
                      </td>
                      <td className="px-[18px] py-3 psy-mono font-semibold" style={{ color: "var(--psy-primary)" }}>
                        {sess.diagnosis_cie11}
                      </td>
                      <td className="px-[18px] py-3 psy-mono" style={{ color: "var(--psy-ink-2)" }}>
                        {sess.cups_code}
                      </td>
                      <td className="px-[18px] py-3 psy-mono psy-tab-num text-right" style={{ color: "var(--psy-ink-1)" }}>
                        ${Number(sess.session_fee).toLocaleString("es-CO")}
                      </td>
                      <td className="px-[18px] py-3">
                        <Tag tone={STATUS_TONES[sess.status] ?? "default"}>
                          {STATUS_LABELS[sess.status] ?? sess.status}
                        </Tag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </PsyCard>
          </div>

          {/* Cards — mobile */}
          <div className="md:hidden space-y-3">
            {items.map((sess) => (
              <SessionCard key={sess.id} session={sess} onClick={() => setSelectedId(sess.id)} />
            ))}
          </div>
        </>
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
