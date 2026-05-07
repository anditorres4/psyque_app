import type { TriageUrgency } from "@/lib/api";

const URGENCY_CONFIG: Record<TriageUrgency, { label: string; style: React.CSSProperties }> = {
  low: {
    label: "Bajo",
    style: { background: "var(--psy-sage-bg)", color: "var(--psy-ok)" },
  },
  medium: {
    label: "Moderado",
    style: { background: "#F5EBD8", color: "var(--psy-warn)" },
  },
  high: {
    label: "Alto",
    style: { background: "color-mix(in srgb, var(--psy-warn) 18%, var(--psy-surface))", color: "var(--psy-warn)" },
  },
  critical: {
    label: "CRÍTICO",
    style: { background: "color-mix(in srgb, var(--psy-danger) 15%, var(--psy-surface))", color: "var(--psy-danger)" },
  },
};

export function TriageBadge({ urgency }: { urgency: TriageUrgency | null }) {
  if (!urgency) return null;
  const config = URGENCY_CONFIG[urgency];
  return (
    <span
      className="text-xs px-2 py-0.5 rounded font-semibold psy-mono"
      style={config.style}
    >
      {config.label}
    </span>
  );
}
