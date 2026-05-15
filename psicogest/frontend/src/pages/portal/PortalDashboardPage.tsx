import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

const SESSION_TYPE_LABELS: Record<string, string> = {
  individual: "Individual", couple: "Pareja", family: "Familia", followup: "Seguimiento",
};
const MODALITY_LABELS: Record<string, string> = {
  presential: "Presencial", virtual: "Virtual",
};

export function PortalDashboardPage() {
  const { data: me } = useQuery({ queryKey: ["portal", "me"], queryFn: () => api.portal.me() });
  const { data: appts, isLoading: loadingAppts } = useQuery({
    queryKey: ["portal", "appointments"],
    queryFn: () => api.portal.appointments(),
  });
  const { data: sessions, isLoading: loadingSessions } = useQuery({
    queryKey: ["portal", "sessions"],
    queryFn: () => api.portal.sessions(),
  });

  const now = new Date();
  const upcoming = (appts ?? [])
    .filter((a) => new Date(a.scheduled_start) > now && a.status === "scheduled")
    .slice(0, 3);
  const recentSessions = (sessions ?? []).slice(0, 3);

  const firstName = me?.full_name.split(" ").find(Boolean);

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="psy-serif text-2xl italic" style={{ color: "var(--psy-ink-1)" }}>
          {firstName ? `Hola, ${firstName}` : "Hola"}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--psy-ink-3)" }}>
          Aquí puedes consultar tus citas, sesiones y facturas.
        </p>
      </div>

      {me?.onboarding_status === "active" && (sessions ?? []).length === 0 && (upcoming ?? []).length === 0 && (
        <div
          className="rounded-xl p-4 border"
          style={{
            background: "var(--psy-primary-faint, #EEF4FF)",
            borderColor: "var(--psy-primary-light, #BFDBFE)",
          }}
        >
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--psy-primary, #1E3A5F)" }}>
            Tu proceso está listo para comenzar
          </p>
          <p className="text-xs" style={{ color: "var(--psy-ink-3)" }}>
            Has completado todos los documentos requeridos. Tu psicólogo agendará la primera sesión contigo.
          </p>
        </div>
      )}

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--psy-ink-4)" }}>
          Próximas citas
        </h2>
        {loadingAppts ? (
          <div className="space-y-2">
            <Skeleton className="h-16" /><Skeleton className="h-16" />
          </div>
        ) : upcoming.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: "var(--psy-ink-4)" }}>Sin citas próximas.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((a) => {
              const d = new Date(a.scheduled_start);
              return (
                <div
                  key={a.id}
                  className="rounded-lg p-4 border"
                  style={{ background: "var(--psy-surface)", borderColor: "var(--psy-line)" }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-sm" style={{ color: "var(--psy-ink-1)" }}>
                        {d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--psy-ink-3)" }}>
                        {d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                        {SESSION_TYPE_LABELS[a.session_type] ?? a.session_type} ·{" "}
                        {MODALITY_LABELS[a.modality] ?? a.modality}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--psy-ink-4)" }}>
          Últimas sesiones
        </h2>
        {loadingSessions ? (
          <div className="space-y-2">
            <Skeleton className="h-12" /><Skeleton className="h-12" />
          </div>
        ) : recentSessions.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: "var(--psy-ink-4)" }}>Sin sesiones registradas.</p>
        ) : (
          <div className="space-y-2">
            {recentSessions.map((s) => {
              const d = new Date(s.actual_start);
              return (
                <div
                  key={s.id}
                  className="rounded-lg p-3 border text-sm"
                  style={{ background: "var(--psy-surface)", borderColor: "var(--psy-line)" }}
                >
                  <span style={{ color: "var(--psy-ink-1)" }}>
                    {d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <span className="ml-2" style={{ color: "var(--psy-ink-3)" }}>
                    {s.diagnosis_cie11}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
