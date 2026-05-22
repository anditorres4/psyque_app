import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAppointment, useCancelAppointment, useUpdateAppointment } from "@/hooks/useAppointments";
import { useProfile } from "@/hooks/useProfile";
import { useNoshowAppointment, useCreateSession } from "@/hooks/useSessions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AppointmentUpdatePayload, CancelledBy } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { AppointmentForm } from "@/components/appointments/AppointmentForm";

interface Props {
  appointmentId: string;
  onClose: () => void;
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  individual: "Individual", couple: "Pareja", family: "Familia", followup: "Seguimiento",
};
const MODALITY_LABELS: Record<string, string> = { presential: "Presencial", virtual: "Virtual" };
const STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendada", completed: "Completada", cancelled: "Cancelada", noshow: "No asistió",
};
const STATUS_COLORS: Record<string, { background: string; color: string }> = {
  scheduled: { background: "color-mix(in srgb, var(--psy-info) 10%, var(--psy-surface))", color: "var(--psy-info)" },
  completed: { background: "var(--psy-sage-bg)", color: "var(--psy-ok)" },
  cancelled: { background: "color-mix(in srgb, var(--psy-danger) 8%, var(--psy-surface))", color: "var(--psy-danger)" },
  noshow: { background: "color-mix(in srgb, var(--psy-warn) 10%, var(--psy-surface))", color: "var(--psy-warn)" },
};

export function AppointmentSidebar({ appointmentId, onClose }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: appt, isLoading } = useAppointment(appointmentId);
  const { data: _profile } = useProfile();

  const cancelMutation = useCancelAppointment(appointmentId);
  const noshowMutation = useNoshowAppointment(appointmentId);
  const updateMutation = useUpdateAppointment(appointmentId);
  const createSessionMutation = useCreateSession();

  const sendVideoLinkMutation = useMutation({
    mutationFn: () => api.appointments.sendVideoLink(appointmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointment", appointmentId] });
    },
  });

  const [isEditing, setIsEditing] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelledBy, setCancelledBy] = useState<CancelledBy>("psychologist");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return (
    <div className="p-6 text-sm" style={{ color: "var(--psy-ink-3)" }}>Cargando...</div>
  );
  if (!appt) return null;

  const start = new Date(appt.scheduled_start);
  const end = new Date(appt.scheduled_end);

  const handleUpdate = async (payload: AppointmentUpdatePayload) => {
    setUpdateError(null);
    try {
      await updateMutation.mutateAsync(payload);
      setIsEditing(false);
    } catch (err) {
      setUpdateError(err instanceof ApiError ? err.message : "Error al actualizar la cita.");
    }
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    setCancelError(null);
    try {
      await cancelMutation.mutateAsync({ cancelled_by: cancelledBy, cancellation_reason: cancelReason });
      setShowCancelForm(false);
    } catch (err) {
      setCancelError(err instanceof ApiError ? err.message : "Error al cancelar la cita.");
    }
  };

  const handleNoshow = async () => {
    setActionError(null);
    try {
      await noshowMutation.mutateAsync();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Error al marcar como no asistió.");
    }
  };

  const handleStartSession = async () => {
    setActionError(null);
    try {
      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
      const sess = await createSessionMutation.mutateAsync({
        patient_id: appt.patient_id,
        appointment_id: appointmentId,
        actual_start: now.toISOString(),
        actual_end: oneHourLater.toISOString(),
      });
      navigate(`/sessions/${sess.id}/doc?autostart=1`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Error al iniciar la sesión.");
    }
  };

  const handleSendVideoLink = async () => {
    setActionError(null);
    try {
      await sendVideoLinkMutation.mutateAsync();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Error al enviar el link.");
    }
  };

  // ── Edit mode ────────────────────────────────────────────────────────────────
  if (isEditing) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--psy-line)" }}>
          <h2 className="font-semibold text-[14px]" style={{ color: "var(--psy-ink-1)" }}>Editando cita</h2>
          <button
            type="button"
            onClick={() => { setIsEditing(false); setUpdateError(null); }}
            className="text-[13px] transition-colors"
            style={{ color: "var(--psy-ink-3)" }}
          >
            Cancelar
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {updateError && (
            <p className="text-[12px] mb-3" style={{ color: "var(--psy-danger)" }}>{updateError}</p>
          )}
          <AppointmentForm
            mode="edit"
            initialValues={appt}
            onSubmit={() => {}}
            onUpdate={handleUpdate}
            isSubmitting={updateMutation.isPending}
          />
        </div>
      </div>
    );
  }

  // ── Detail view ──────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--psy-line)" }}>
        <h2 className="font-semibold text-[14px]" style={{ color: "var(--psy-ink-1)" }}>Detalle de cita</h2>
        <div className="flex items-center gap-3">
          {appt.status === "scheduled" && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-[12px] font-medium transition-colors"
              style={{ color: "var(--psy-primary)" }}
            >
              Editar
            </button>
          )}
          <button type="button" onClick={onClose} className="text-xl transition-colors" style={{ color: "var(--psy-ink-3)" }}>✕</button>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        <span
          className="inline-block text-xs px-2 py-0.5 rounded font-medium"
          style={STATUS_COLORS[appt.status] ?? { background: "var(--psy-bg-soft)", color: "var(--psy-ink-2)" }}
        >
          {STATUS_LABELS[appt.status] ?? appt.status}
        </span>

        <dl className="space-y-3">
          <div>
            <dt className="psy-mono text-[10px] uppercase tracking-wide" style={{ color: "var(--psy-ink-3)" }}>Fecha</dt>
            <dd className="text-sm">{start.toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</dd>
          </div>
          <div>
            <dt className="psy-mono text-[10px] uppercase tracking-wide" style={{ color: "var(--psy-ink-3)" }}>Horario</dt>
            <dd className="text-sm">{start.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })} — {end.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</dd>
          </div>
          <div>
            <dt className="psy-mono text-[10px] uppercase tracking-wide" style={{ color: "var(--psy-ink-3)" }}>Tipo</dt>
            <dd className="text-sm">{SESSION_TYPE_LABELS[appt.session_type] ?? appt.session_type}</dd>
          </div>
          <div>
            <dt className="psy-mono text-[10px] uppercase tracking-wide" style={{ color: "var(--psy-ink-3)" }}>Modalidad</dt>
            <dd className="text-sm">{MODALITY_LABELS[appt.modality] ?? appt.modality}</dd>
          </div>
          {appt.notes && (
            <div>
              <dt className="psy-mono text-[10px] uppercase tracking-wide" style={{ color: "var(--psy-ink-3)" }}>Notas</dt>
              <dd className="text-sm">{appt.notes}</dd>
            </div>
          )}
          {appt.cancellation_reason && (
            <div>
              <dt className="psy-mono text-[10px] uppercase tracking-wide" style={{ color: "var(--psy-ink-3)" }}>Motivo cancelación</dt>
              <dd className="text-sm" style={{ color: "var(--psy-danger)" }}>{appt.cancellation_reason}</dd>
            </div>
          )}
        </dl>

        {actionError && <p className="text-xs" style={{ color: "var(--psy-danger)" }}>{actionError}</p>}

        {appt.status === "scheduled" && !showCancelForm && (
          <div className="flex flex-col gap-2">
            {/* Primary: start session */}
            <Button
              size="sm"
              className="bg-[var(--psy-primary)] hover:bg-[var(--psy-primary-soft)] text-white"
              onClick={handleStartSession}
              disabled={createSessionMutation.isPending}
            >
              {createSessionMutation.isPending ? "Iniciando..." : "▶ Iniciar sesión"}
            </Button>

            {/* Virtual only: send link to patient */}
            {appt.modality === "virtual" && (
              <>
                {sendVideoLinkMutation.isSuccess ? (
                  <p className="text-[12px] text-center py-1" style={{
                    color: sendVideoLinkMutation.data?.email_sent ? "var(--psy-ok)" : "var(--psy-warn)"
                  }}>
                    {sendVideoLinkMutation.data?.email_sent
                      ? "✓ Link enviado al paciente por correo"
                      : "⚠ Sala creada — el paciente no tiene email registrado"}
                  </p>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[var(--psy-info)] border-[var(--psy-info)] hover:bg-[var(--psy-bg-soft)]"
                    onClick={handleSendVideoLink}
                    disabled={sendVideoLinkMutation.isPending}
                  >
                    {sendVideoLinkMutation.isPending ? "Enviando..." : "Enviar link al paciente"}
                  </Button>
                )}
                {sendVideoLinkMutation.isError && (
                  <p className="text-xs" style={{ color: "var(--psy-danger)" }}>
                    {(sendVideoLinkMutation.error as Error).message}
                  </p>
                )}
              </>
            )}

            <Button
              size="sm"
              variant="outline"
              className="text-amber-700 border-amber-400 hover:bg-amber-50"
              onClick={handleNoshow}
              disabled={noshowMutation.isPending}
            >
              {noshowMutation.isPending ? "Procesando..." : "No asistió"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-[var(--psy-danger)] border-[var(--psy-danger)] hover:bg-[var(--psy-bg-soft)]"
              onClick={() => setShowCancelForm(true)}
            >
              Cancelar cita
            </Button>
          </div>
        )}

        {showCancelForm && (
          <form
            onSubmit={handleCancel}
            className="space-y-3 rounded-lg p-4"
            style={{
              background: "color-mix(in srgb, var(--psy-danger) 6%, var(--psy-surface))",
              border: "1px solid color-mix(in srgb, var(--psy-danger) 20%, var(--psy-line))",
            }}
          >
            <p className="text-sm font-medium" style={{ color: "var(--psy-danger)" }}>Confirmar cancelación</p>
            {cancelError && <p className="text-xs" style={{ color: "var(--psy-danger)" }}>{cancelError}</p>}
            <div>
              <label className="block text-xs font-medium mb-1">Cancelada por</label>
              <select
                className="h-9 w-full rounded-md border border-input px-3 text-sm"
                value={cancelledBy}
                onChange={(e) => setCancelledBy(e.target.value as CancelledBy)}
              >
                <option value="psychologist">Psicólogo</option>
                <option value="patient">Paciente</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Motivo</label>
              <textarea
                className="w-full rounded-md border border-input px-3 py-2 text-sm min-h-[60px]"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                required
                minLength={5}
                maxLength={500}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="bg-[var(--psy-danger)] hover:opacity-90 text-white" disabled={cancelMutation.isPending}>
                {cancelMutation.isPending ? "Cancelando..." : "Confirmar"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowCancelForm(false)}>
                Volver
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
