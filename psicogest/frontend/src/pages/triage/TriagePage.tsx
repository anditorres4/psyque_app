import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTriage } from "@/hooks/useTriage";
import { TriageBadge } from "@/components/triage/TriageBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/psy";
import type { TriageSessionOut } from "@/lib/api";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = [
  { value: "", label: "Todos" },
  { value: "escalated", label: "Críticos" },
  { value: "completed", label: "Completados" },
];

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  completed: "Completado",
  escalated: "Escalado",
};

function TriageRow({ session }: { session: TriageSessionOut }) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(session.created_at);
  const isCritical = session.urgency_level === "critical";

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden",
        isCritical && "border-[var(--psy-danger)]"
      )}
      style={{ borderColor: isCritical ? undefined : "var(--psy-line)" }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        className="flex flex-wrap items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--psy-bg-soft)] transition-colors"
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => e.key === "Enter" && setExpanded((v) => !v)}
      >
        {expanded
          ? <ChevronDown size={14} className="shrink-0" style={{ color: "var(--psy-ink-3)" }} />
          : <ChevronRight size={14} className="shrink-0" style={{ color: "var(--psy-ink-3)" }} />
        }

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-semibold text-sm" style={{ color: "var(--psy-ink-1)" }}>
              {session.patient_name}
            </span>
            <span className="psy-mono text-xs" style={{ color: "var(--psy-ink-3)" }}>
              {session.patient_phone}
            </span>
            <TriageBadge urgency={session.urgency_level} />
            <span
              className="text-xs px-2 py-0.5 rounded psy-mono"
              style={
                session.status === "escalated"
                  ? { background: "#F5DDD9", color: "var(--psy-danger)" }
                  : { background: "var(--psy-bg-soft)", color: "var(--psy-ink-3)" }
              }
            >
              {STATUS_LABELS[session.status] ?? session.status}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 text-xs" style={{ color: "var(--psy-ink-3)" }}>
            <span>
              {date.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
              {" · "}
              {date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
            </span>
            {session.phq9_score !== null && (
              <span className="psy-mono">PHQ-9: {session.phq9_score}/27</span>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div
          className="px-4 pb-4 pt-2 space-y-3 border-t"
          style={{ background: "var(--psy-bg)", borderColor: "var(--psy-line)" }}
        >
          {session.summary && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "var(--psy-ink-3)" }}>
                Resumen
              </p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--psy-ink-1)" }}>
                {session.summary}
              </p>
            </div>
          )}
          {session.phq9_item9_score !== null && session.phq9_item9_score > 0 && (
            <div
              className="rounded-md p-3 text-sm"
              style={{
                background: "color-mix(in srgb, var(--psy-danger) 8%, var(--psy-surface))",
                color: "var(--psy-danger)",
              }}
            >
              <strong>Atención:</strong> Ítem 9 PHQ-9 (pensamientos de autolesión): {session.phq9_item9_score}/3.
              Se recomienda contacto inmediato. Línea 106 (Colombia).
            </div>
          )}
          {session.responses.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "var(--psy-ink-3)" }}>
                Respuestas PHQ-9
              </p>
              <div className="space-y-1">
                {(session.responses as { item: number; question: string; score: number }[]).map((r) => (
                  <div key={r.item} className="flex items-start gap-3 text-xs">
                    <span className="psy-mono shrink-0 w-6 text-right" style={{ color: "var(--psy-ink-3)" }}>
                      {r.item}.
                    </span>
                    <span className="flex-1" style={{ color: "var(--psy-ink-2)" }}>{r.question}</span>
                    <span className="psy-mono font-semibold shrink-0" style={{ color: "var(--psy-ink-1)" }}>
                      {r.score}/3
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TriagePage() {
  const [filterStatus, setFilterStatus] = useState("");
  const { data, isLoading } = useTriage(filterStatus ? { status: filterStatus } : undefined);

  const items = data?.items ?? [];
  const criticalCount = items.filter((s) => s.urgency_level === "critical").length;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <PageHeader
        title="Triage WhatsApp"
        subtitle="Evaluaciones PHQ-9 recibidas por WhatsApp"
      />

      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilterStatus(f.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors psy-mono",
              filterStatus === f.value
                ? "text-white"
                : "hover:bg-[var(--psy-bg-soft)]"
            )}
            style={
              filterStatus === f.value
                ? { background: "var(--psy-primary)" }
                : { border: "1px solid var(--psy-line)", color: "var(--psy-ink-2)" }
            }
          >
            {f.label}
            {f.value === "escalated" && criticalCount > 0 && (
              <span
                className="ml-1.5 text-white rounded-full px-1.5 py-0.5 text-[9px] psy-mono"
                style={{ background: "var(--psy-danger)" }}
              >
                {criticalCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-sm" style={{ color: "var(--psy-ink-3)" }}>
          Sin sesiones de triage.{" "}
          {!filterStatus && "Cuando un paciente complete el cuestionario por WhatsApp, aparecerá aquí."}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((s) => <TriageRow key={s.id} session={s} />)}
        </div>
      )}
    </div>
  );
}
