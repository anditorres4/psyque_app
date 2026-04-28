/**
 * psyque app — UI primitives
 * Reusable atoms aligned with the cálido-tech design system.
 */
import { type ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/* ─────────── Sparkline ─────────── */
export function Sparkline({
  data, color = "var(--psy-sage)", fill = true, width = 80, height = 24,
}: { data: number[]; color?: string; fill?: boolean; width?: number; height?: number }) {
  if (!data.length) return null;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const dFill = `${d} L ${width},${height} L 0,${height} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }}>
      {fill && <path d={dFill} fill={color} fillOpacity="0.15" />}
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2" fill={color} />
    </svg>
  );
}

/* ─────────── KPI ─────────── */
export function KPI({
  label, value, unit, delta, trend, accent, sparkline, sparklineColor, icon,
}: {
  label: ReactNode; value: ReactNode; unit?: string; delta?: string;
  trend?: "up" | "down"; accent?: "ok" | "warn" | "danger" | "info";
  sparkline?: number[]; sparklineColor?: string; icon?: ReactNode;
}) {
  const accentColor = accent ? `var(--psy-${accent})` : undefined;
  return (
    <div
      className="rounded-[var(--radius)] p-4 flex flex-col gap-2"
      style={{
        background: "var(--psy-surface)",
        border: "1px solid var(--psy-line)",
        borderLeft: accentColor ? `3px solid ${accentColor}` : undefined,
      }}
    >
      <div
        className="psy-mono text-[10.5px] uppercase tracking-wider flex items-center gap-1.5"
        style={{ color: accentColor ?? "var(--psy-ink-3)" }}
      >
        {icon}
        {label}
      </div>
      <div className="psy-serif psy-tab-num leading-none" style={{ fontSize: 40, color: "var(--psy-ink-1)", letterSpacing: "-0.02em" }}>
        {value}
        {unit && <span className="ml-1 font-sans not-italic text-sm font-normal" style={{ color: "var(--psy-ink-3)" }}>{unit}</span>}
      </div>
      <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--psy-ink-3)" }}>
        {delta && (
          <span
            className="inline-flex items-center gap-1 psy-mono"
            style={{ color: trend === "up" ? "var(--psy-ok)" : trend === "down" ? "var(--psy-danger)" : undefined }}
          >
            {trend === "up" ? "▲" : trend === "down" ? "▼" : ""} {delta}
          </span>
        )}
        {sparkline && <Sparkline data={sparkline} color={sparklineColor} />}
      </div>
    </div>
  );
}

/* ─────────── Tag ─────────── */
type TagTone = "default" | "sage" | "amber" | "danger" | "info" | "dark";
export function Tag({ tone = "default", children }: { tone?: TagTone; children: ReactNode }) {
  return <span className={cn("psy-tag", tone !== "default" && `psy-tag-${tone}`)}>{children}</span>;
}

/* ─────────── PsyCard ─────────── */
export function PsyCard({
  title, subtitle, action, children, padded = true, className,
}: {
  title?: ReactNode; subtitle?: ReactNode; action?: ReactNode;
  children: ReactNode; padded?: boolean; className?: string;
}) {
  return (
    <div
      className={cn("rounded-[var(--radius)] overflow-hidden", className)}
      style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
    >
      {(title || action) && (
        <div
          className={cn("flex items-center gap-2.5", padded && "px-[18px] py-3.5")}
          style={{ borderBottom: "1px solid var(--psy-line)" }}
        >
          {title && <span className="text-[13px] font-semibold" style={{ color: "var(--psy-ink-1)" }}>{title}</span>}
          {subtitle && (
            <span className="psy-mono text-[11px] uppercase tracking-wide" style={{ color: "var(--psy-ink-3)" }}>
              {subtitle}
            </span>
          )}
          {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={padded ? "p-[18px]" : ""}>{children}</div>
    </div>
  );
}

/* ─────────── AI Card ─────────── */
export function AiCard({ label = "Resumen · IA", children }: { label?: ReactNode; children: ReactNode }) {
  return (
    <div className="psy-ai-card">
      <div
        className="flex items-center gap-1.5 psy-mono text-[10px] uppercase tracking-wider font-semibold mb-2"
        style={{ color: "var(--psy-sage)" }}
      >
        <span className="psy-ai-spark" />
        {label}
      </div>
      <div className="text-[13.5px] leading-[1.55]" style={{ color: "var(--psy-ink-2)" }}>
        {children}
      </div>
    </div>
  );
}

/* ─────────── PageHeader ─────────── */
export function PageHeader({
  title, subtitle, actions,
}: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-end gap-4 mb-6">
      <div>
        <h1 className="psy-page-title">{title}</h1>
        {subtitle && <div className="text-[13px] mt-1.5" style={{ color: "var(--psy-ink-3)" }}>{subtitle}</div>}
      </div>
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ─────────── PsyButton ─────────── */
type BtnVariant = "primary" | "ghost" | "sage";
export function PsyButton({
  variant = "ghost", icon, children, onClick, type = "button", className,
}: {
  variant?: BtnVariant; icon?: ReactNode; children?: ReactNode;
  onClick?: () => void; type?: "button" | "submit"; className?: string;
}) {
  const styles: Record<BtnVariant, React.CSSProperties> = {
    primary: { background: "var(--psy-primary)", color: "#fff", borderColor: "var(--psy-primary)" },
    sage:    { background: "var(--psy-sage)",    color: "#fff", borderColor: "var(--psy-sage)" },
    ghost:   { background: "transparent",         color: "var(--psy-ink-2)", borderColor: "var(--psy-line)" },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[13px] font-medium leading-none transition-colors border",
        className,
      )}
      style={styles[variant]}
    >
      {icon}
      {children}
    </button>
  );
}

/* ─────────── NowClock ─────────── */
export function NowClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="psy-mono psy-tab-num">
      {now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
    </span>
  );
}
