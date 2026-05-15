import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Check, Minus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { TherapeuticGoal } from "@/lib/api";

const STATUS_COLORS: Record<TherapeuticGoal["status"], string> = {
  active: "var(--psy-primary)",
  achieved: "var(--psy-sage)",
  abandoned: "var(--psy-ink-3)",
};

interface Props {
  patientId: string;
  readOnly?: boolean;
}

export function TherapeuticGoals({ patientId, readOnly = false }: Props) {
  const qc = useQueryClient();
  const [newGoalText, setNewGoalText] = useState("");
  const [adding, setAdding] = useState(false);

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ["therapeutic-goals", patientId],
    queryFn: () => api.therapeuticGoals.list(patientId),
  });

  const createMutation = useMutation({
    mutationFn: () => api.therapeuticGoals.create({ patient_id: patientId, goal_text: newGoalText }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["therapeutic-goals", patientId] });
      setNewGoalText("");
      setAdding(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TherapeuticGoal["status"] }) =>
      api.therapeuticGoals.update(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["therapeutic-goals", patientId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.therapeuticGoals.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["therapeutic-goals", patientId] }),
  });

  const activeCount = goals.filter((g) => g.status === "active").length;
  const canAdd = activeCount < 3 && !readOnly;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="psy-mono text-[11px] uppercase tracking-wider font-medium" style={{ color: "var(--psy-ink-3)" }}>
          Objetivos terapéuticos ({activeCount}/3)
        </span>
        {canAdd && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="psy-mono text-[11px] flex items-center gap-1 transition-colors"
            style={{ color: "var(--psy-primary)" }}
          >
            <Plus size={12} />
            Agregar
          </button>
        )}
      </div>

      {isLoading && (
        <div className="psy-mono text-[12px]" style={{ color: "var(--psy-ink-3)" }}>Cargando…</div>
      )}

      {goals.map((goal) => (
        <div
          key={goal.id}
          className="flex items-start gap-2 p-2.5 rounded-lg"
          style={{
            background: "var(--psy-bg-soft)",
            border: "1px solid var(--psy-line)",
            opacity: goal.status !== "active" ? 0.6 : 1,
          }}
        >
          <span
            className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: STATUS_COLORS[goal.status], marginTop: "5px" }}
          />
          <span className="psy-mono text-[13px] flex-1 leading-snug" style={{ color: "var(--psy-ink-1)" }}>
            {goal.goal_text}
          </span>
          {!readOnly && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {goal.status === "active" && (
                <button
                  type="button"
                  title="Marcar como logrado"
                  onClick={() => updateMutation.mutate({ id: goal.id, status: "achieved" })}
                  className="p-1 rounded transition-colors hover:bg-white"
                  style={{ color: "var(--psy-sage)" }}
                >
                  <Check size={13} />
                </button>
              )}
              {goal.status === "active" && (
                <button
                  type="button"
                  title="Abandonar"
                  onClick={() => updateMutation.mutate({ id: goal.id, status: "abandoned" })}
                  className="p-1 rounded transition-colors hover:bg-white"
                  style={{ color: "var(--psy-ink-3)" }}
                >
                  <Minus size={13} />
                </button>
              )}
              <button
                type="button"
                title="Eliminar"
                onClick={() => deleteMutation.mutate(goal.id)}
                className="p-1 rounded transition-colors hover:bg-white"
                style={{ color: "var(--psy-danger, #e74c3c)" }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>
      ))}

      {!readOnly && goals.length === 0 && !adding && (
        <div className="psy-mono text-[12px]" style={{ color: "var(--psy-ink-3)" }}>
          Sin objetivos terapéuticos registrados.
        </div>
      )}

      {adding && (
        <div className="space-y-2">
          <textarea
            autoFocus
            rows={2}
            value={newGoalText}
            onChange={(e) => setNewGoalText(e.target.value)}
            placeholder="Describir el objetivo terapéutico…"
            className="w-full psy-mono text-[13px] px-3 py-2 rounded-lg resize-none focus:outline-none"
            style={{
              background: "var(--psy-surface)",
              border: "1px solid var(--psy-primary)",
              color: "var(--psy-ink-1)",
            }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={newGoalText.trim().length < 5 || createMutation.isPending}
              className="psy-mono text-[12px] px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-opacity"
              style={{ background: "var(--psy-primary)", color: "#fff" }}
            >
              {createMutation.isPending ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setNewGoalText(""); }}
              className="psy-mono text-[12px] px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: "var(--psy-bg-soft)", color: "var(--psy-ink-2)", border: "1px solid var(--psy-line)" }}
            >
              Cancelar
            </button>
          </div>
          {createMutation.isError && (
            <span className="psy-mono text-[11px]" style={{ color: "var(--psy-danger, #e74c3c)" }}>
              {(createMutation.error as Error).message}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
