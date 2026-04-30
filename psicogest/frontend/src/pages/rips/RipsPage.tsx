import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type RipsValidateResponse } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, PsyButton, PsyCard, Tag } from "@/components/ui/psy";
import { Download, CheckCircle, AlertCircle } from "lucide-react";

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTH_NAMES_LONG = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const STATUS_TONES: Record<string, "amber" | "sage" | "info"> = {
  pending: "amber",
  generated: "sage",
  submitted: "info",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  generated: "Generado",
  submitted: "Enviado",
};

export function RipsPage() {
  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [validation, setValidation] = useState<RipsValidateResponse | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  const { data: exports, isLoading } = useQuery({
    queryKey: ["rips"],
    queryFn: () => api.rips.list(20),
  });

  const validateMutation = useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      api.rips.validate({ year, month }),
    onSuccess: (data) => {
      setValidation(data);
      setShowValidation(true);
    },
  });

  const generateMutation = useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      api.rips.generate({ year, month }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rips"] });
      setShowValidation(false);
      setValidation(null);
    },
  });

  const handleDownload = async (id: string) => {
    const { blob, filename } = await api.rips.download(id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedPeriod = `${MONTH_NAMES_LONG[month - 1]} ${year}`;

  return (
    <div className="space-y-5">
      {/* Compliance band */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 rounded-[var(--radius)] psy-mono text-[11px]"
        style={{ background: "var(--psy-primary)", color: "rgba(255,255,255,0.85)" }}
      >
        <span className="font-semibold text-white">Res. 2275/2023</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>RIPS Colombia · Formato JSON v2.1</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>Registro Individual de Prestación de Servicios de Salud</span>
      </div>

      <PageHeader
        title="RIPS"
        subtitle="Exportación para EPS y aseguradoras"
      />

      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 1.5fr" }}>
        {/* Export form */}
        <div className="flex flex-col gap-4">
          <PsyCard title="Generar exportación">
            <div className="mb-4">
              <div className="psy-mono text-[10.5px] uppercase tracking-wider mb-3" style={{ color: "var(--psy-ink-3)" }}>
                Período
              </div>
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  min={2020}
                  max={2030}
                  className="psy-mono text-[14px] w-[90px] px-3 py-2 rounded-md"
                  style={{
                    background: "var(--psy-bg-soft)",
                    border: "1px solid var(--psy-line)",
                    color: "var(--psy-ink-1)",
                    outline: "none",
                  }}
                />
                <div className="psy-serif text-[15px]" style={{ color: "var(--psy-ink-2)" }}>
                  {MONTH_NAMES_LONG[month - 1]}
                </div>
              </div>
              <div className="grid grid-cols-6 gap-1">
                {MONTH_NAMES.map((m, i) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMonth(i + 1)}
                    className="psy-mono text-[10px] py-1.5 rounded transition-colors text-center"
                    style={{
                      background: month === i + 1 ? "var(--psy-primary)" : "var(--psy-bg-soft)",
                      color: month === i + 1 ? "#fff" : "var(--psy-ink-3)",
                      border: "1px solid var(--psy-line)",
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              <PsyButton
                variant="ghost"
                onClick={() => validateMutation.mutate({ year, month })}
                className={validateMutation.isPending ? "opacity-50 pointer-events-none" : ""}
              >
                {validateMutation.isPending ? "Validando…" : "Validar"}
              </PsyButton>
              <PsyButton
                variant="primary"
                onClick={() => generateMutation.mutate({ year, month })}
                className={(generateMutation.isPending || (showValidation && !validation?.valid)) ? "opacity-50 pointer-events-none" : ""}
              >
                {generateMutation.isPending ? "Generando…" : `Generar ${selectedPeriod}`}
              </PsyButton>
            </div>

            {showValidation && validation && (
              <div
                className="rounded-[var(--radius)] p-4"
                style={{
                  background: validation.valid ? "var(--psy-sage-bg)" : "#FEF2F2",
                  border: `1px solid ${validation.valid ? "var(--psy-sage-soft)" : "#FECACA"}`,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  {validation.valid ? (
                    <CheckCircle size={14} style={{ color: "var(--psy-ok)" }} />
                  ) : (
                    <AlertCircle size={14} style={{ color: "var(--psy-danger)" }} />
                  )}
                  <span
                    className="text-[13px] font-medium"
                    style={{ color: validation.valid ? "var(--psy-ok)" : "var(--psy-danger)" }}
                  >
                    {validation.valid ? "Validación exitosa" : "Errores de validación"}
                  </span>
                  <span className="ml-auto psy-mono text-[11px]" style={{ color: "var(--psy-ink-3)" }}>
                    {validation.sessions_count} sesiones
                  </span>
                </div>
                {validation.errors.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1.5 mt-2">
                    {validation.errors.map((err, idx) => (
                      <div key={idx} className="psy-mono text-[11px] flex gap-2">
                        <span className="font-semibold shrink-0" style={{ color: "var(--psy-danger)" }}>{err.field}</span>
                        <span style={{ color: "var(--psy-ink-2)" }}>{err.message}</span>
                      </div>
                    ))}
                  </div>
                )}
                {validation.warnings.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {validation.warnings.map((warn, idx) => (
                      <div key={idx} className="psy-mono text-[11px]" style={{ color: "var(--psy-warn)" }}>
                        ⚠ {warn.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {generateMutation.isSuccess && (
              <div className="psy-mono text-[11px] mt-3" style={{ color: "var(--psy-ok)" }}>
                ✓ {generateMutation.data.message}
              </div>
            )}
            {(validateMutation.isError || generateMutation.isError) && (
              <div className="psy-mono text-[11px] mt-3" style={{ color: "var(--psy-danger)" }}>
                {((validateMutation.error || generateMutation.error) as Error)?.message ?? "Error al procesar"}
              </div>
            )}
          </PsyCard>
        </div>

        {/* History table */}
        <PsyCard title="Historial de exportaciones" padded={false}>
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : !exports || exports.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="Sin exportaciones"
                description="Genera tu primer RIPS para verlo aquí."
                icon="📦"
              />
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--psy-line)" }}>
                  {["Período", "Sesiones", "Valor", "Estado", ""].map((h, i) => (
                    <th
                      key={i}
                      className={`px-[18px] py-3 psy-mono text-[10.5px] uppercase tracking-wider font-medium ${i === 2 ? "text-right" : "text-left"}`}
                      style={{ color: "var(--psy-ink-3)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {exports.map((exp) => (
                  <tr
                    key={exp.id}
                    style={{ borderBottom: "1px solid var(--psy-line)" }}
                  >
                    <td className="px-[18px] py-3">
                      <div className="psy-serif text-[15px]" style={{ color: "var(--psy-ink-1)" }}>
                        {MONTH_NAMES_LONG[(exp.period_month ?? 1) - 1]}
                      </div>
                      <div className="psy-mono text-[10.5px]" style={{ color: "var(--psy-ink-3)" }}>
                        {exp.period_year}
                      </div>
                    </td>
                    <td className="px-[18px] py-3 psy-mono psy-tab-num" style={{ color: "var(--psy-ink-2)" }}>
                      {exp.sessions_count}
                    </td>
                    <td className="px-[18px] py-3 psy-mono psy-tab-num text-right" style={{ color: "var(--psy-ink-1)" }}>
                      ${Number(exp.total_value_cop).toLocaleString("es-CO")}
                    </td>
                    <td className="px-[18px] py-3">
                      <Tag tone={STATUS_TONES[exp.status] ?? "default"}>
                        {STATUS_LABELS[exp.status] ?? exp.status}
                      </Tag>
                    </td>
                    <td className="px-[18px] py-3">
                      {exp.status === "generated" && (
                        <button
                          type="button"
                          onClick={() => handleDownload(exp.id)}
                          className="inline-flex items-center gap-1 psy-mono text-[11px] transition-colors hover:opacity-70"
                          style={{ color: "var(--psy-primary)" }}
                        >
                          <Download size={12} /> ZIP
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </PsyCard>
      </div>
    </div>
  );
}
