import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  agenda: "Agenda",
  patients: "Pacientes",
  sessions: "Sesiones activas",
  rips: "RIPS",
  invoices: "Facturas",
  bulk: "Facturación en masa",
  caja: "Caja",
  cartera: "Cartera",
  reports: "Reportes",
  settings: "Configuración",
};

function NowClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const t = now.toLocaleTimeString("es-CO", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  return <span className="psy-mono psy-tab-num">{t}</span>;
}

export function Topbar() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);
  const crumbs = ["psyque", ...segments.map((s) => ROUTE_LABELS[s] ?? s)];

  return (
    <div
      className="sticky top-0 z-10 flex items-center gap-3 px-7 py-3.5"
      style={{ background: "var(--psy-surface)", borderBottom: "1px solid var(--psy-line)" }}
    >
      <div
        className="psy-mono text-[11px] uppercase tracking-wide flex items-center gap-1.5"
        style={{ color: "var(--psy-ink-3)" }}
      >
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span>/</span>}
            <span style={{
              color: i === crumbs.length - 1 ? "var(--psy-ink-1)" : undefined,
              fontWeight: i === crumbs.length - 1 ? 500 : undefined,
            }}>
              {c}
            </span>
          </span>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2.5">
        <div
          className="flex items-center gap-2 px-2.5 py-1 rounded-full psy-mono text-[11px]"
          style={{
            background: "var(--psy-bg-soft)",
            border: "1px solid var(--psy-line)",
            color: "var(--psy-ink-3)",
          }}
        >
          <span className="psy-live-dot" />
          <NowClock />
          <span style={{ opacity: 0.5 }}>·</span>
          <span>BOG</span>
        </div>
      </div>
    </div>
  );
}
