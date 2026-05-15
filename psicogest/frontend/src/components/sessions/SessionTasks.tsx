import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, CheckCircle2, Clock, Eye } from "lucide-react";
import { api, type PatientTask, ApiError } from "@/lib/api";

interface Props {
  sessionId: string;
  patientId: string;
  readOnly?: boolean;
}

const STATUS_LABELS: Record<PatientTask["status"], string> = {
  pending: "Pendiente",
  submitted: "Respondida",
  reviewed: "Revisada",
};

const STATUS_COLORS: Record<PatientTask["status"], string> = {
  pending: "var(--psy-warn, #f39c12)",
  submitted: "var(--psy-primary)",
  reviewed: "var(--psy-sage, #27ae60)",
};

const StatusIcon = ({ status }: { status: PatientTask["status"] }) => {
  if (status === "reviewed") return <CheckCircle2 size={13} />;
  if (status === "submitted") return <Eye size={13} />;
  return <Clock size={13} />;
};

export function SessionTasks({ sessionId, patientId, readOnly }: Props) {
  const qc = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["patient-tasks", patientId, sessionId],
    queryFn: () => api.patientTasks.listForPatient(patientId, sessionId),
  });

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["patient-tasks", patientId, sessionId] });
    qc.invalidateQueries({ queryKey: ["patient-tasks", patientId] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      api.patientTasks.create(sessionId, {
        patient_id: patientId,
        title: title.trim(),
        description: description.trim(),
        due_date: dueDate || null,
        session_id: sessionId,
      }),
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setDueDate("");
      setShowForm(false);
      setFormError(null);
      invalidate();
    },
    onError: (err) =>
      setFormError(err instanceof ApiError ? err.message : "Error al crear la tarea."),
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => api.patientTasks.delete(taskId),
    onSuccess: invalidate,
  });

  const reviewMutation = useMutation({
    mutationFn: (taskId: string) => api.patientTasks.review(taskId),
    onSuccess: invalidate,
  });

  const labelClass = "block text-[11px] font-semibold uppercase tracking-wide mb-1";
  const labelStyle = { color: "var(--psy-ink-3)" };
  const inputStyle = {
    border: "1px solid var(--psy-line)",
    background: "var(--psy-surface)",
    color: "var(--psy-ink-1)",
  };

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
    >
      <div className="flex items-center justify-between">
        <label className={labelClass} style={labelStyle}>
          Tareas para el paciente{tasks.length > 0 ? ` (${tasks.length})` : ""}
        </label>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="psy-mono text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors"
            style={{
              background: showForm ? "var(--psy-primary)" : "var(--psy-bg-soft)",
              color: showForm ? "#fff" : "var(--psy-primary)",
              border: "1px solid var(--psy-primary)",
            }}
          >
            <Plus size={11} />
            Agregar
          </button>
        )}
      </div>

      {/* New task form */}
      {showForm && (
        <div
          className="p-3 rounded-lg space-y-2"
          style={{ background: "var(--psy-bg-soft)", border: "1px solid var(--psy-line)" }}
        >
          <div>
            <label className={labelClass} style={labelStyle}>Título</label>
            <input
              type="text"
              className="w-full rounded-md border px-3 py-2 text-[13px] focus:outline-none"
              style={inputStyle}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Registro de pensamientos automáticos"
              maxLength={200}
            />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Descripción</label>
            <textarea
              className="w-full rounded-md border px-3 py-2 text-[13px] focus:outline-none resize-none"
              style={inputStyle}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Instrucciones detalladas para el paciente…"
            />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Fecha límite (opcional)</label>
            <input
              type="date"
              className="w-full rounded-md border px-3 py-2 text-[13px] focus:outline-none"
              style={inputStyle}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          {formError && (
            <p className="psy-mono text-[11px]" style={{ color: "var(--psy-danger, #e74c3c)" }}>
              {formError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || title.trim().length < 3 || description.trim().length < 5}
              className="flex-1 py-2 rounded-lg psy-mono text-[12px] font-semibold disabled:opacity-50 transition-opacity"
              style={{ background: "var(--psy-primary)", color: "#fff" }}
            >
              {createMutation.isPending ? "Guardando…" : "Guardar tarea"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormError(null); }}
              className="px-4 py-2 rounded-lg psy-mono text-[12px] transition-colors"
              style={{ background: "var(--psy-surface)", color: "var(--psy-ink-2)", border: "1px solid var(--psy-line)" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Task list */}
      {isLoading && (
        <p className="psy-mono text-[12px]" style={{ color: "var(--psy-ink-3)" }}>Cargando tareas…</p>
      )}
      {!isLoading && tasks.length === 0 && !showForm && (
        <p className="psy-mono text-[12px]" style={{ color: "var(--psy-ink-3)" }}>
          Sin tareas asignadas en esta sesión.
        </p>
      )}
      {tasks.map((task) => (
        <div
          key={task.id}
          className="p-3 rounded-lg space-y-1"
          style={{ background: "var(--psy-bg-soft)", border: "1px solid var(--psy-line)" }}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="psy-mono text-[13px] font-semibold flex-1" style={{ color: "var(--psy-ink-1)" }}>
              {task.title}
            </span>
            <span
              className="psy-mono text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0"
              style={{ color: STATUS_COLORS[task.status], background: "var(--psy-surface)" }}
            >
              <StatusIcon status={task.status} />
              {STATUS_LABELS[task.status]}
            </span>
          </div>
          <p className="psy-mono text-[12px] leading-relaxed" style={{ color: "var(--psy-ink-2)" }}>
            {task.description}
          </p>
          {task.due_date && (
            <p className="psy-mono text-[11px]" style={{ color: "var(--psy-ink-3)" }}>
              Límite: {new Date(task.due_date + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}
          {task.submission_text && (
            <div
              className="mt-2 p-2 rounded-md"
              style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
            >
              <p className="psy-mono text-[10px] font-semibold uppercase mb-1" style={{ color: "var(--psy-primary)" }}>
                Respuesta del paciente
              </p>
              <p className="psy-mono text-[12px] leading-relaxed" style={{ color: "var(--psy-ink-2)" }}>
                {task.submission_text}
              </p>
            </div>
          )}
          {!readOnly && (
            <div className="flex gap-2 pt-1">
              {task.status === "submitted" && (
                <button
                  type="button"
                  onClick={() => reviewMutation.mutate(task.id)}
                  disabled={reviewMutation.isPending}
                  className="psy-mono text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
                  style={{ background: "var(--psy-sage-bg)", color: "var(--psy-sage)" }}
                >
                  <CheckCircle2 size={11} />
                  Marcar revisada
                </button>
              )}
              {task.status === "pending" && (
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(task.id)}
                  disabled={deleteMutation.isPending}
                  className="psy-mono text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors disabled:opacity-50 ml-auto"
                  style={{ color: "var(--psy-ink-3)" }}
                >
                  <Trash2 size={11} />
                  Eliminar
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
