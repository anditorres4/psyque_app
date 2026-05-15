import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, CheckCircle2, Eye, ChevronDown, ChevronUp, Send } from "lucide-react";
import { api, type PatientTask, ApiError } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_LABELS: Record<PatientTask["status"], string> = {
  pending: "Pendiente",
  submitted: "Respondida",
  reviewed: "Revisada por tu psicólogo",
};

const STATUS_COLORS: Record<PatientTask["status"], string> = {
  pending: "var(--psy-warn, #f39c12)",
  submitted: "var(--psy-primary)",
  reviewed: "var(--psy-sage, #27ae60)",
};

const StatusIcon = ({ status }: { status: PatientTask["status"] }) => {
  if (status === "reviewed") return <CheckCircle2 size={14} />;
  if (status === "submitted") return <Eye size={14} />;
  return <Clock size={14} />;
};

function TaskCard({ task }: { task: PatientTask }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(task.status === "pending");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submitMutation = useMutation({
    mutationFn: () => api.portal.submitTask(task.id, text.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal", "tasks"] });
      setText("");
      setError(null);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Error al enviar la respuesta."),
  });

  const isOverdue =
    task.status === "pending" &&
    task.due_date &&
    new Date(task.due_date + "T23:59:59") < new Date();

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--psy-surface, white)",
        border: `1px solid ${isOverdue ? "var(--psy-warn, #f39c12)" : "var(--psy-line, #E5DFD3)"}`,
      }}
    >
      {/* Header */}
      <button
        type="button"
        className="w-full px-4 py-4 flex items-start gap-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <span style={{ color: STATUS_COLORS[task.status], marginTop: 2 }}>
          <StatusIcon status={task.status} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-snug" style={{ color: "var(--psy-ink-1)" }}>
            {task.title}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs" style={{ color: STATUS_COLORS[task.status] }}>
              {STATUS_LABELS[task.status]}
            </span>
            {task.due_date && (
              <span
                className="text-xs"
                style={{ color: isOverdue ? "var(--psy-warn, #f39c12)" : "var(--psy-ink-4)" }}
              >
                {isOverdue ? "Vencida · " : "Límite: "}
                {new Date(task.due_date + "T12:00:00").toLocaleDateString("es-CO", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        </div>
        <span style={{ color: "var(--psy-ink-3)", flexShrink: 0 }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: "var(--psy-line)" }}>
          {/* Description */}
          <div className="pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--psy-ink-3)" }}>
              Instrucciones
            </p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--psy-ink-2)" }}>
              {task.description}
            </p>
          </div>

          {/* Submitted response */}
          {task.submission_text && (
            <div
              className="p-3 rounded-lg"
              style={{ background: "var(--psy-bg-soft)", border: "1px solid var(--psy-line)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--psy-primary)" }}>
                Tu respuesta
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--psy-ink-2)" }}>
                {task.submission_text}
              </p>
            </div>
          )}

          {/* Reviewer notes */}
          {task.reviewer_notes && (
            <div
              className="p-3 rounded-lg"
              style={{ background: "var(--psy-sage-bg, #f0fdf4)", border: "1px solid var(--psy-sage, #27ae60)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--psy-sage, #27ae60)" }}>
                Comentario de tu psicólogo
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--psy-ink-2)" }}>
                {task.reviewer_notes}
              </p>
            </div>
          )}

          {/* Response form */}
          {task.status === "pending" && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--psy-ink-3)" }}>
                Tu respuesta
              </p>
              <textarea
                className="w-full rounded-lg border px-3 py-2.5 text-sm resize-none focus:outline-none"
                style={{
                  borderColor: "var(--psy-line)",
                  background: "var(--psy-surface)",
                  color: "var(--psy-ink-1)",
                  minHeight: 100,
                }}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Escribe tu respuesta, reflexiones o preguntas…"
              />
              {error && (
                <p className="text-xs" style={{ color: "var(--psy-danger, #e74c3c)" }}>{error}</p>
              )}
              <button
                type="button"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || text.trim().length < 5}
                className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
                style={{ background: "var(--psy-primary)", color: "#fff" }}
              >
                <Send size={14} />
                {submitMutation.isPending ? "Enviando…" : "Enviar respuesta"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PortalTasksPage() {
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["portal", "tasks"],
    queryFn: () => api.portal.tasks(),
  });

  const pending = tasks?.filter((t) => t.status === "pending") ?? [];
  const done = tasks?.filter((t) => t.status !== "pending") ?? [];

  return (
    <div className="space-y-5 pb-16">
      <div>
        <h1 className="psy-serif text-2xl italic" style={{ color: "var(--psy-ink-1)" }}>Mis tareas</h1>
        <p className="text-xs mt-1" style={{ color: "var(--psy-ink-4)" }}>
          Actividades asignadas por tu psicólogo entre sesiones.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      )}

      {!isLoading && (!tasks || tasks.length === 0) && (
        <div
          className="rounded-xl py-12 flex flex-col items-center gap-2"
          style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
        >
          <CheckCircle2 size={32} style={{ color: "var(--psy-line)" }} />
          <p className="text-sm" style={{ color: "var(--psy-ink-3)" }}>No tienes tareas asignadas por el momento.</p>
        </div>
      )}

      {!isLoading && pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--psy-ink-3)" }}>
            Pendientes ({pending.length})
          </h2>
          {pending.map((t) => <TaskCard key={t.id} task={t} />)}
        </section>
      )}

      {!isLoading && done.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--psy-ink-3)" }}>
            Completadas ({done.length})
          </h2>
          {done.map((t) => <TaskCard key={t.id} task={t} />)}
        </section>
      )}
    </div>
  );
}
