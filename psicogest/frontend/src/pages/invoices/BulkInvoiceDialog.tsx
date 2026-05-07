import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type PatientSummary } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// ── Date helpers (Colombia UTC-5) ─────────────────────────────────────────────

function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function thisMonthRange() {
  const d = new Date();
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  return { from, to: today() };
}

function lastMonthRange() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  const y = d.getFullYear();
  const m = d.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    from: `${y}-${pad(m + 1)}-01`,
    to: `${y}-${pad(m + 1)}-${pad(lastDay)}`,
  };
}

// ── Patient search (inline) ───────────────────────────────────────────────────

function PatientSearch({
  selected,
  onSelect,
  onClear,
}: {
  selected: PatientSummary | null;
  onSelect: (p: PatientSummary) => void;
  onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isFetching } = useQuery({
    queryKey: ["patient-search-bulk", q],
    queryFn: () => api.patients.list({ search: q, page_size: 6 }),
    enabled: q.length >= 2 && !selected,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (selected) {
    const surnames = [selected.first_surname, selected.second_surname].filter(Boolean).join(" ");
    return (
      <div
        className="flex items-center gap-2 h-9 px-3 rounded-md text-[13px] psy-mono"
        style={{ background: "var(--psy-bg-soft)", border: "1px solid var(--psy-line)", color: "var(--psy-ink-1)" }}
      >
        <span className="flex-1 truncate">{surnames}, {selected.first_name}</span>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 transition-opacity hover:opacity-60"
          style={{ color: "var(--psy-ink-3)" }}
          aria-label="Quitar paciente"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar por nombre o documento…"
        autoComplete="off"
        className="w-full h-9 px-3 rounded-md text-[13px] psy-mono transition-[border-color] focus:outline-none"
        style={{
          background: "var(--psy-bg-soft)",
          border: "1px solid var(--psy-line)",
          color: "var(--psy-ink-1)",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--psy-sage)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--psy-line)")}
      />
      {open && q.length >= 2 && (
        <div
          className="absolute z-10 top-full mt-1 w-full rounded-md shadow-lg max-h-48 overflow-y-auto"
          style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
        >
          {isFetching && (
            <p className="psy-mono text-[11px] p-3" style={{ color: "var(--psy-ink-3)" }}>Buscando…</p>
          )}
          {!isFetching && data?.items.length === 0 && (
            <p className="psy-mono text-[11px] p-3" style={{ color: "var(--psy-ink-3)" }}>Sin resultados</p>
          )}
          {data?.items.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelect(p); setQ(""); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 text-[13px] transition-colors"
              style={{ borderBottom: "1px solid var(--psy-line)", color: "var(--psy-ink-1)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--psy-bg-soft)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span className="font-medium">
                {[p.first_surname, p.second_surname].filter(Boolean).join(" ")}, {p.first_name}
              </span>
              <span className="psy-mono text-[11px] ml-2" style={{ color: "var(--psy-ink-3)" }}>
                {p.doc_type} {p.doc_number}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Preset pill ───────────────────────────────────────────────────────────────

function PresetPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="psy-mono text-[11px] px-3 py-1 rounded-full transition-colors"
      style={{
        background: active ? "var(--psy-primary)" : "var(--psy-bg-soft)",
        color: active ? "#fff" : "var(--psy-ink-3)",
        border: "1px solid",
        borderColor: active ? "var(--psy-primary)" : "var(--psy-line)",
      }}
    >
      {label}
    </button>
  );
}

// ── BulkInvoiceDialog ─────────────────────────────────────────────────────────

type Preset = "this_month" | "last_month" | "custom";

interface Props {
  onClose: () => void;
}

export function BulkInvoiceDialog({ onClose }: Props) {
  const qc = useQueryClient();
  const thisMonth = thisMonthRange();
  const lastMonth = lastMonthRange();

  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [dateFrom, setDateFrom] = useState(thisMonth.from);
  const [dateTo, setDateTo] = useState(thisMonth.to);
  const [preset, setPreset] = useState<Preset>("this_month");
  const [error, setError] = useState<string | null>(null);

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p === "this_month") {
      setDateFrom(thisMonth.from);
      setDateTo(thisMonth.to);
    } else if (p === "last_month") {
      setDateFrom(lastMonth.from);
      setDateTo(lastMonth.to);
    }
  }

  function onDateChange(field: "from" | "to", value: string) {
    setPreset("custom");
    if (field === "from") setDateFrom(value);
    else setDateTo(value);
  }

  const mutation = useMutation({
    mutationFn: () =>
      api.invoices.bulk({
        patient_id: patient!.id,
        date_from: `${dateFrom}T00:00:00-05:00`,
        date_to: `${dateTo}T23:59:59-05:00`,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!patient) { setError("Selecciona un paciente."); return; }
    if (!dateFrom || !dateTo) { setError("Completa el rango de fechas."); return; }
    if (dateFrom > dateTo) { setError("La fecha inicial debe ser anterior a la final."); return; }
    mutation.mutate();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-xl p-6 shadow-xl"
        style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
      >
        {/* Header */}
        <div className="mb-5">
          <h2 className="text-base font-semibold" style={{ color: "var(--psy-ink-1)" }}>
            Facturar período
          </h2>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--psy-ink-3)" }}>
            Genera un borrador con todas las sesiones firmadas del rango.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Patient */}
          <div className="space-y-1.5">
            <Label>Paciente</Label>
            <PatientSearch
              selected={patient}
              onSelect={setPatient}
              onClear={() => setPatient(null)}
            />
          </div>

          {/* Presets */}
          <div className="space-y-1.5">
            <Label>Período</Label>
            <div className="flex gap-2">
              <PresetPill
                label="Este mes"
                active={preset === "this_month"}
                onClick={() => applyPreset("this_month")}
              />
              <PresetPill
                label="Mes anterior"
                active={preset === "last_month"}
                onClick={() => applyPreset("last_month")}
              />
              {preset === "custom" && (
                <PresetPill label="Personalizado" active onClick={() => {}} />
              )}
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bulk-from">Desde</Label>
              <input
                id="bulk-from"
                type="date"
                value={dateFrom}
                max={dateTo || today()}
                onChange={(e) => onDateChange("from", e.target.value)}
                className="w-full h-9 px-3 rounded-md text-[13px] psy-mono transition-[border-color] focus:outline-none"
                style={{
                  background: "var(--psy-bg-soft)",
                  border: "1px solid var(--psy-line)",
                  color: "var(--psy-ink-1)",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--psy-sage)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--psy-line)")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-to">Hasta</Label>
              <input
                id="bulk-to"
                type="date"
                value={dateTo}
                min={dateFrom}
                max={today()}
                onChange={(e) => onDateChange("to", e.target.value)}
                className="w-full h-9 px-3 rounded-md text-[13px] psy-mono transition-[border-color] focus:outline-none"
                style={{
                  background: "var(--psy-bg-soft)",
                  border: "1px solid var(--psy-line)",
                  color: "var(--psy-ink-1)",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--psy-sage)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--psy-line)")}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <p
              className="text-[13px] rounded-md p-2.5"
              style={{
                background: "color-mix(in srgb, var(--psy-danger) 8%, var(--psy-surface))",
                color: "var(--psy-danger)",
              }}
            >
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Generando…" : "Generar borrador"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
