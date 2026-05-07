import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type CreditDebitNoteCreate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  invoiceId: string;
  invoiceNumber: string;
  onClose: () => void;
}

export function InvoiceNoteDialog({ invoiceId, invoiceNumber, onClose }: Props) {
  const qc = useQueryClient();
  const [type, setType] = useState<"credit" | "debit">("credit");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (body: CreditDebitNoteCreate) => api.invoices.createNote(invoiceId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amountNum = parseInt(amount.replace(/\D/g, ""), 10);
    if (!reason.trim()) { setError("El motivo es requerido."); return; }
    if (!amountNum || amountNum <= 0) { setError("El monto debe ser mayor a cero."); return; }
    mutation.mutate({ type, reason: reason.trim(), amount_cop: amountNum });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        className="w-full max-w-md rounded-xl p-6 space-y-5 shadow-xl"
        style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
      >
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--psy-ink-1)" }}>
            Emitir nota de ajuste
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--psy-ink-3)" }}>
            Factura {invoiceNumber}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <div className="flex gap-2">
              {(["credit", "debit"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className="flex-1 py-2 rounded-md text-sm font-medium transition-colors"
                  style={{
                    background: type === t ? "var(--psy-primary)" : "var(--psy-bg-soft)",
                    color: type === t ? "white" : "var(--psy-ink-2)",
                    border: "1px solid",
                    borderColor: type === t ? "var(--psy-primary)" : "var(--psy-line)",
                  }}
                >
                  {t === "credit" ? "Nota Crédito (NC)" : "Nota Débito (ND)"}
                </button>
              ))}
            </div>
            <p className="text-xs" style={{ color: "var(--psy-ink-4)" }}>
              {type === "credit"
                ? "Reduce el valor de la factura (devolución o descuento)."
                : "Incrementa el valor de la factura (cargo adicional)."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">Motivo</Label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-md border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--psy-sage)] focus:border-[var(--psy-sage)]"
              style={{ borderColor: "var(--psy-line)" }}
              placeholder="Describe el motivo de la nota..."
              maxLength={500}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amount">Monto (COP)</Label>
            <Input
              id="amount"
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              placeholder="100000"
            />
          </div>

          {error && (
            <p className="text-sm rounded-md p-2.5" style={{ background: "color-mix(in srgb, var(--psy-danger) 8%, var(--psy-surface))", color: "var(--psy-danger)" }}>
              {error}
            </p>
          )}

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
              {mutation.isPending ? "Emitiendo..." : "Emitir nota"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
