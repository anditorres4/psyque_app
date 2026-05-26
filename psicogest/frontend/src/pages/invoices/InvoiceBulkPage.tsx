import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type UnbilledPatientRow } from "@/lib/api";

const COP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const daysSince = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86_400_000);
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });

function RowActions({ row }: { row: UnbilledPatientRow }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const dateFrom = new Date(row.oldest_session_date);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(row.latest_session_date);
  dateTo.setHours(23, 59, 59, 999);

  const bulkMutation = useMutation({
    mutationFn: () =>
      api.invoices.bulk({
        patient_id: row.patient_id,
        date_from: dateFrom.toISOString(),
        date_to: dateTo.toISOString(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices-unbilled"] });
      navigate("/invoices");
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="flex flex-col items-end gap-1.5 min-w-[170px]">
      {error && <p className="text-[11px] text-red-600 text-right max-w-[160px]">{error}</p>}
      <div className="text-[11px] text-right" style={{ color: "var(--psy-ink-3)" }}>
        {shortDate(row.oldest_session_date)} — {shortDate(row.latest_session_date)}
      </div>
      <Button
        size="sm"
        disabled={bulkMutation.isPending}
        onClick={() => { setError(null); bulkMutation.mutate(); }}
        className="w-full"
      >
        {bulkMutation.isPending ? "Generando…" : "Facturar"}
      </Button>
    </div>
  );
}

export function InvoiceBulkPage() {
  const { data: rows = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["invoices-unbilled"],
    queryFn: () => api.invoices.getUnbilled(),
  });

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="psy-page-title">Facturación en masa</h1>
        <p className="text-muted-foreground mt-1">
          Pacientes con sesiones firmadas sin facturar. El rango de fechas es de la sesión más antigua a la más reciente.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertDescription>
            No se pudo cargar la lista.{" "}
            <button type="button" onClick={() => refetch()} className="underline">Reintentar</button>
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No hay sesiones pendientes de facturar.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="space-y-3">
          {rows.map((row) => {
            const days = daysSince(row.oldest_session_date);
            const urgent = days >= 25;

            return (
              <Card
                key={row.patient_id}
                style={urgent ? { border: "1px solid var(--psy-warn)" } : undefined}
              >
                <CardContent className="py-4 flex items-center gap-6">
                  {/* Patient name + alert */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-semibold truncate" style={{ color: "var(--psy-ink-1)" }}>
                        {row.patient_name}
                      </span>
                      {urgent && (
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                          style={{ background: "var(--psy-warn-bg, #FEF3C7)", color: "var(--psy-warn, #B45309)" }}
                        >
                          ⚠ {days} días sin facturar
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1.5">
                      <span className="text-[12px]" style={{ color: "var(--psy-ink-3)" }}>
                        <strong style={{ color: "var(--psy-ink-2)" }}>{row.session_count}</strong>{" "}
                        sesión{row.session_count !== 1 ? "es" : ""}
                      </span>
                      <span className="text-[12px] font-semibold" style={{ color: "var(--psy-primary)" }}>
                        {COP(row.total_cop)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <RowActions row={row} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
