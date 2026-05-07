import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

const CUPS_LABELS: Record<string, string> = {
  "890101": "Primera vez",
  "890102": "Control",
  "890403": "Psicoterapia individual adultos",
  "890404": "Psicoterapia individual niños/adolescentes",
  "890601": "Psicoterapia de pareja",
  "890701": "Psicoterapia familiar",
};

export function PortalSessionsPage() {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["portal", "sessions"],
    queryFn: () => api.portal.sessions(),
  });

  return (
    <div className="space-y-5 pb-12">
      <div>
        <h1 className="psy-serif text-2xl italic" style={{ color: "var(--psy-ink-1)" }}>Mis sesiones</h1>
        <p className="text-xs mt-1" style={{ color: "var(--psy-ink-4)" }}>
          Solo sesiones firmadas por tu psicólogo.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: "var(--psy-ink-3)" }}>
          No hay sesiones registradas.
        </p>
      ) : (
        <div className="divide-y rounded-lg border overflow-hidden" style={{ borderColor: "var(--psy-line)" }}>
          {sessions.map((s) => {
            const d = new Date(s.actual_start);
            return (
              <div
                key={s.id}
                className="px-4 py-3"
                style={{ background: "var(--psy-surface)" }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium" style={{ color: "var(--psy-ink-1)" }}>
                    {d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  <span className="text-xs psy-mono" style={{ color: "var(--psy-ink-3)" }}>
                    {d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: "var(--psy-ink-3)" }}>
                  {s.diagnosis_cie11} · {CUPS_LABELS[s.cups_code] ?? s.cups_code}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
