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
  scheduled: "#2E86AB",
  completed: "#27AE60",
  cancelled: "#E74C3C",
  noshow: "#F39C12",
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
      backgroundColor: "#F39C12",
      borderColor: "#d68910",
      textColor: "#fff",
      extendedProps: { type: "booking_request", requestId: req.id },
    })),
  ];

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Calendar area */}
      <div className="flex-1 p-6 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Agenda</h1>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#2E86AB] hover:bg-[#1E3A5F] text-white text-sm font-medium px-4 py-2"
            onClick={() => {
              setFormDefaultDate(new Date());
              setFormError(null);
              setShowForm(true);
            }}
          >
            + Nueva cita
          </button>
        </div>

        {isLoading && <Skeleton className="flex-1" />}
        {isError && !isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <ErrorState message="No se pudieron cargar las citas." />
          </div>
        )}
        {!isLoading && !isError && (
          <div className="flex-1 overflow-hidden">
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
              buttonText={{
                today: "Hoy",
                month: "Mes",
                week: "Semana",
                day: "Día",
              }}
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
                <div className="px-1 py-0.5 overflow-hidden">
                  <div className="text-xs font-semibold leading-tight truncate">
                    {arg.event.title}
                  </div>
                  <div className="text-xs opacity-80 capitalize">
                    {arg.event.extendedProps.modality}
                  </div>
                </div>
              )}
            />
          </div>
        )}
      </div>

      {/* New appointment form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-8 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-[#1E3A5F]">Nueva cita</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-muted-foreground hover:text-foreground text-xl"
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
        <div className="w-80 border-l bg-white shadow-md flex-shrink-0">
          <AppointmentSidebar
            appointmentId={selectedAppointmentId}
            onClose={() => setSelectedAppointmentId(null)}
          />
        </div>
      )}

      {selectedBookingRequest && (
        <div className="w-80 border-l bg-white shadow-md flex-shrink-0 overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="font-semibold text-[#1E3A5F]">Solicitud de cita</h2>
            <button type="button" onClick={() => setSelectedBookingRequest(null)} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
          </div>
          <div className="p-4 space-y-4">
            <span className="inline-block text-xs px-2 py-0.5 rounded font-medium bg-amber-100 text-amber-800">
              Pendiente
            </span>
            <dl className="space-y-3">
              <div><dt className="text-xs text-muted-foreground uppercase tracking-wide">Paciente</dt>
                <dd className="text-sm font-medium">{selectedBookingRequest.patient_name}</dd></div>
              <div><dt className="text-xs text-muted-foreground uppercase tracking-wide">Email</dt>
                <dd className="text-sm">{selectedBookingRequest.patient_email}</dd></div>
              {selectedBookingRequest.patient_phone && (
                <div><dt className="text-xs text-muted-foreground uppercase tracking-wide">Teléfono</dt>
                  <dd className="text-sm">{selectedBookingRequest.patient_phone}</dd></div>
              )}
              <div><dt className="text-xs text-muted-foreground uppercase tracking-wide">Fecha solicitada</dt>
                <dd className="text-sm">{new Date(selectedBookingRequest.requested_start).toLocaleString("es-CO", {
                  weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
                })}</dd></div>
              <div><dt className="text-xs text-muted-foreground uppercase tracking-wide">Tipo</dt>
                <dd className="text-sm capitalize">{selectedBookingRequest.session_type}</dd></div>
              {selectedBookingRequest.notes && (
                <div><dt className="text-xs text-muted-foreground uppercase tracking-wide">Notas</dt>
                  <dd className="text-sm">{selectedBookingRequest.notes}</dd></div>
              )}
            </dl>
            <div className="flex flex-col gap-2 pt-2">
              <button type="button"
                disabled={confirmMutation.isPending}
                onClick={() => confirmMutation.mutate(selectedBookingRequest.id, { onSuccess: () => setSelectedBookingRequest(null) })}
                className="w-full text-sm py-2 rounded bg-[#27AE60] hover:bg-green-700 text-white font-medium disabled:opacity-50"
              >
                {confirmMutation.isPending ? "Confirmando..." : "✓ Confirmar solicitud"}
              </button>
              <button type="button"
                disabled={rejectMutation.isPending}
                onClick={() => rejectMutation.mutate(selectedBookingRequest.id, { onSuccess: () => setSelectedBookingRequest(null) })}
                className="w-full text-sm py-2 rounded border border-red-300 hover:bg-red-50 text-red-600 font-medium disabled:opacity-50"
              >
                {rejectMutation.isPending ? "Rechazando..." : "✕ Rechazar"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Al confirmar, crea la cita manualmente en la agenda.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}