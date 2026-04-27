import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIndicators, useCreateIndicator, useDeleteIndicator, useAddMeasurement, useIndicatorWithMeasurements, useUpdateIndicator } from "@/hooks/useTherapyIndicators";
import type { TherapyIndicator, TherapyMeasurement, TherapyIndicatorCreate, TherapyMeasurementCreate } from "@/lib/api";

interface IndicatorsTabProps {
  patientId: string;
}

function calculateProgress(initial: number | null, current: number | null, target: number | null): number | null {
  if (initial === null || current === null || target === null) return null;
  if (initial === target) return 100;
  const progress = ((initial - current) / (initial - target)) * 100;
  return Math.min(100, Math.max(0, progress));
}

function IndicatorCard({
  indicator,
  onAddMeasurement,
  onArchive,
  onDelete,
}: {
  indicator: TherapyIndicator;
  onAddMeasurement: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const { data: fullData, isLoading } = useIndicatorWithMeasurements(indicator.id);

  const measurements = fullData?.measurements || [];
  const lastValue = measurements.length > 0 ? measurements[measurements.length - 1].value : null;

  const progress = calculateProgress(
    indicator.initial_value ?? null,
    lastValue,
    indicator.target_value ?? null
  );

  const chartData = measurements.map((m) => ({
    date: new Date(m.measured_at).toLocaleDateString("es-CO", { month: "short", day: "numeric" }),
    value: Number(m.value),
  }));

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h4 className="font-medium text-[#1E3A5F]">{indicator.name}</h4>
          <p className="text-sm text-muted-foreground">
            Inicial: {indicator.initial_value ?? "-"} → Actual: {lastValue ?? "-"} → Meta: {indicator.target_value ?? "-"}
            {indicator.unit && ` (${indicator.unit})`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onAddMeasurement}>
            Registrar
          </Button>
          <div className="relative">
            <Button size="sm" variant="ghost" onClick={() => setShowMenu(!showMenu)}>
              ⋯
            </Button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border rounded-md shadow-lg z-10">
                <button
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-100"
                  onClick={() => { onArchive(); setShowMenu(false); }}
                >
                  Archivar
                </button>
                <button
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  onClick={() => { onDelete(); setShowMenu(false); }}
                >
                  Eliminar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {progress !== null && (
        <div className="space-y-1">
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2E86AB] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{Math.round(progress)}% progreso</p>
        </div>
      )}

      {chartData.length >= 2 && (
        <div className="h-16">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#2E86AB" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function MeasurementForm({
  indicatorId,
  onClose,
  onSubmit,
}: {
  indicatorId: string;
  onClose: () => void;
  onSubmit: (data: TherapyMeasurementCreate) => void;
}) {
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      value: parseFloat(value),
      notes: notes || null,
      measured_at: new Date(date + "T12:00:00").toISOString(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-3 bg-slate-50">
      <h4 className="font-medium text-sm">Nueva medición</h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Valor</Label>
          <Input
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
        </div>
        <div>
          <Label className="text-xs">Fecha</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Notas (opcional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas..." />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="bg-[#2E86AB]">Guardar</Button>
        <Button type="button" size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
      </div>
    </form>
  );
}

function NewIndicatorForm({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: TherapyIndicatorCreate) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("");
  const [initialValue, setInitialValue] = useState("");
  const [targetValue, setTargetValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description: description || null,
      unit: unit || null,
      initial_value: initialValue ? parseFloat(initialValue) : null,
      target_value: targetValue ? parseFloat(targetValue) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-3 bg-slate-50">
      <h4 className="font-medium text-sm">Nuevo indicador</h4>
      <div>
        <Label className="text-xs">Nombre *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej: Ansiedad (escala 1-10)" />
      </div>
      <div>
        <Label className="text-xs">Descripción</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción opcional" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Unidad</Label>
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Ej: 1-10" />
        </div>
        <div>
          <Label className="text-xs">Valor inicial</Label>
          <Input type="number" step="0.01" value={initialValue} onChange={(e) => setInitialValue(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Valor meta</Label>
          <Input type="number" step="0.01" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="bg-[#2E86AB]">Crear</Button>
        <Button type="button" size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
      </div>
    </form>
  );
}

export function IndicatorsTab({ patientId }: IndicatorsTabProps) {
  const { data: indicators, isLoading } = useIndicators(patientId);
  const createMutation = useCreateIndicator(patientId);
  const deleteMutation = useDeleteIndicator(patientId);
  const updateMutation = useUpdateIndicator(patientId);
  const addMeasurementMutation = useAddMeasurement(patientId);

  const [showNewForm, setShowNewForm] = useState(false);
  const [measuringIndicatorId, setMeasuringIndicatorId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const activeIndicators = indicators?.filter((i) => i.is_active) || [];
  const archivedIndicators = indicators?.filter((i) => !i.is_active) || [];

  const handleCreate = async (data: TherapyIndicatorCreate) => {
    await createMutation.mutateAsync(data);
    setShowNewForm(false);
  };

  const handleArchive = async (id: string) => {
    await updateMutation.mutateAsync({ id, body: { is_active: false } });
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Eliminar este indicador?")) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleAddMeasurement = async (data: TherapyMeasurementCreate) => {
    if (measuringIndicatorId) {
      await addMeasurementMutation.mutateAsync({ indicatorId: measuringIndicatorId, body: data });
      setMeasuringIndicatorId(null);
    }
  };

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Cargando indicadores...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#1E3A5F]">Indicadores terapéuticos</h3>
        <Button size="sm" onClick={() => setShowNewForm(true)} disabled={showNewForm}>
          Nuevo indicador
        </Button>
      </div>

      {showNewForm && (
        <NewIndicatorForm onClose={() => setShowNewForm(false)} onSubmit={handleCreate} />
      )}

      {measuringIndicatorId && (
        <MeasurementForm
          indicatorId={measuringIndicatorId}
          onClose={() => setMeasuringIndicatorId(null)}
          onSubmit={handleAddMeasurement}
        />
      )}

      {activeIndicators.length === 0 && !showNewForm && (
        <p className="text-sm text-muted-foreground p-4 text-center">
          No hay indicadores. Crea uno para hacer seguimiento del progreso.
        </p>
      )}

      <div className="space-y-3">
        {activeIndicators.map((indicator) => (
          <IndicatorCard
            key={indicator.id}
            indicator={indicator}
            onAddMeasurement={() => setMeasuringIndicatorId(indicator.id)}
            onArchive={() => handleArchive(indicator.id)}
            onDelete={() => handleDelete(indicator.id)}
          />
        ))}
      </div>

      {archivedIndicators.length > 0 && (
        <div className="border-t pt-4">
          <button
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? "▼" : "▶"} Indicadores archivados ({archivedIndicators.length})
          </button>
          {showArchived && (
            <div className="mt-2 space-y-2 opacity-60">
              {archivedIndicators.map((indicator) => (
                <div key={indicator.id} className="text-sm text-muted-foreground p-2 border rounded">
                  {indicator.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
