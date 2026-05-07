import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_LABELS: Record<string, string> = {
  issued: "Emitida",
  paid: "Pagada",
};
const STATUS_STYLES: Record<string, React.CSSProperties> = {
  issued: { background: "#DDE8F1", color: "var(--psy-info)" },
  paid: { background: "var(--psy-sage-bg)", color: "var(--psy-ok)" },
};

export function PortalInvoicesPage() {
  const { data: invoices, isLoading } = useQuery({
    queryKey: ["portal", "invoices"],
    queryFn: () => api.portal.invoices(),
  });

  return (
    <div className="space-y-5 pb-12">
      <h1 className="psy-serif text-2xl italic" style={{ color: "var(--psy-ink-1)" }}>Mis facturas</h1>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : !invoices || invoices.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: "var(--psy-ink-3)" }}>
          No hay facturas disponibles.
        </p>
      ) : (
        <div className="divide-y rounded-lg border overflow-hidden" style={{ borderColor: "var(--psy-line)" }}>
          {invoices.map((inv) => {
            const date = inv.issue_date
              ? new Date(inv.issue_date)
              : new Date(inv.created_at);
            return (
              <div
                key={inv.id}
                className="flex items-center justify-between px-4 py-3"
                style={{ background: "var(--psy-surface)" }}
              >
                <div>
                  <p className="text-sm font-semibold psy-mono" style={{ color: "var(--psy-primary)" }}>
                    {inv.invoice_number}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--psy-ink-3)" }}>
                    {date.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold psy-mono psy-tab-num" style={{ color: "var(--psy-ink-1)" }}>
                    ${Number(inv.total_cop).toLocaleString("es-CO")}
                  </p>
                  <span
                    className="text-xs px-2 py-0.5 rounded font-medium psy-mono"
                    style={STATUS_STYLES[inv.status] ?? { background: "var(--psy-bg-soft)", color: "var(--psy-ink-3)" }}
                  >
                    {STATUS_LABELS[inv.status] ?? inv.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
