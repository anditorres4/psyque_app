import { useEffect, useRef, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  api,
  CashSessionDetail,
  CashSessionSummary,
  CashTransactionSummary,
  CashTransactionCreate,
  PatientSummary,
  IncomeCategory,
  ExpenseCategory,
  PaymentMethod,
} from "@/lib/api";
import { EPS_COLOMBIA } from "@/lib/eps-colombia";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function PatientAutocomplete({
  value,
  onSelect,
  onClear,
}: {
  value: PatientSummary | null;
  onSelect: (p: PatientSummary) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounced = useDebounce(search, 300);

  const { data: results, isFetching } = useQuery({
    queryKey: ["patient-search-caja", debounced],
    queryFn: () => api.patients.list({ search: debounced, page_size: 6 }),
    enabled: debounced.length >= 2 && !value,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (value) {
    const surnames = [value.first_surname, value.second_surname].filter(Boolean).join(" ");
    return (
      <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-slate-50 text-sm">
        <span className="flex-1 truncate">{surnames}, {value.first_name}</span>
        <button type="button" className="text-muted-foreground hover:text-foreground shrink-0" onClick={onClear}>✕</button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <Input value={search} onChange={(e) => { setSearch(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Buscar paciente..." />
      {open && debounced.length >= 2 && (
        <div className="absolute z-10 top-full mt-1 w-full bg-white border rounded-md shadow-lg max-h-52 overflow-y-auto">
          {isFetching && <p className="text-xs text-muted-foreground p-3">Buscando...</p>}
          {!isFetching && results?.items.length === 0 && <p className="text-xs text-muted-foreground p-3">Sin resultados</p>}
          {results?.items.map((p) => (
            <button key={p.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 border-b last:border-b-0"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelect(p); setSearch(""); setOpen(false); }}>
              <span className="font-medium">{[p.first_surname, p.second_surname].filter(Boolean).join(" ")}, {p.first_name}</span>
              <span className="text-muted-foreground ml-2 text-xs">{p.doc_type} {p.doc_number}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TransactionRow({ tx, onEdit, onDelete }: { tx: CashTransactionSummary; onEdit: () => void; onDelete: () => void }) {
  const isIncome = tx.type === "income";
  const formatCurrency = (v: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(v);
  const formatTime = (d: string) => new Date(d).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

  const categoryLabels: Record<string, string> = {
    particular: "Particular",
    eps: "EPS",
    otro: "Otro",
    nomina: "Nómina",
    servicios: "Servicios",
    compras: "Compras",
  };

  return (
    <TableRow>
      <TableCell><Badge className={isIncome ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>{isIncome ? "Ingreso" : "Gasto"}</Badge></TableCell>
      <TableCell><span className="text-sm">{categoryLabels[tx.category] ?? tx.category}</span></TableCell>
      <TableCell><span className="text-sm text-muted-foreground">{tx.description || "-"}</span></TableCell>
      <TableCell className={isIncome ? "text-green-700 font-medium" : "text-red-700 font-medium"}>{formatCurrency(tx.amount)}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{formatTime(tx.created_at)}</TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onEdit}>Editar</Button>
          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={onDelete}>Eliminar</Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function IncomeModal({ sessionId, open, onClose, editTx }: { sessionId: string; open: boolean; onClose: () => void; editTx?: CashTransactionSummary }) {
  const queryClient = useQueryClient();
  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("efectivo");
  const [description, setDescription] = useState("");
  const [epsName, setEpsName] = useState("");
  const [showEps, setShowEps] = useState(false);
  const [category, setCategory] = useState<IncomeCategory>("particular");

  const { data: pendingInvoices } = useQuery({
    queryKey: ["pending-invoices", patient?.id],
    queryFn: () => api.invoices.list({ patient_id: patient!.id, status: "issued", limit: 50 }),
    enabled: !!patient,
  });

  const mutation = useMutation({
    mutationFn: (body: CashTransactionCreate) =>
      editTx ? api.caja.updateTransaction(editTx.id, body) : api.caja.createTransaction(sessionId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caja-current-session"] });
      queryClient.invalidateQueries({ queryKey: ["caja-transactions"] });
      onClose();
    },
  });

  const handlePatientSelect = (p: PatientSummary) => {
    setPatient(p);
    setInvoiceId("");
    setCategory(p.payer_type === "eps" ? "eps" : "particular");
    setShowEps(p.payer_type === "eps");
  };

  const handleSubmit = () => {
    if (!amount) return;
    mutation.mutate({
      type: "income",
      amount: parseFloat(amount),
      category,
      payment_method: method,
      description: description || undefined,
      invoice_id: invoiceId || undefined,
      patient_id: patient?.id,
      eps_name: showEps ? epsName : undefined,
    });
  };

  useEffect(() => {
    if (open && editTx) {
      if (editTx.patient_id) {
        api.patients.list({ search: editTx.patient_id }).then(res => {
          if (res.items[0]) setPatient(res.items[0]);
        });
      }
      setAmount(String(editTx.amount));
      setMethod(editTx.payment_method ?? "efectivo");
      setDescription(editTx.description || "");
      setCategory(editTx.category as IncomeCategory);
    }
  }, [open, editTx]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editTx ? "Editar ingreso" : "Registrar ingreso"}</DialogTitle>
          <DialogDescription>Registra un pago recibido en caja.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Paciente</Label>
            <div className="mt-1">
              <PatientAutocomplete value={patient} onSelect={handlePatientSelect} onClear={() => setPatient(null)} />
            </div>
          </div>
          {pendingInvoices && pendingInvoices.items.length > 0 && (
            <div>
              <Label>Factura pendiente</Label>
              <Select value={invoiceId} onValueChange={setInvoiceId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar factura" /></SelectTrigger>
                <SelectContent>
                  {pendingInvoices.items.map(inv => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.invoice_number} — {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(inv.total_cop)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Monto</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="mt-1" />
            </div>
            <div>
              <Label>Método de pago</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {showEps && (
            <div>
              <Label>EPS</Label>
              <Select value={epsName} onValueChange={setEpsName}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar EPS" /></SelectTrigger>
                <SelectContent>
                  {EPS_COLOMBIA.map(eps => (
                    <SelectItem key={eps.code} value={eps.name}>{eps.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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

function ExpenseModal({ sessionId, open, onClose, editTx }: { sessionId: string; open: boolean; onClose: () => void; editTx?: CashTransactionSummary }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("servicios");
  const [description, setDescription] = useState("");

  const mutation = useMutation({
    mutationFn: (body: CashTransactionCreate) =>
      editTx ? api.caja.updateTransaction(editTx.id, body) : api.caja.createTransaction(sessionId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caja-current-session"] });
      queryClient.invalidateQueries({ queryKey: ["caja-transactions"] });
      onClose();
    },
  });

  const handleSubmit = () => {
    if (!amount) return;
    mutation.mutate({
      type: "expense",
      amount: parseFloat(amount),
      category,
      description: description || undefined,
    });
  };

  useEffect(() => {
    if (open && editTx) {
      setAmount(String(editTx.amount));
      setCategory(editTx.category as ExpenseCategory);
      setDescription(editTx.description || "");
    }
  }, [open, editTx]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editTx ? "Editar gasto" : "Registrar gasto"}</DialogTitle>
          <DialogDescription>Registra un gasto operativo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Categoría</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nomina">Nómina</SelectItem>
                <SelectItem value="servicios">Servicios</SelectItem>
                <SelectItem value="compras">Compras</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Monto</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="mt-1" />
          </div>
          <div>
            <Label>Descripción</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción del gasto" className="mt-1" />
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

function CloseSessionModal({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (notes: string) => void }) {
  const [notes, setNotes] = useState("");
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cerrar turno</DialogTitle>
          <DialogDescription>¿Estás seguro de que quieres cerrar este turno? Puedes agregar notas opcionales.</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Label>Notas de cierre (opcional)</Label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones del turno..." className="mt-1" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onConfirm(notes)}>Cerrar turno</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CajaPage() {
  const queryClient = useQueryClient();
  const [showIncome, setShowIncome] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [editTx, setEditTx] = useState<CashTransactionSummary | undefined>();

  const { data: currentSession, isLoading: loadingCurrent } = useQuery({
    queryKey: ["caja-current-session"],
    queryFn: () => api.caja.getCurrentSession(),
    retry: () => false,
  });

  const { data: sessions, isLoading: loadingHistory } = useQuery({
    queryKey: ["caja-sessions"],
    queryFn: () => api.caja.listSessions(),
  });

  const { data: transactions, isLoading: loadingTx } = useQuery({
    queryKey: ["caja-transactions", currentSession?.id],
    queryFn: () => api.caja.listTransactions(currentSession!.id),
    enabled: !!currentSession,
  });

  const openMutation = useMutation({
    mutationFn: () => api.caja.openSession(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caja-current-session"] });
      queryClient.invalidateQueries({ queryKey: ["caja-sessions"] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: (notes?: string) => api.caja.closeSession(currentSession!.id, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caja-current-session"] });
      queryClient.invalidateQueries({ queryKey: ["caja-sessions"] });
      setShowClose(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.caja.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caja-current-session"] });
      queryClient.invalidateQueries({ queryKey: ["caja-transactions"] });
    },
  });

  const formatCurrency = (v: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(v);
  const formatDate = (d: string) => new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
  const formatDateTime = (d: string) => new Date(d).toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const incomeTotal = transactions?.items?.reduce((s, tx) => tx.type === "income" ? s + tx.amount : s, 0) ?? 0;
  const expenseTotal = transactions?.items?.reduce((s, tx) => tx.type === "expense" ? s + tx.amount : s, 0) ?? 0;

  if (loadingCurrent) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Caja</h1>
          <p className="text-muted-foreground mt-1">Control de turno y movimientos de caja</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground mb-6">No tienes un turno abierto</p>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Fecha y hora actual</p>
              <p className="text-lg font-medium mb-4">{new Date().toLocaleString("es-CO")}</p>
              <Button size="lg" onClick={() => openMutation.mutate()} disabled={openMutation.isPending}>
                {openMutation.isPending ? "Abriendo..." : "Abrir turno"}
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-[#1E3A5F] mb-4">Historial de turnos</h2>
          {loadingHistory ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : sessions && sessions.items.length > 0 ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Ingresos</TableHead>
                    <TableHead>Egresos</TableHead>
                    <TableHead>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.items.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">{formatDate(s.opened_at)}</TableCell>
                      <TableCell><Badge className={s.status === "open" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>{s.status === "open" ? "Abierto" : "Cerrado"}</Badge></TableCell>
                      <TableCell className="text-green-700">{formatCurrency(s.total_income)}</TableCell>
                      <TableCell className="text-red-700">{formatCurrency(s.total_expense)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <EmptyState title="Sin turnos" description="Aún no hay turnos registrados." icon="💵" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Caja</h1>
          <p className="text-muted-foreground mt-1">Turno abierto desde {formatDateTime(currentSession.opened_at)}</p>
        </div>
        <Button variant="destructive" onClick={() => setShowClose(true)}>Cerrar turno</Button>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader><CardTitle className="text-green-700">Ingresos del día</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{formatCurrency(incomeTotal)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-red-700">Egresos del día</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{formatCurrency(expenseTotal)}</p></CardContent>
        </Card>
      </div>

      <div className="flex gap-3 mb-6">
        <Button onClick={() => setShowIncome(true)}>Registrar ingreso</Button>
        <Button variant="outline" onClick={() => setShowExpense(true)}>Registrar gasto</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transacciones</CardTitle>
          <CardDescription>Movimientos del turno actual</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingTx ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : transactions && transactions.items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.items.map(tx => (
                  <TransactionRow key={tx.id} tx={tx}
                    onEdit={() => { setEditTx(tx); tx.type === "income" ? setShowIncome(true) : setShowExpense(true); }}
                    onDelete={() => deleteMutation.mutate(tx.id)} />
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title="Sin transacciones" description="No hay movimientos en este turno." icon="📋" />
          )}
        </CardContent>
      </Card>

      <IncomeModal sessionId={currentSession.id} open={showIncome} onClose={() => { setShowIncome(false); setEditTx(undefined); }} editTx={editTx} />
      <ExpenseModal sessionId={currentSession.id} open={showExpense} onClose={() => { setShowExpense(false); setEditTx(undefined); }} editTx={editTx} />
      <CloseSessionModal open={showClose} onClose={() => setShowClose(false)} onConfirm={(notes) => closeMutation.mutate(notes)} />
    </div>
  );
}