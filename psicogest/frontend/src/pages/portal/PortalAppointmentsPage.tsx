import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Video } from "lucide-react";

const SESSION_TYPE_LABELS: Record<string, string> = {
  individual: "Individual", couple: "Pareja", family: "Familia", followup: "Seguimiento",
};
const MODALITY_LABELS: Record<string, string> = {
  presential: "Presencial", virtual: "Virtual",
};
const STATUS_LABELS: Record<string, string> = {
  scheduled: "Programada", completed: "Realizada", cancelled: "Cancelada", noshow: "No asistió",
};
const STATUS_STYLES: Record<string, React.CSSProperties> = {
  scheduled: { background: "#DDE8F1", color: "var(--psy-info)" },
  completed: { background: "var(--psy-sage-bg)", color: "var(--psy-ok)" },
  cancelled: { background: "var(--psy-bg-soft)", color: "var(--psy-ink-3)" },
  noshow: { background: "#F5EBD8", color: "var(--psy-warn)" },
};

export function PortalAppointmentsPage() {
  const { data: appts, isLoading } = useQuery({
    queryKey: ["portal", "appointments"],
    queryFn: () => api.portal.appointments(),
  });

  return (
    <div className="space-y-5 pb-12">
      <h1 className="psy-serif text-2xl italic" style={{ color: "var(--psy-ink-1)" }}>Mis citas</h1>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : !appts || appts.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: "var(--psy-ink-3)" }}>
          No hay citas registradas.
        </p>
      ) : (
        <div className="space-y-2">
          {appts.map((a) => {
            const d = new Date(a.scheduled_start);
            return (
              <div
                key={a.id}
                className="rounded-lg p-4 border"
                style={{ background: "var(--psy-surface)", borderColor: "var(--psy-line)" }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "var(--psy-ink-1)" }}>
                      {d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--psy-ink-3)" }}>
                      {d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                      {SESSION_TYPE_LABELS[a.session_type] ?? a.session_type} ·{" "}
                      {MODALITY_LABELS[a.modality] ?? a.modality}
                    </p>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded font-medium psy-mono"
                    style={STATUS_STYLES[a.status] ?? { background: "var(--psy-bg-soft)", color: "var(--psy-ink-3)" }}
                  >
                    {STATUS_LABELS[a.status] ?? a.status}
                  </span>
                </div>
                {a.patient_join_key && a.status === "scheduled" && (
                  <a
                    href={`/join/${a.id}?k=${encodeURIComponent(a.patient_join_key)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 flex items-center gap-2 justify-center w-full py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: "var(--psy-primary, #1E3A5F)" }}
                  >
                    <Video size={14} />
                    Unirme a la sesión virtual
                  </a>
                )}
                {a.notes && (
                  <p className="text-xs mt-2 border-t pt-2" style={{ color: "var(--psy-ink-3)", borderColor: "var(--psy-line)" }}>
                    {a.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
