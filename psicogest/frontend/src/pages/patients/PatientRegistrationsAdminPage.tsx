import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { request } from "@/lib/api";

interface RegistrationSummary {
  id: string;
  status: string;
  created_at: string;
  first_name: string | null;
  first_surname: string | null;
  email: string;
}

interface RegistrationDetail {
  id: string;
  status: string;
  email: string;
  intake_data: Record<string, unknown>;
  consent_signed_at: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-50 text-[var(--psy-warn)]",
  approved: "bg-[var(--psy-sage-bg)] text-[var(--psy-ok)]",
  rejected: "bg-red-50 text-[var(--psy-danger)]",
};

export function PatientRegistrationsAdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: regs = [], isLoading } = useQuery({
    queryKey: ["patient-registrations"],
    queryFn: () => request<RegistrationSummary[]>("GET", "/patient-registrations"),
  });

  const { data: detail } = useQuery({
    queryKey: ["patient-registration-detail", selectedId],
    queryFn: () => request<RegistrationDetail>("GET", `/patient-registrations/${selectedId}`),
    enabled: !!selectedId,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => request<{ ok: boolean; patient_id: string }>("POST", `/patient-registrations/${id}/approve`),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["patient-registrations"] });
      setSelectedId(null);
      navigate(`/patients/${data.patient_id}`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => request<{ ok: boolean }>("POST", `/patient-registrations/${id}/reject`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient-registrations"] });
      setSelectedId(null);
    },
  });

  const pending = regs.filter((r) => r.status === "pending");
  const processed = regs.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="psy-page-title">Registros de pacientes</h1>
        <p className="psy-page-sub">Solicitudes de inscripción enviadas por pacientes a través del portal público</p>
      </div>

      {isLoading && <div className="text-sm text-[var(--psy-ink-3)]">Cargando...</div>}

      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-[var(--psy-ink-2)] mb-3">Pendientes de revisión ({pending.length})</h2>
          <div className="space-y-2">
            {pending.map((r) => (
              <RegistrationRow key={r.id} r={r} onView={() => setSelectedId(r.id)} />
            ))}
          </div>
        </section>
      )}

      {pending.length === 0 && !isLoading && (
        <div className="rounded-xl p-8 text-center text-sm" style={{ border: "1px solid var(--psy-line)", background: "var(--psy-bg-soft)", color: "var(--psy-ink-3)" }}>
          Sin solicitudes pendientes
        </div>
      )}

      {processed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-[var(--psy-ink-2)] mb-3">Procesados</h2>
          <div className="space-y-2">
            {processed.map((r) => (
              <RegistrationRow key={r.id} r={r} onView={() => setSelectedId(r.id)} />
            ))}
          </div>
        </section>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Datos del registro</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <InfoField label="Nombre" value={`${detail.intake_data?.first_name ?? ""} ${detail.intake_data?.first_surname ?? ""}`} />
                <InfoField label="Email" value={detail.email} />
                <InfoField label="Documento" value={`${detail.intake_data?.doc_type} ${detail.intake_data?.doc_number}`} />
                <InfoField label="Fecha nacimiento" value={detail.intake_data?.birth_date as string} />
                <InfoField label="Teléfono" value={detail.intake_data?.phone as string} />
                <InfoField label="Régimen" value={detail.intake_data?.payer_type as string} />
                <InfoField label="Ocupación" value={detail.intake_data?.occupation as string} />
                <InfoField label="Consentimiento" value={detail.consent_signed_at ? new Date(detail.consent_signed_at).toLocaleString("es-CO") : "—"} />
              </div>

              <div>
                <p className="psy-mono text-[10.5px] font-semibold uppercase tracking-wide text-[var(--psy-ink-3)] mb-1">Motivo de consulta</p>
                <p className="whitespace-pre-wrap text-[var(--psy-ink-1)]">{detail.intake_data?.motivo_consulta as string}</p>
              </div>

              {(detail.intake_data?.antecedentes_medicos as string | undefined) && (
                <div>
                  <p className="psy-mono text-[10.5px] font-semibold uppercase tracking-wide text-[var(--psy-ink-3)] mb-1">Antecedentes médicos</p>
                  <p className="whitespace-pre-wrap text-[var(--psy-ink-1)]">{detail.intake_data.antecedentes_medicos as string}</p>
                </div>
              )}
              {(detail.intake_data?.antecedentes_psicologicos as string | undefined) && (
                <div>
                  <p className="psy-mono text-[10.5px] font-semibold uppercase tracking-wide text-[var(--psy-ink-3)] mb-1">Antecedentes psicológicos</p>
                  <p className="whitespace-pre-wrap text-[var(--psy-ink-1)]">{detail.intake_data.antecedentes_psicologicos as string}</p>
                </div>
              )}

              {detail.status === "pending" && (
                <div className="flex gap-3 pt-3 border-t">
                  <Button
                    className="flex-1"
                    onClick={() => approveMutation.mutate(detail.id)}
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending ? "Creando paciente..." : "Aprobar → crear paciente"}
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => rejectMutation.mutate(detail.id)}
                    disabled={rejectMutation.isPending}
                  >
                    Rechazar
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RegistrationRow({ r, onView }: { r: RegistrationSummary; onView: () => void }) {
  const name = r.first_name && r.first_surname ? `${r.first_surname}, ${r.first_name}` : r.email;
  return (
    <button
      type="button"
      className="w-full flex items-center justify-between p-4 rounded-xl transition-colors text-left" style={{ border: "1px solid var(--psy-line)", background: "var(--psy-surface)" }} onMouseEnter={e => (e.currentTarget.style.background = "var(--psy-bg-soft)")} onMouseLeave={e => (e.currentTarget.style.background = "var(--psy-surface)")}
      onClick={onView}
    >
      <div>
        <div className="font-medium text-sm" style={{ color: "var(--psy-ink-1)" }}>{name}</div>
        <div className="text-xs mt-0.5" style={{ color: "var(--psy-ink-3)" }}>{r.email} · {new Date(r.created_at).toLocaleDateString("es-CO")}</div>
      </div>
      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[r.status] ?? "bg-slate-100 text-slate-600"}`}>
        {STATUS_LABELS[r.status] ?? r.status}
      </span>
    </button>
  );
}

function InfoField({ label, value }: { label: string; value: string | undefined | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="psy-mono text-[10.5px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "var(--psy-ink-3)" }}>{label}</p>
      <p style={{ color: "var(--psy-ink-1)" }}>{value}</p>
    </div>
  );
}
