import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { api, InvoiceSummary, InvoiceStatus } from "@/lib/api";

export function InvoicesPage() {
  const queryClient = useQueryClient();
  const [filterPatient, setFilterPatient] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  const { data: invoicesData, isLoading, isError } = useQuery({
    queryKey: ["invoices", filterPatient, filterStatus],
    queryFn: () => api.invoices.list({
      patient_id: filterPatient || undefined,
      status: filterStatus || undefined,
    }),
  });

  const issueMutation = useMutation({
    mutationFn: (id: string) => api.invoices.issue(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const payMutation = useMutation({
    mutationFn: (id: string) => api.invoices.pay(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const handleDownload = async (id: string, invoiceNumber: string) => {
    const { blob, filename } = await api.invoices.getPdf(id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(value);

  const formatDate = (dateStr: string | null) =>
    dateStr ? new Date(dateStr).toLocaleDateString("es-CO") : "-";

  const getStatusBadge = (status: InvoiceStatus) => {
    const styles: Record<InvoiceStatus, string> = {
      draft: "bg-yellow-100 text-yellow-800",
      issued: "bg-blue-100 text-blue-800",
      paid: "bg-green-100 text-green-800",
    };
    const labels: Record<InvoiceStatus, string> = {
      draft: "Borrador",
      issued: "Emitida",
      paid: "Pagada",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Facturas</h1>
        <p className="text-muted-foreground mt-1">
          Liquidación de honorarios para pacientes particulares
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Facturas</CardTitle>
          <CardDescription>
            Lista de facturas generadas para pacientes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Label>Filtrar por paciente</Label>
              <Input
                placeholder="ID del paciente"
                value={filterPatient}
                onChange={(e) => setFilterPatient(e.target.value)}
              />
            </div>
            <div className="w-48">
              <Label>Estado</Label>
              <select
                className="w-full h-10 px-3 border rounded-md"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="draft">Borrador</option>
                <option value="issued">Emitida</option>
                <option value="paid">Pagada</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState />
          ) : invoicesData && invoicesData.items.length > 0 ? (
            <div className="space-y-3">
              {invoicesData.items.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{inv.invoice_number}</p>
                    <p className="text-sm text-muted-foreground">
                      Paciente: {inv.patient_id.slice(0, 8)}...
                    </p>
                    <p className="text-sm">
                      {formatCurrency(inv.total_cop)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Creada: {formatDate(inv.created_at)}
                      {inv.issue_date && ` • Emitida: ${formatDate(inv.issue_date)}`}
                      {inv.paid_at && ` • Pagada: ${formatDate(inv.paid_at)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(inv.status)}
                    {inv.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={() => issueMutation.mutate(inv.id)}
                        disabled={issueMutation.isPending}
                      >
                        Emitir
                      </Button>
                    )}
                    {inv.status === "issued" && (
                      <Button
                        size="sm"
                        onClick={() => payMutation.mutate(inv.id)}
                        disabled={payMutation.isPending}
                      >
                        Marcar Pagada
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(inv.id, inv.invoice_number)}
                    >
                      Descargar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Sin facturas"
              description="Genera facturas desde el detalle del paciente."
              icon="📄"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}