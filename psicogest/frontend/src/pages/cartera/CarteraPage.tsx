import { useState } from "react";
const formatCurrency = (v: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(v);
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  api,
  CarteraSummary,
  CarteraPortfolioSummary,
  PortfolioType,
} from "@/lib/api";

function PaymentModal({ open, onClose, carteraItem }: { open: boolean; onClose: () => void; carteraItem: CarteraSummary | null }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const mutation = useMutation({
    mutationFn: () => api.cartera.registerPayment(carteraItem!.invoice_ids[0], {
      amount: parseFloat(amount),
      description: description || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cartera"] });
      queryClient.invalidateQueries({ queryKey: ["cartera-summary"] });
      onClose();
      setAmount("");
      setDescription("");
    },
  });

  const handleSubmit = () => {
    if (!amount) return;
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar abono</DialogTitle>
          <DialogDescription>
            Registrar un pago de {carteraItem?.patient_name ?? ""}. Saldo pendiente: {carteraItem ? formatCurrency(carteraItem.balance) : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Monto</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="mt-1" />
          </div>
          <div>
            <Label>Descripción (opcional)</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción del pago" className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending || !amount}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCards({ summary, isLoading }: { summary: CarteraPortfolioSummary | undefined; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Cartera Particular</CardTitle></CardHeader>
        <CardContent><p className="text-2xl font-bold text-[#1E3A5F]">{summary ? formatCurrency(summary.total_particular) : "$0"}</p></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Cartera EPS</CardTitle></CardHeader>
        <CardContent><p className="text-2xl font-bold text-[#1E3A5F]">{summary ? formatCurrency(summary.total_eps) : "$0"}</p></CardContent>
      </Card>
      <Card className="bg-[#1E3A5F] text-white">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-white/70">Gran Total</CardTitle></CardHeader>
        <CardContent><p className="text-2xl font-bold">{summary ? formatCurrency(summary.grand_total) : "$0"}</p></CardContent>
      </Card>
    </div>
  );
}

export function CarteraPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<PortfolioType>("all");
  const [paymentTarget, setPaymentTarget] = useState<CarteraSummary | null>(null);
  const [search, setSearch] = useState("");

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["cartera-summary"],
    queryFn: () => api.cartera.getSummary(),
  });

  const { data: carteraData, isLoading: loadingCartera, isError } = useQuery({
    queryKey: ["cartera", activeTab, search],
    queryFn: () => api.cartera.list({ type: activeTab, search: search || undefined }),
  });

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("es-CO") : "-";

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Cartera</h1>
        <p className="text-muted-foreground mt-1">Facturas pendientes de pago por paciente</p>
      </div>

      <SummaryCards summary={summary} isLoading={loadingSummary} />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PortfolioType)} className="mt-8">
        <TabsList>
          <TabsTrigger value="particular">Particular</TabsTrigger>
          <TabsTrigger value="eps">EPS / Convenio</TabsTrigger>
          <TabsTrigger value="all">Todos</TabsTrigger>
        </TabsList>

        <div className="mt-4 mb-4">
          <Input placeholder="Buscar por nombre del paciente o entidad..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        </div>

        {(["particular", "eps", "all"] as PortfolioType[]).map(tab => (
          <TabsContent key={tab} value={tab}>
            {loadingCartera ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : isError ? (
              <ErrorState />
            ) : carteraData && carteraData.items.length > 0 ? (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paciente / Entidad</TableHead>
                      <TableHead>Total Facturado</TableHead>
                      <TableHead>Pagado</TableHead>
                      <TableHead>Saldo Pendiente</TableHead>
                      <TableHead>Última Actividad</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {carteraData.items.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{item.patient_name}</p>
                            {item.eps_name && <p className="text-xs text-muted-foreground">{item.eps_name}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{formatCurrency(item.total_billed)}</TableCell>
                        <TableCell className="text-sm text-green-700">{formatCurrency(item.total_paid)}</TableCell>
                        <TableCell className="text-sm font-medium text-red-700">{formatCurrency(item.balance)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(item.last_activity)}</TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => setPaymentTarget(item)}>Abonar</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ) : (
              <EmptyState title="Sin cartera" description="No hay facturas pendientes en esta categoría." icon="📁" />
            )}
          </TabsContent>
        ))}
      </Tabs>

      <PaymentModal
        open={!!paymentTarget}
        onClose={() => setPaymentTarget(null)}
        carteraItem={paymentTarget}
      />
    </div>
  );
}