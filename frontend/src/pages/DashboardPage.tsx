import { useDashboardStats } from "@/hooks/useDashboard";
import type { AppointmentSummary } from "@/lib/api";

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

function StatCard({
  label,
  value,
  sublabel,
  accent,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  accent: "blue" | "orange" | "green";
}) {
  const accentClass = {
    blue: "border-l-[#2E86AB]",
    orange: "border-l-amber-500",
    green: "border-l-[#27AE60]",
  }[accent];

  return (
    <div className={`bg-white rounded-lg border border-gray-100 border-l-4 ${accentClass} p-5 shadow-sm`}>
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className="text-3xl font-bold text-[#1E3A5F]">{value}</p>
      {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
    </div>
  );
}

function UpcomingRow({ appt }: { appt: AppointmentSummary }) {
  const start = new Date(appt.scheduled_start);
  const dateStr = start.toLocaleDateString("es-CO", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeStr = start.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3">
        <div className="text-center min-w-[48px]">
          <p className="text-xs text-muted-foreground">{dateStr.split(" ")[0]}</p>
          <p className="text-sm font-semibold text-[#1E3A5F]">{timeStr}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-[#1E3A5F]">
            {SESSION_TYPE_LABELS[appt.session_type] ?? appt.session_type}
          </p>
          <p className="text-xs text-muted-foreground">
            {dateStr} · {MODALITY_LABELS[appt.modality] ?? appt.modality}
          </p>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { data, isLoading, isError } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="p-8 text-[#1E3A5F] text-sm">Cargando...</div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-8 text-[#E74C3C] text-sm">
        Error al cargar el dashboard.
      </div>
    );
  }

  const attendanceDisplay =
    data.attendance_rate_30d !== null ? `${data.attendance_rate_30d}%` : "—";

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Resumen de actividad de tu consulta
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Citas hoy"
          value={data.appointments_today}
          sublabel="Pendientes de atender"
          accent="blue"
        />
        <StatCard
          label="Pendientes de cerrar"
          value={data.pending_to_close}
          sublabel="Pasadas sin marcar como completadas"
          accent="orange"
        />
        <StatCard
          label="Asistencia 30 días"
          value={attendanceDisplay}
          sublabel={data.attendance_rate_30d !== null ? "Completadas / (Completadas + No asistió)" : "Sin datos suficientes"}
          accent="green"
        />
      </div>

      {data.upcoming.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b">
            <h2 className="text-sm font-semibold text-[#1E3A5F] uppercase tracking-wide">
              Próximas citas
            </h2>
          </div>
          <div className="px-5">
            {data.upcoming.map((appt) => (
              <UpcomingRow key={appt.id} appt={appt} />
            ))}
          </div>
        </div>
      )}

      {data.upcoming.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6 text-center text-muted-foreground text-sm">
          No hay citas próximas agendadas.
        </div>
      )}
    </div>
  );
}