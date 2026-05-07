import { useRef, useState, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, EventClickArg, DatesSetArg } from "@fullcalendar/core";
import { useAppointmentsByRange, useCreateAppointment } from "@/hooks/useAppointments";
import { useBookingRequests, useConfirmBookingRequest, useRejectBookingRequest } from "@/hooks/useBooking";
import { AppointmentForm } from "@/components/appointments/AppointmentForm";
import { AppointmentSidebar } from "@/components/appointments/AppointmentSidebar";
import { ApiError, type AppointmentCreatePayload, type BookingRequestSummary } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "#2E5E8A",
  completed: "#4F7F5A",
  cancelled: "#B0463A",
  noshow: "#B8843A",
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  individual: "Individual",
  couple: "Pareja",
  family: "Familia",
  followup: "Seguimiento",
};

export function AgendaPage() {
  const calendarRef = useRef<FullCalendar>(null);

  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  const { data: appointments = [], isLoading, isError } = useAppointmentsByRange(rangeStart, rangeEnd);
  const createMutation = useCreateAppointment();

  const [showForm, setShowForm] = useState(false);
  const [formDefaultDate, setFormDefaultDate] = useState<Date | undefined>();
  const [formError, setFormError] = useState<string | null>(null);

  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [selectedBookingRequest, setSelectedBookingRequest] = useState<BookingRequestSummary | null>(null);

  const { data: bookingRequests = [] } = useBookingRequests("pending");
  const confirmMutation = useConfirmBookingRequest();
  const rejectMutation = useRejectBookingRequest();

  const handleDatesSet = useCallback((info: DatesSetArg) => {
    setRangeStart(info.start.toISOString());
    setRangeEnd(info.end.toISOString());
  }, []);

  const handleDateSelect = useCallback((info: DateSelectArg) => {
    setFormDefaultDate(info.start);
    setFormError(null);
    setShowForm(true);
  }, []);

  const handleEventClick = useCallback((info: EventClickArg) => {
    const { type, requestId } = info.event.extendedProps as { type?: string; requestId?: string };
    if (type === "booking_request") {
      const req = bookingRequests.find((r) => r.id === requestId) ?? null;
      setSelectedBookingRequest(req);
      setSelectedAppointmentId(null);
    } else {
      setSelectedAppointmentId(info.event.id);
      setSelectedBookingRequest(null);
    }
  }, [bookingRequests]);

  const handleCreate = async (payload: AppointmentCreatePayload) => {
    setFormError(null);
    try {
      await createMutation.mutateAsync(payload);
      setShowForm(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError(err.message);
      } else {
        setFormError("Error al crear la cita. Intenta de nuevo.");
      }
    }
  };

  const calendarEvents = [
    ...appointments.map((appt) => ({
      id: appt.id,
      title: SESSION_TYPE_LABELS[appt.session_type] ?? appt.session_type,
      start: appt.scheduled_start,
      end: appt.scheduled_end,
      backgroundColor: STATUS_COLORS[appt.status] ?? "#2E86AB",
      borderColor: STATUS_COLORS[appt.status] ?? "#2E86AB",
      textColor: "#fff",
      extendedProps: { type: "appointment", status: appt.status, modality: appt.modality },
    })),
    ...bookingRequests.map((req) => ({
      id: `br-${req.id}`,
      title: `⏳ ${req.patient_name}`,
      start: req.requested_start,
      end: req.requested_end,
      backgroundColor: "#B8843A",
      borderColor: "#8F5E25",
      textColor: "#fff",
      extendedProps: { type: "booking_request", requestId: req.id },
    })),
  ];

  const totalAppts = appointments.length;
  const pendingRequests = bookingRequests.length;

  return (
    <div className="flex h-[calc(100vh-64px)] gap-0">
      {/* Calendar area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-7 pb-4 shrink-0">
          <div>
            <h1 className="psy-page-title">Agenda</h1>
            <div className="text-[13px] mt-1" style={{ color: "var(--psy-ink-3)" }}>
              {totalAppts} cita{totalAppts !== 1 ? "s" : ""} cargadas
              {pendingRequests > 0 && (
                <> · <span style={{ color: "var(--psy-warn)" }}>{pendingRequests} solicitud{pendingRequests !== 1 ? "es" : ""} pendiente{pendingRequests !== 1 ? "s" : ""}</span></>
              )}
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[13px] font-medium leading-none transition-colors border"
            style={{ background: "var(--psy-primary)", color: "#fff", borderColor: "var(--psy-primary)" }}
            onClick={() => {
              setFormDefaultDate(new Date());
              setFormError(null);
              setShowForm(true);
            }}
          >
            + Nueva cita
          </button>
        </div>

        {/* Calendar card */}
        <div
          className="mx-8 mb-4 rounded-[var(--radius)] overflow-hidden flex-1 flex flex-col min-h-0"
          style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
        >
          {isLoading && <Skeleton className="flex-1" />}
          {isError && !isLoading && (
            <div className="flex-1 flex items-center justify-center">
              <ErrorState message="No se pudieron cargar las citas." />
            </div>
          )}
          {!isLoading && !isError && (
            <div className="flex-1 overflow-hidden psy-calendar-wrap">
              <FullCalendar
                ref={calendarRef}
                plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                locale="es"
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "dayGridMonth,timeGridWeek,timeGridDay",
                }}
                buttonText={{ today: "Hoy", month: "Mes", week: "Semana", day: "Día" }}
                slotMinTime="07:00:00"
                slotMaxTime="21:00:00"
                slotDuration="00:30:00"
                allDaySlot={false}
                selectable
                selectMirror
                events={calendarEvents}
                datesSet={handleDatesSet}
                select={handleDateSelect}
                eventClick={handleEventClick}
                height="100%"
                eventContent={(arg) => (
                  <div className="px-1.5 py-1 overflow-hidden">
                    <div className="text-[11.5px] font-semibold leading-tight truncate">
                      {arg.event.title}
                    </div>
                    <div className="text-[10px] opacity-75 capitalize mt-0.5">
                      {arg.event.extendedProps.modality}
                    </div>
                  </div>
                )}
              />
            </div>
          )}
        </div>

        {/* Legend */}
        <div
          className="flex items-center gap-5 px-8 pb-5 shrink-0 psy-mono text-[11px]"
          style={{ color: "var(--psy-ink-3)" }}
        >
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#2E5E8A" }} /> Confirmada
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#4F7F5A" }} /> Completada
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#B8843A" }} /> Solicitud pendiente
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#B0463A" }} /> Cancelada
          </span>
        </div>
      </div>

      {/* New appointment modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div
            className="rounded-xl shadow-xl w-full max-w-lg my-8 p-6"
            style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="psy-serif text-[22px]" style={{ color: "var(--psy-ink-1)" }}>Nueva cita</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-[18px] leading-none transition-colors"
                style={{ color: "var(--psy-ink-3)" }}
              >
                ✕
              </button>
            </div>
            <AppointmentForm
              defaultDate={formDefaultDate}
              onSubmit={handleCreate}
              isSubmitting={createMutation.isPending}
              error={formError}
            />
          </div>
        </div>
      )}

      {/* Appointment detail sidebar */}
      {selectedAppointmentId && (
        <div
          className="w-80 flex-shrink-0 flex flex-col overflow-y-auto"
          style={{ background: "var(--psy-surface)", borderLeft: "1px solid var(--psy-line)" }}
        >
          <AppointmentSidebar
            appointmentId={selectedAppointmentId}
            onClose={() => setSelectedAppointmentId(null)}
          />
        </div>
      )}

      {/* Booking request sidebar */}
      {selectedBookingRequest && (
        <div
          className="w-80 flex-shrink-0 overflow-y-auto"
          style={{ background: "var(--psy-surface)", borderLeft: "1px solid var(--psy-line)" }}
        >
          <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--psy-line)" }}>
            <h2 className="text-[14px] font-semibold" style={{ color: "var(--psy-ink-1)" }}>Solicitud de cita</h2>
            <button
              type="button"
              onClick={() => setSelectedBookingRequest(null)}
              className="text-[18px] leading-none"
              style={{ color: "var(--psy-ink-3)" }}
            >✕</button>
          </div>
          <div className="p-4 space-y-4">
            <span className="psy-tag psy-tag-amber">Pendiente</span>
            <dl className="space-y-3">
              {[
                { label: "Paciente", value: selectedBookingRequest.patient_name },
                { label: "Email", value: selectedBookingRequest.patient_email },
                ...(selectedBookingRequest.patient_phone ? [{ label: "Teléfono", value: selectedBookingRequest.patient_phone }] : []),
                {
                  label: "Fecha solicitada",
                  value: new Date(selectedBookingRequest.requested_start).toLocaleString("es-CO", {
                    weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
                  }),
                },
                { label: "Tipo", value: selectedBookingRequest.session_type },
                ...(selectedBookingRequest.notes ? [{ label: "Notas", value: selectedBookingRequest.notes }] : []),
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="psy-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--psy-ink-3)" }}>{label}</dt>
                  <dd className="text-[13px] mt-0.5 capitalize" style={{ color: "var(--psy-ink-1)" }}>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                disabled={confirmMutation.isPending}
                onClick={() => confirmMutation.mutate(selectedBookingRequest.id, { onSuccess: () => setSelectedBookingRequest(null) })}
                className="w-full text-[13px] py-2 rounded-md font-medium disabled:opacity-50 transition-colors"
                style={{ background: "var(--psy-ok)", color: "#fff" }}
              >
                {confirmMutation.isPending ? "Confirmando…" : "✓ Confirmar solicitud"}
              </button>
              <button
                type="button"
                disabled={rejectMutation.isPending}
                onClick={() => rejectMutation.mutate(selectedBookingRequest.id, { onSuccess: () => setSelectedBookingRequest(null) })}
                className="w-full text-[13px] py-2 rounded-md font-medium disabled:opacity-50 transition-colors"
                style={{ border: "1px solid var(--psy-line)", color: "var(--psy-danger)" }}
              >
                {rejectMutation.isPending ? "Rechazando…" : "✕ Rechazar"}
              </button>
            </div>
            <p className="text-[11px]" style={{ color: "var(--psy-ink-3)" }}>
              Al confirmar, crea la cita manualmente en la agenda.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}