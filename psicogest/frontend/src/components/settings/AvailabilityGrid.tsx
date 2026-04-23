import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useAvailability, useCreateAvailabilityBlock, useDeleteAvailabilityBlock } from "@/hooks/useAvailability";

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function BlockRow({ block, onDelete }: { block: { id: string; start_time: string; end_time: string }; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between py-1 px-3 rounded bg-slate-50 border text-sm">
      <span>{block.start_time.slice(0, 5)} — {block.end_time.slice(0, 5)}</span>
      <button type="button" onClick={onDelete} className="text-red-400 hover:text-red-600 text-xs ml-4">
        ✕
      </button>
    </div>
  );
}

function AddBlockForm({ dayOfWeek, onDone }: { dayOfWeek: number; onDone: () => void }) {
  const createMutation = useCreateAvailabilityBlock();
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("13:00");
  const [err, setErr] = useState<string | null>(null);

  const handleAdd = async () => {
    setErr(null);
    if (end <= start) {
      setErr("La hora de fin debe ser posterior al inicio.");
      return;
    }
    try {
      await createMutation.mutateAsync({ day_of_week: dayOfWeek, start_time: `${start}:00`, end_time: `${end}:00` });
      onDone();
    } catch {
      setErr("Error al crear bloque.");
    }
  };

  return (
    <div className="flex items-center gap-2 mt-1">
      <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="border rounded px-2 py-1 text-xs" />
      <span className="text-xs">—</span>
      <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="border rounded px-2 py-1 text-xs" />
      <Button size="sm" onClick={handleAdd} disabled={createMutation.isPending} className="text-xs h-7">
        Agregar
      </Button>
      <button type="button" onClick={onDone} className="text-xs text-muted-foreground">Cancelar</button>
      {err && <p className="text-xs text-red-500">{err}</p>}
    </div>
  );
}

export function AvailabilityGrid() {
  const { data: blocks = [], isLoading } = useAvailability();
  const deleteMutation = useDeleteAvailabilityBlock();
  const [addingDay, setAddingDay] = useState<number | null>(null);

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  return (
    <div className="space-y-3 max-w-lg">
      {DAYS.map((day, idx) => {
        const dayBlocks = blocks.filter((b) => b.day_of_week === idx);
        return (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{day}</span>
              {addingDay !== idx && (
                <button
                  type="button"
                  onClick={() => setAddingDay(idx)}
                  className="text-xs text-[#2E86AB] hover:underline"
                >
                  + Agregar
                </button>
              )}
            </div>
            {dayBlocks.length === 0 && addingDay !== idx && (
              <p className="text-xs text-muted-foreground italic pl-2">Sin horario</p>
            )}
            {dayBlocks.map((block) => (
              <BlockRow
                key={block.id}
                block={block}
                onDelete={() => deleteMutation.mutate(block.id)}
              />
            ))}
            {addingDay === idx && <AddBlockForm dayOfWeek={idx} onDone={() => setAddingDay(null)} />}
          </div>
        );
      })}
    </div>
  );
}