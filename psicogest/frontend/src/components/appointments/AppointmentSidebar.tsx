import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAppointment, useCancelAppointment } from "@/hooks/useAppointments";
import { useProfile } from "@/hooks/useProfile";
import { useCompleteAppointment, useNoshowAppointment } from "@/hooks/useSessions";
import { useCreateVideoRoom, useRefreshVideoToken } from "@/hooks/useVideo";
import type { CancelledBy, VideoRoomResponse } from "@/lib/api";
import { ApiError } from "@/lib/api";

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
const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-[#E74C3C]",
  noshow: "bg-amber-50 text-amber-700",
};

export function AppointmentSidebar({ appointmentId, onClose }: Props) {
  const navigate = useNavigate();
  const { data: appt, isLoading } = useAppointment(appointmentId);
  const { data: profile } = useProfile();
  const cancelMutation = useCancelAppointment(appointmentId);
  const completeMutation = useCompleteAppointment(appointmentId);
  const noshowMutation = useNoshowAppointment(appointmentId);
  const createRoomMutation = useCreateVideoRoom(appointmentId);
  const refreshTokenMutation = useRefreshVideoToken(appointmentId);
  const [videoRoom, setVideoRoom] = useState<VideoRoomResponse | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoPopupRef = useRef<Window | null>(null);

  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelledBy, setCancelledBy] = useState<CancelledBy>("psychologist");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return (
    <div className="p-6 text-muted-foreground text-sm">Cargando...</div>
  );
  if (!appt) return null;

  const start = new Date(appt.scheduled_start);
  const end = new Date(appt.scheduled_end);

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

  const handleComplete = async () => {
    setActionError(null);
    try {
      await completeMutation.mutateAsync();
      navigate(`/sessions/new?appointment_id=${appointmentId}&patient_id=${appt.patient_id}&start=${encodeURIComponent(appt.scheduled_start)}&end=${encodeURIComponent(appt.scheduled_end)}`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Error al completar la cita.");
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

  const handleStartVideo = async () => {
    setVideoError(null);
    const popup = window.open(
      "",
      `video-call-${appointmentId}`,
      "popup=yes,width=1400,height=900,resizable=yes,scrollbars=yes"
    );

    if (!popup) {
      setVideoError("Tu navegador bloqueó la ventana emergente. Habilítala e intenta de nuevo.");
      return;
    }

    popup.document.write(`
      <html>
        <head><title>Videollamada</title></head>
        <body style="margin:0;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#0b0b0b;color:#fff;">
          <div>Iniciando videollamada...</div>
        </body>
      </html>
    `);
    popup.document.close();
    videoPopupRef.current = popup;

    try {
      const room = appt.video_room_id
        ? await refreshTokenMutation.mutateAsync()
        : await createRoomMutation.mutateAsync();
      setVideoRoom(room);
      const psychologistName = profile?.full_name?.trim() || "Psicólogo";
      const hostJoinUrl = `${window.location.origin}/join/${appointmentId}?t=${encodeURIComponent(room.host_token)}&role=psychologist&name=${encodeURIComponent(psychologistName)}`;
      popup.location.href = hostJoinUrl;
      popup.focus();
    } catch {
      popup.close();
      videoPopupRef.current = null;
      setVideoError("No se pudo iniciar la videollamada. Intenta de nuevo.");
    }
  };

  const handleCopyPatientLink = async () => {
    if (!videoRoom) return;
    await navigator.clipboard.writeText(videoRoom.patient_join_url);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold text-[#1E3A5F]">Detalle de cita</h2>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        <span className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[appt.status] ?? ""}`}>
          {STATUS_LABELS[appt.status] ?? appt.status}
        </span>

        <dl className="space-y-3">
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-wide">Fecha</dt>
            <dd className="text-sm">{start.toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-wide">Horario</dt>
            <dd className="text-sm">{start.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })} — {end.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-wide">Tipo</dt>
            <dd className="text-sm">{SESSION_TYPE_LABELS[appt.session_type] ?? appt.session_type}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-wide">Modalidad</dt>
            <dd className="text-sm">{MODALITY_LABELS[appt.modality] ?? appt.modality}</dd>
          </div>
          {appt.notes && (
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide">Notas</dt>
              <dd className="text-sm">{appt.notes}</dd>
            </div>
          )}
          {appt.cancellation_reason && (
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide">Motivo cancelación</dt>
              <dd className="text-sm text-[#E74C3C]">{appt.cancellation_reason}</dd>
            </div>
          )}
        </dl>

        {actionError && <p className="text-xs text-[#E74C3C]">{actionError}</p>}

        {appt.status === "scheduled" && !showCancelForm && (
          <div className="flex flex-col gap-2">
            {appt.modality === "virtual" && (
              <>
                <Button
                  size="sm"
                  className="bg-[#2E86AB] hover:bg-[#1a6a8a] text-white"
                  onClick={handleStartVideo}
                  disabled={createRoomMutation.isPending || refreshTokenMutation.isPending}
                >
                  {createRoomMutation.isPending || refreshTokenMutation.isPending
                    ? "Iniciando..."
                    : "Iniciar videollamada"}
                </Button>
                {videoRoom && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-[#2E86AB] border-[#2E86AB] hover:bg-[#2E86AB]/10"
                    onClick={handleCopyPatientLink}
                  >
                    Copiar link del paciente
                  </Button>
                )}
                {videoError && <p className="text-xs text-[#E74C3C]">{videoError}</p>}
              </>
            )}
            <Button
              size="sm"
              className="bg-[#27AE60] hover:bg-green-700 text-white"
              onClick={handleComplete}
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending ? "Procesando..." : "✓ Completar y registrar sesión"}
            </Button>
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
              className="text-[#E74C3C] border-[#E74C3C] hover:bg-red-50"
              onClick={() => setShowCancelForm(true)}
            >
              Cancelar cita
            </Button>
          </div>
        )}

        {showCancelForm && (
          <form onSubmit={handleCancel} className="space-y-3 border rounded-lg p-4 bg-red-50">
            <p className="text-sm font-medium text-[#E74C3C]">Confirmar cancelación</p>
            {cancelError && <p className="text-xs text-[#E74C3C]">{cancelError}</p>}
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
              <Button type="submit" size="sm" className="bg-[#E74C3C] hover:bg-red-700 text-white" disabled={cancelMutation.isPending}>
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
