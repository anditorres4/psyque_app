import { useRef, useState, useCallback, useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  DateSelectArg,
  EventClickArg,
  DatesSetArg,
  EventDropArg,
  EventHoveringArg,
} from "@fullcalendar/core";
import {
  useAppointmentsByRange,
  useCreateAppointment,
  useRescheduleAppointment,
} from "@/hooks/useAppointments";
import {
  useBookingRequests,
  useConfirmBookingRequest,
  useRejectBookingRequest,
  useResendRegistration,
} from "@/hooks/useBooking";
import { useAvailability } from "@/hooks/useAvailability";
import { AppointmentForm } from "@/components/appointments/AppointmentForm";
import { AppointmentSidebar } from "@/components/appointments/AppointmentSidebar";
import { MiniCalendar } from "@/components/agenda/MiniCalendar";
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

const MODALITY_LABELS: Record<string, string> = {
  presential: "Presencial",
  virtual: "Virtual",
};

const STATUS_FILTERS = [
  { id: null, label: "Todas" },
  { id: "scheduled", label: "Confirmadas" },
  { id: "completed", label: "Completadas" },
  { id: "booking_request", label: "Solicitudes" },
  { id: "cancelled", label: "Canceladas" },
] as const;

type StatusFilterId = (typeof STATUS_FILTERS)[number]["id"];

export function AgendaPage() {
  const calendarRef = useRef<FullCalendar>(null);

  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  const { data: appointments = [], isLoading, isError } = useAppointmentsByRange(rangeStart, rangeEnd);
  const { data: availabilityBlocks = [] } = useAvailability();
  const createMutation = useCreateAppointment();
  const rescheduleMutation = useRescheduleAppointment();

  const [showForm, setShowForm] = useState(false);
  const [formDefaultDate, setFormDefaultDate] = useState<Date | undefined>();
  const [formError, setFormError] = useState<string | null>(null);

  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [selectedBookingRequest, setSelectedBookingRequest] = useState<BookingRequestSummary | null>(null);
  const [selectedRegistrationRequest, setSelectedRegistrationRequest] = useState<BookingRequestSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterId>(null);

  type TooltipData = { x: number; y: number; title: string; modality: string; sessionSigned: boolean | null | undefined };
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const { data: bookingRequests = [] } = useBookingRequests("pending");
  const { data: confirmedRequests = [] } = useBookingRequests("confirmed");
  const registrationPendingRequests = confirmedRequests.filter((r) => r.registration_pending);
  const confirmMutation = useConfirmBookingRequest();
  const rejectMutation = useRejectBookingRequest();
  const resendMutation = useResendRegistration();

  const handleDatesSet = useCallback((info: DatesSetArg) => {
    setRangeStart(info.start.toISOString());
    setRangeEnd(info.end.toISOString());
  }, []);

  const handleDateSelect = useCallback((info: DateSelectArg) => {
    setFormDefaultDate(info.start);
    setFormError(null);
    setShowForm(true);
  }, []);

  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      setTooltip(null);
      const { type, requestId } = info.event.extendedProps as { type?: string; requestId?: string };
      if (type === "booking_request") {
        const req = bookingRequests.find((r) => r.id === requestId) ?? null;
        setSelectedBookingRequest(req);
        setSelectedAppointmentId(null);
        setSelectedRegistrationRequest(null);
      } else if (type === "registration_pending") {
        const req = registrationPendingRequests.find((r) => r.id === requestId) ?? null;
        setSelectedRegistrationRequest(req);
        setSelectedBookingRequest(null);
        setSelectedAppointmentId(null);
      } else {
        setSelectedAppointmentId(info.event.id);
        setSelectedBookingRequest(null);
        setSelectedRegistrationRequest(null);
      }
    },
    [bookingRequests, registrationPendingRequests]
  );

  const handleEventDrop = useCallback(
    (info: EventDropArg) => {
      const ep = info.event.extendedProps as { type?: string; status?: string };
      if (ep.type !== "appointment") { info.revert(); return; }
      if (ep.status === "completed" || ep.status === "cancelled" || ep.status === "noshow") {
        info.revert();
        return;
      }
      if (!info.event.start || !info.event.end) { info.revert(); return; }
      rescheduleMutation.mutate(
        {
          id: info.event.id,
          start: info.event.start.toISOString(),
          end: info.event.end.toISOString(),
        },
        { onError: () => info.revert() }
      );
    },
    [rescheduleMutation]
  );

  const handleEventMouseEnter = useCallback((info: EventHoveringArg) => {
    const ep = info.event.extendedProps as { type?: string; modality?: string; session_signed?: boolean | null };
    if (ep.type !== "appointment") return;
    const rect = (info.el as HTMLElement).getBoundingClientRect();
    setTooltip({
      x: rect.left,
      y: rect.bottom + 6,
      title: info.event.title,
      modality: ep.modality ?? "",
      sessionSigned: ep.session_signed,
    });
  }, []);

  const handleEventMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

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

  // Business hours from availability blocks (A)
  const businessHours = useMemo(() => {
    if (!availabilityBlocks.length) return false;
    // Our day_of_week: 0=Mon..6=Sun → FullCalendar: 0=Sun..6=Sat
    return availabilityBlocks.map((b) => ({
      daysOfWeek: [(b.day_of_week + 1) % 7],
      startTime: b.start_time.slice(0, 5),
      endTime: b.end_time.slice(0, 5),
    }));
  }, [availabilityBlocks]);

  // Dynamic slot range — default 07:00–21:00, expand for outlier appointments (G)
  const { slotMinTime, slotMaxTime } = useMemo(() => {
    let minH = 7;
    let maxH = 21;
    appointments.forEach((a) => {
      const start = new Date(a.scheduled_start);
      const end = new Date(a.scheduled_end);
      const sh = start.getHours();
      const eh = end.getHours() + (end.getMinutes() > 0 ? 1 : 0);
      if (sh < minH) minH = Math.max(4, sh);
      if (eh > maxH) maxH = Math.min(22, eh);
    });
    return {
      slotMinTime: `${String(minH).padStart(2, "0")}:00:00`,
      slotMaxTime: `${String(maxH).padStart(2, "0")}:00:00`,
    };
  }, [appointments]);

  const calendarEvents = useMemo(
    () => [
      ...appointments.map((appt) => ({
        id: appt.id,
        title: appt.patient_name
          ? `${appt.patient_name} — ${SESSION_TYPE_LABELS[appt.session_type] ?? appt.session_type}`
          : SESSION_TYPE_LABELS[appt.session_type] ?? appt.session_type,
        start: appt.scheduled_start,
        end: appt.scheduled_end,
        backgroundColor: STATUS_COLORS[appt.status] ?? "#2E86AB",
        borderColor: STATUS_COLORS[appt.status] ?? "#2E86AB",
        textColor: "#fff",
        editable: appt.status === "scheduled",
        extendedProps: {
          type: "appointment",
          status: appt.status,
          modality: appt.modality,
          session_signed: appt.session_signed,
        },
      })),
      ...bookingRequests.map((req) => ({
        id: `br-${req.id}`,
        title: `⏳ ${req.patient_name}`,
        start: req.requested_start,
        end: req.requested_end,
        backgroundColor: "#B8843A",
        borderColor: "#8F5E25",
        textColor: "#fff",
        editable: false,
        extendedProps: { type: "booking_request", requestId: req.id },
      })),
      ...registrationPendingRequests.map((req) => ({
        id: `rp-${req.id}`,
        title: `📋 ${req.patient_name}`,
        start: req.requested_start,
        end: req.requested_end,
        backgroundColor: "#7C4DFF",
        borderColor: "#5B2ECC",
        textColor: "#fff",
        editable: false,
        extendedProps: { type: "registration_pending", requestId: req.id },
      })),
    ],
    [appointments, bookingRequests, registrationPendingRequests]
  );

  // Status filter (E)
  const filteredCalendarEvents = useMemo(() => {
    if (!statusFilter) return calendarEvents;
    if (statusFilter === "booking_request") {
      return calendarEvents.filter(
        (e) =>
          e.extendedProps.type === "booking_request" ||
          e.extendedProps.type === "registration_pending"
      );
    }
    return calendarEvents.filter(
      (e) => e.extendedProps.type === "appointment" && e.extendedProps.status === statusFilter
    );
  }, [calendarEvents, statusFilter]);

  const totalAppts = appointments.length;
  const pendingRequests = bookingRequests.length;
  const anySidebarOpen = !!(selectedAppointmentId || selectedBookingRequest || selectedRegistrationRequest);

  return (
    <div className="flex h-[calc(100vh-64px)] gap-0">
      {/* Calendar area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-7 pb-3 shrink-0">
          <div>
            <h1 className="psy-page-title">Agenda</h1>
            <div className="text-[13px] mt-1" style={{ color: "var(--psy-ink-3)" }}>
              {totalAppts} cita{totalAppts !== 1 ? "s" : ""} cargadas
              {pendingRequests > 0 && (
                <> · <span style={{ color: "var(--psy-warn)" }}>{pendingRequests} solicitud{pendingRequests !== 1 ? "es" : ""} pendiente{pendingRequests !== 1 ? "s" : ""}</span></>
              )}
              {registrationPendingRequests.length > 0 && (
                <> · <span style={{ color: "#7C4DFF" }}>{registrationPendingRequests.length} registro{registrationPendingRequests.length !== 1 ? "s" : ""} pendiente{registrationPendingRequests.length !== 1 ? "s" : ""}</span></>
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

        {/* Status filter chips (E) */}
        <div className="flex items-center gap-2 px-8 pb-3 shrink-0 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={String(f.id)}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className="text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors border"
              style={
                statusFilter === f.id
                  ? { background: "var(--psy-primary)", color: "#fff", borderColor: "var(--psy-primary)" }
                  : { background: "var(--psy-surface)", color: "var(--psy-ink-2)", borderColor: "var(--psy-line)" }
              }
            >
              {f.label}
            </button>
          ))}
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
                slotMinTime={slotMinTime}
                slotMaxTime={slotMaxTime}
                slotDuration="00:30:00"
                allDaySlot={false}
                selectable
                selectMirror
                editable
                eventDrop={handleEventDrop}
                businessHours={businessHours}
                events={filteredCalendarEvents}
                datesSet={handleDatesSet}
                select={handleDateSelect}
                eventClick={handleEventClick}
                eventMouseEnter={handleEventMouseEnter}
                eventMouseLeave={handleEventMouseLeave}
                height="100%"
                eventContent={(arg) => {
                  const ep = arg.event.extendedProps as {
                    modality?: string;
                    session_signed?: boolean | null;
                    type?: string;
                  };
                  const showDot = ep.type === "appointment" && ep.session_signed === false;
                  return (
                    <div className="px-1.5 py-1 overflow-hidden">
                      <div className="text-[11.5px] font-semibold leading-tight truncate flex items-center gap-1">
                        <span className="truncate">{arg.event.title}</span>
                        {showDot && (
                          <span
                            className="shrink-0 w-1.5 h-1.5 rounded-full inline-block"
                            style={{ background: "#f87171" }}
                            title="Sesión sin firmar"
                          />
                        )}
                      </div>
                      {ep.modality && (
                        <div className="text-[10px] opacity-75 capitalize mt-0.5">
                          {MODALITY_LABELS[ep.modality] ?? ep.modality}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
            </div>
          )}
        </div>

        {/* Legend */}
        <div
          className="flex items-center gap-5 px-8 pb-5 shrink-0 psy-mono text-[11px] flex-wrap"
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
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#7C4DFF" }} /> Registro pendiente
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#f87171" }} /> Sesión sin firmar
          </span>
        </div>
      </div>

      {/* Mini-calendar sidebar (B) — hidden when another sidebar is open */}
      {!anySidebarOpen && (
        <div
          className="w-48 flex-shrink-0 overflow-y-auto py-5 px-3"
          style={{ borderLeft: "1px solid var(--psy-line)" }}
        >
          <MiniCalendar
            appointments={appointments}
            onDayClick={(date) => {
              const api = calendarRef.current?.getApi();
              if (api) { api.changeView("timeGridDay", date); }
            }}
          />
        </div>
      )}

      {/* Tooltip (F) */}
      {tooltip && (
        <div
          className="fixed z-50 rounded-lg shadow-lg px-3 py-2 text-[12px] pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            background: "var(--psy-surface)",
            border: "1px solid var(--psy-line)",
            color: "var(--psy-ink-1)",
            maxWidth: 220,
          }}
        >
          <div className="font-semibold leading-snug mb-1">{tooltip.title}</div>
          <div className="text-[11px]" style={{ color: "var(--psy-ink-3)" }}>
            {MODALITY_LABELS[tooltip.modality] ?? tooltip.modality}
          </div>
          {tooltip.sessionSigned === false && (
            <div className="flex items-center gap-1 mt-1 text-[11px]" style={{ color: "#ef4444" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
              Sesión sin firmar
            </div>
          )}
        </div>
      )}

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
            <button type="button" onClick={() => setSelectedBookingRequest(null)} className="text-[18px] leading-none" style={{ color: "var(--psy-ink-3)" }}>✕</button>
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
              Si el paciente ya está registrado con ese email, la cita se agrega automáticamente a la agenda. Si no, se enviará un email al paciente para que complete su registro.
            </p>
          </div>
        </div>
      )}

      {/* Registration pending sidebar */}
      {selectedRegistrationRequest && (
        <div
          className="w-80 flex-shrink-0 overflow-y-auto"
          style={{ background: "var(--psy-surface)", borderLeft: "1px solid var(--psy-line)" }}
        >
          <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--psy-line)" }}>
            <h2 className="text-[14px] font-semibold" style={{ color: "var(--psy-ink-1)" }}>Registro pendiente</h2>
            <button type="button" onClick={() => setSelectedRegistrationRequest(null)} className="text-[18px] leading-none" style={{ color: "var(--psy-ink-3)" }}>✕</button>
          </div>
          <div className="p-4 space-y-4">
            <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#EDE7FF", color: "#5B2ECC" }}>
              📋 Esperando datos del paciente
            </span>
            <dl className="space-y-3">
              {[
                { label: "Paciente", value: selectedRegistrationRequest.patient_name },
                { label: "Email", value: selectedRegistrationRequest.patient_email },
                ...(selectedRegistrationRequest.patient_phone ? [{ label: "Teléfono", value: selectedRegistrationRequest.patient_phone }] : []),
                {
                  label: "Cita reservada",
                  value: new Date(selectedRegistrationRequest.requested_start).toLocaleString("es-CO", {
                    weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
                  }),
                },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="psy-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--psy-ink-3)" }}>{label}</dt>
                  <dd className="text-[13px] mt-0.5" style={{ color: "var(--psy-ink-1)" }}>{value}</dd>
                </div>
              ))}
              {selectedRegistrationRequest.registration_token_expires_at && (
                <div>
                  <dt className="psy-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--psy-ink-3)" }}>Enlace válido hasta</dt>
                  <dd
                    className="text-[13px] mt-0.5"
                    style={{
                      color: new Date(selectedRegistrationRequest.registration_token_expires_at) < new Date()
                        ? "var(--psy-danger)" : "var(--psy-ink-1)",
                    }}
                  >
                    {new Date(selectedRegistrationRequest.registration_token_expires_at) < new Date()
                      ? "⚠ Expirado"
                      : new Date(selectedRegistrationRequest.registration_token_expires_at).toLocaleString("es-CO", {
                          day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
                        })
                    }
                  </dd>
                </div>
              )}
            </dl>
            <button
              type="button"
              disabled={resendMutation.isPending}
              onClick={() =>
                resendMutation.mutate(selectedRegistrationRequest.id, {
                  onSuccess: (updated) => setSelectedRegistrationRequest(updated),
                })
              }
              className="w-full text-[13px] py-2 rounded-md font-medium disabled:opacity-50 transition-colors"
              style={{ background: "#7C4DFF", color: "#fff" }}
            >
              {resendMutation.isPending ? "Enviando..." : "↩ Reenviar email de registro"}
            </button>
            <p className="text-[11px]" style={{ color: "var(--psy-ink-3)" }}>
              El paciente recibirá un nuevo enlace válido por 48 horas.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
