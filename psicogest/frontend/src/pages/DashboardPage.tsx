import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, ChevronRight } from "lucide-react";
import { useDashboardStats, useTopDiagnoses } from "@/hooks/useDashboard";
import { useSessions } from "@/hooks/useSessions";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { KPI, PsyCard, AiCard, PageHeader, PsyButton, Tag } from "@/components/ui/psy";
import type { AppointmentSummary } from "@/lib/api";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 18) return "Buenas tardes";
  return "Buenas noches";
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  individual: "Individual", couple: "Pareja", family: "Familia", followup: "Seguimiento",
};

function UpcomingRow({ appt }: { appt: AppointmentSummary }) {
  const navigate = useNavigate();
  const start = new Date(appt.scheduled_start);
  const timeStr = start.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false });
  const dateStr = start.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });

  return (
    <button
      type="button"
      className="grid w-full items-center gap-3 py-3 px-[18px] border-b last:border-0 transition-colors hover:bg-[var(--psy-bg-soft)] text-left"
      style={{ gridTemplateColumns: "64px 1fr auto auto" }}
      onClick={() => navigate(`/sessions?new&appointment_id=${appt.id}`)}
    >
      <div>
        <div className="psy-mono psy-tab-num text-[18px] font-semibold leading-tight" style={{ color: "var(--psy-ink-1)" }}>
          {timeStr}
        </div>
        <div className="psy-mono text-[10px]" style={{ color: "var(--psy-ink-3)" }}>50 min</div>
      </div>
      <div>
        <div className="text-[13.5px] font-semibold" style={{ color: "var(--psy-ink-1)" }}>
          {SESSION_TYPE_LABELS[appt.session_type] ?? appt.session_type}
        </div>
        <div className="psy-mono text-[11px] mt-0.5" style={{ color: "var(--psy-ink-3)" }}>{dateStr}</div>
      </div>
      <Tag tone={appt.modality === "virtual" ? "info" : "sage"}>{appt.modality}</Tag>
      <ChevronRight size={14} style={{ color: "var(--psy-ink-3)" }} />
    </button>
  );
}

function TopDiagnosesCompact() {
  const [months, setMonths] = useState<3 | 6 | 12>(3);
  const { data } = useTopDiagnoses(months);

  return (
    <PsyCard
      title="Diagnósticos frecuentes"
      subtitle={`últimos ${months}m`}
      action={
        <div className="flex gap-1">
          {([3, 6, 12] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMonths(m)}
              className="psy-mono text-[10.5px] px-2 py-1 rounded transition-colors"
              style={{
                background: months === m ? "var(--psy-primary)" : "transparent",
                color: months === m ? "#fff" : "var(--psy-ink-3)",
              }}
            >
              {m}m
            </button>
          ))}
        </div>
      }
    >
      {!data || data.data.length === 0 ? (
        <div className="text-[12px] py-2 text-center" style={{ color: "var(--psy-ink-3)" }}>
          Sin datos para este período.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {data.data.slice(0, 4).map((item, i) => (
            <div key={item.diagnosis_cie11} className="flex items-center gap-3">
              <span className="psy-mono text-[10px] font-semibold w-4 text-right shrink-0" style={{ color: "var(--psy-ink-4)" }}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-medium truncate" style={{ color: "var(--psy-ink-1)" }}>
                  {item.diagnosis_description}
                </div>
                <div className="psy-mono text-[10px]" style={{ color: "var(--psy-ink-3)" }}>
                  {item.diagnosis_cie11}
                </div>
              </div>
              <span className="psy-mono psy-tab-num text-[12px] font-semibold shrink-0" style={{ color: "var(--psy-ink-2)" }}>
                {item.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </PsyCard>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useDashboardStats();
  const { data: sessionsData } = useSessions({ status: "draft" });
  const draftSessions = sessionsData?.items ?? [];

  const today = new Date().toLocaleDateString("es-CO", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-12 w-64" />
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="psy-grid-split">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return <ErrorState onRetry={() => window.location.reload()} />;
  }

  const attendanceVal = data.attendance_rate_30d !== null ? Math.round(data.attendance_rate_30d) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${greeting()}.`}
        subtitle={`${today.charAt(0).toUpperCase()}${today.slice(1)} · ${data.appointments_today} cita${data.appointments_today !== 1 ? "s" : ""} hoy${draftSessions.length > 0 ? ` · ${draftSessions.length} sesión activa en curso` : ""}`}
        actions={
          <PsyButton variant="ghost" icon={<Download size={14} />}>Exportar día</PsyButton>
        }
      />

      <AiCard>
        Hoy tienes <em>{data.appointments_today} cita{data.appointments_today !== 1 ? "s" : ""}</em>.
        {data.pending_to_close > 0 && (
          <> Tienes <strong>{data.pending_to_close} nota{data.pending_to_close !== 1 ? "s" : ""} pendiente{data.pending_to_close !== 1 ? "s" : ""}</strong> de sesiones anteriores sin cerrar.</>
        )}
        {attendanceVal !== null && (
          <> Asistencia últimos 30 días: <strong style={{ color: "var(--psy-ok)" }}>{attendanceVal}%</strong>.</>
        )}
      </AiCard>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI
          label="Citas hoy"
          value={data.appointments_today}
          accent="info"
        />
        <KPI
          label="Notas por cerrar"
          value={data.pending_to_close}
          delta={data.pending_to_close > 0 ? "requieren atención" : "al día"}
          trend={data.pending_to_close > 0 ? "down" : undefined}
          accent={data.pending_to_close > 0 ? "warn" : "ok"}
        />
        <KPI
          label="Asistencia 30d"
          value={attendanceVal ?? "—"}
          unit={attendanceVal !== null ? "%" : undefined}
          accent="ok"
        />
        <KPI
          label="Sesiones abiertas"
          value={draftSessions.length}
          delta={draftSessions.length > 0 ? "en curso" : "ninguna"}
          accent={draftSessions.length > 0 ? "warn" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
        {/* Upcoming appointments */}
        <PsyCard
          title="Próximas citas"
          subtitle={`${data.upcoming.length} pendientes`}
          padded={false}
          action={
            <PsyButton
              variant="primary"
              icon={<span className="text-[16px] leading-none">+</span>}
              onClick={() => navigate("/agenda")}
            >
              Nueva cita
            </PsyButton>
          }
        >
          {data.upcoming.length === 0 ? (
            <div className="py-12 text-center text-[13px]" style={{ color: "var(--psy-ink-3)" }}>
              No hay citas próximas agendadas.
            </div>
          ) : (
            data.upcoming.slice(0, 5).map((appt) => (
              <UpcomingRow key={appt.id} appt={appt} />
            ))
          )}
        </PsyCard>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Active session card */}
          {draftSessions.length > 0 ? (
            <div
              className="rounded-[var(--radius)] p-5 relative overflow-hidden cursor-pointer"
              style={{ background: "linear-gradient(135deg, var(--psy-primary) 0%, #14365C 100%)", color: "#fff" }}
              onClick={() => navigate("/sessions")}
            >
              <div
                className="absolute top-0 right-0 w-32 h-32 pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(124,152,133,0.3), transparent 70%)" }}
              />
              <div className="flex items-center gap-2 mb-3">
                <span className="psy-live-dot" style={{ background: "#9DD4A4", boxShadow: "0 0 0 3px rgba(157,212,164,0.25)" }} />
                <span className="psy-mono text-[10px] uppercase tracking-widest" style={{ opacity: 0.8 }}>
                  Sesión activa en curso
                </span>
              </div>
              <div className="text-[17px] font-semibold">
                {draftSessions.length} nota{draftSessions.length !== 1 ? "s" : ""} en borrador
              </div>
              <div className="psy-mono text-[11px] mt-1" style={{ opacity: 0.7 }}>
                {draftSessions[0]?.cups_code ? `CUPS ${draftSessions[0].cups_code}` : "Abiertas sin firmar"}
              </div>
              <div
                className="mt-4 text-center text-[13px] py-2 rounded-md font-medium"
                style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)" }}
              >
                Volver a sesiones →
              </div>
            </div>
          ) : (
            <div
              className="rounded-[var(--radius)] p-5 flex flex-col items-center justify-center gap-2"
              style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)", minHeight: 110 }}
            >
              <div className="psy-mono text-[11px] uppercase tracking-wide" style={{ color: "var(--psy-ink-3)" }}>
                Sin sesión activa
              </div>
            </div>
          )}

          {/* Pending notes warning */}
          {data.pending_to_close > 0 && (
            <div
              className="rounded-[var(--radius)] p-4"
              style={{
                background: "color-mix(in srgb, var(--psy-warn) 8%, var(--psy-surface))",
                border: "1px solid color-mix(in srgb, var(--psy-warn) 30%, var(--psy-line))",
              }}
            >
              <div className="text-[13px] font-semibold mb-1" style={{ color: "var(--psy-warn)" }}>
                {data.pending_to_close} nota{data.pending_to_close !== 1 ? "s" : ""} pendiente{data.pending_to_close !== 1 ? "s" : ""}
              </div>
              <div className="text-[12.5px]" style={{ color: "var(--psy-ink-2)" }}>
                Sesiones pasadas sin cerrar. Ciérralas para mantener el historial al día.
              </div>
              <button
                type="button"
                onClick={() => navigate("/sessions")}
                className="mt-3 text-[12px] font-medium"
                style={{ color: "var(--psy-warn)" }}
              >
                Cerrar ahora →
              </button>
            </div>
          )}

          <TopDiagnosesCompact />
        </div>
      </div>
    </div>
  );
}
