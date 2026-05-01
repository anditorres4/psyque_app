import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader, PsyButton, PsyCard, KPI, Tag } from "@/components/ui/psy";
import { api, type InvoiceStatus, type InvoiceSummary, type PatientSummary } from "@/lib/api";
import { Download, Send, CheckCircle } from "lucide-react";

const SPARK_REVENUE = [8, 12, 11, 15, 14, 18, 20, 17, 22, 20, 25, 28];

const STATUS_TONES: Record<InvoiceStatus, "amber" | "info" | "sage"> = {
  draft: "amber",
  issued: "info",
  paid: "sage",
};
const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Borrador",
  issued: "Emitida",
  paid: "Pagada",
};
const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "draft", label: "Borradores" },
  { value: "issued", label: "Emitidas" },
  { value: "paid", label: "Pagadas" },
];

function InvoiceCard({
  invoice,
  onDownload,
  onIssue,
  onPay,
}: {
  invoice: InvoiceSummary;
  onDownload: (id: string, num: string) => void;
  onIssue: { mutate: (id: string) => void; isPending: boolean };
  onPay: { mutate: (id: string) => void; isPending: boolean };
}) {
  const issueDate = invoice.issue_date
    ? new Date(invoice.issue_date).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })
    : new Date(invoice.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div
      className="p-4 rounded-[var(--radius)]"
      style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="psy-mono font-semibold" style={{ color: "var(--psy-primary)" }}>
          {invoice.invoice_number}
        </span>
        <Tag tone={STATUS_TONES[invoice.status]}>
          {STATUS_LABELS[invoice.status]}
        </Tag>
      </div>
      <div className="flex items-center justify-between mb-3">
        <span className="psy-mono text-[11px]" style={{ color: "var(--psy-ink-2)" }}>
          {invoice.patient_id.slice(0, 8)}…
        </span>
        <span className="psy-mono text-[12px]" style={{ color: "var(--psy-ink-3)" }}>
          {issueDate}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="psy-mono psy-tab-num text-[16px] font-semibold" style={{ color: "var(--psy-ink-1)" }}>
          ${Number(invoice.total_cop).toLocaleString("es-CO")}
        </span>
        <div className="flex items-center gap-2">
          {invoice.status === "draft" && (
            <PsyButton
              variant="primary"
              icon={<Send size={11} />}
              onClick={() => onIssue.mutate(invoice.id)}
              className="text-[11px] px-2.5 py-1.5"
            >
              Emitir
            </PsyButton>
          )}
          {invoice.status === "issued" && (
            <PsyButton
              variant="sage"
              icon={<CheckCircle size={11} />}
              onClick={() => onPay.mutate(invoice.id)}
              className="text-[11px] px-2.5 py-1.5"
            >
              Pagada
            </PsyButton>
          )}
          <button
            type="button"
            onClick={() => onDownload(invoice.id, invoice.invoice_number)}
            className="inline-flex items-center gap-1 psy-mono text-[11px] transition-colors hover:opacity-70"
            style={{ color: "var(--psy-ink-3)" }}
          >
            <Download size={12} /> PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function PatientFilter({
  selectedPatient,
  onSelect,
  onClear,
}: {
  selectedPatient: PatientSummary | null;
  onSelect: (p: PatientSummary) => void;
  onClear: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const debouncedQuery = useDebounce(searchQuery, 300);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: searchResults, isFetching } = useQuery({
    queryKey: ["patient-search-invoice", debouncedQuery],
    queryFn: () => api.patients.list({ search: debouncedQuery, page_size: 6 }),
    enabled: debouncedQuery.length >= 2 && !selectedPatient,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (selectedPatient) {
    const surnames = [selectedPatient.first_surname, selectedPatient.second_surname].filter(Boolean).join(" ");
    return (
      <div
        className="flex items-center gap-2 h-9 px-3 rounded-md text-[13px] psy-mono"
        style={{ background: "var(--psy-bg-soft)", border: "1px solid var(--psy-line)", color: "var(--psy-ink-1)" }}
      >
        <span className="flex-1 truncate">{surnames}, {selectedPatient.first_name}</span>
        <button type="button" className="shrink-0" onClick={onClear} style={{ color: "var(--psy-ink-3)" }}>✕</button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        value={searchQuery}
        onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
        onFocus={() => setShowResults(true)}
        placeholder="Buscar paciente…"
        autoComplete="off"
        className="w-full h-9 px-3 rounded-md text-[13px] psy-mono"
        style={{
          background: "var(--psy-bg-soft)",
          border: "1px solid var(--psy-line)",
          color: "var(--psy-ink-1)",
          outline: "none",
        }}
      />
      {showResults && debouncedQuery.length >= 2 && (
        <div
          className="absolute z-10 top-full mt-1 w-full rounded-md shadow-lg max-h-52 overflow-y-auto"
          style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
        >
          {isFetching && <p className="psy-mono text-[11px] p-3" style={{ color: "var(--psy-ink-3)" }}>Buscando…</p>}
          {!isFetching && searchResults?.items.length === 0 && (
            <p className="psy-mono text-[11px] p-3" style={{ color: "var(--psy-ink-3)" }}>Sin resultados</p>
          )}
          {searchResults?.items.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2.5 text-[13px] transition-colors"
              style={{ borderBottom: "1px solid var(--psy-line)", color: "var(--psy-ink-1)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--psy-bg-soft)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelect(p); setSearchQuery(""); setShowResults(false); }}
            >
              <span className="font-medium">{[p.first_surname, p.second_surname].filter(Boolean).join(" ")}, {p.first_name}</span>
              <span className="psy-mono text-[11px] ml-2" style={{ color: "var(--psy-ink-3)" }}>{p.doc_type} {p.doc_number}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function InvoicesPage() {
  const queryClient = useQueryClient();
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");

  const { data: invoicesData, isLoading, isError } = useQuery({
    queryKey: ["invoices", selectedPatient?.id, filterStatus],
    queryFn: () => api.invoices.list({
      patient_id: selectedPatient?.id || undefined,
      status: filterStatus || undefined,
    }),
  });

  const issueMutation = useMutation({
    mutationFn: (id: string) => api.invoices.issue(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
  });

  const payMutation = useMutation({
    mutationFn: (id: string) => api.invoices.pay(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
  });

  const handleDownload = async (id: string, invoiceNumber: string) => {
    const { blob, filename } = await api.invoices.getPdf(id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `${invoiceNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const items = invoicesData?.items ?? [];
  const draftCount = items.filter((i) => i.status === "draft").length;
  const issuedCount = items.filter((i) => i.status === "issued").length;
  const paidCount = items.filter((i) => i.status === "paid").length;
  const totalPaid = items.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.total_cop), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Facturas"
        subtitle="Liquidación de honorarios · particulares"
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI
          label="Total cobrado"
          value={`$${(totalPaid / 1_000_000).toFixed(1)}M`}
          sparkline={SPARK_REVENUE}
          sparklineColor="var(--psy-ok)"
          accent="ok"
        />
        <KPI
          label="Borradores"
          value={draftCount}
          delta={draftCount > 0 ? "por emitir" : "ninguno"}
          trend={draftCount > 0 ? "down" : undefined}
          accent={draftCount > 0 ? "warn" : undefined}
        />
        <KPI
          label="Emitidas"
          value={issuedCount}
          delta={issuedCount > 0 ? "pendientes pago" : "al día"}
          accent={issuedCount > 0 ? "info" : undefined}
        />
        <KPI
          label="Pagadas"
          value={paidCount}
          accent="ok"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilterStatus(f.value)}
              className="psy-mono text-[11px] px-3 py-1.5 rounded-full transition-colors"
              style={{
                background: filterStatus === f.value ? "var(--psy-primary)" : "var(--psy-surface)",
                color: filterStatus === f.value ? "#fff" : "var(--psy-ink-3)",
                border: "1px solid var(--psy-line)",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="w-full md:w-60 ml-auto">
          <PatientFilter
            selectedPatient={selectedPatient}
            onSelect={setSelectedPatient}
            onClear={() => setSelectedPatient(null)}
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <PsyCard padded={false}>
          <div className="p-4 space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        </PsyCard>
      ) : isError ? (
        <PsyCard><ErrorState /></PsyCard>
      ) : items.length === 0 ? (
        <PsyCard>
          <EmptyState
            title="Sin facturas"
            description={filterStatus ? "No hay facturas con ese estado." : "Genera facturas desde el detalle del paciente."}
            icon="📄"
          />
        </PsyCard>
      ) : (
        <>
          {/* Tabla — md+ */}
          <div className="hidden md:block">
            <PsyCard padded={false}>
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--psy-line)" }}>
                    {["N° Factura", "Paciente", "Fecha", "Valor", "Estado", ""].map((h, i) => (
                      <th
                        key={i}
                        className={`px-[18px] py-3 psy-mono text-[10.5px] uppercase tracking-wider font-medium ${i === 3 ? "text-right" : "text-left"}`}
                        style={{ color: "var(--psy-ink-3)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((inv) => (
                    <tr
                      key={inv.id}
                      className="transition-colors hover:bg-[var(--psy-bg-soft)]"
                      style={{ borderBottom: "1px solid var(--psy-line)" }}
                    >
                      <td className="px-[18px] py-3 psy-mono font-semibold" style={{ color: "var(--psy-primary)" }}>
                        {inv.invoice_number}
                      </td>
                      <td className="px-[18px] py-3 psy-mono text-[11px]" style={{ color: "var(--psy-ink-2)" }}>
                        {inv.patient_id.slice(0, 8)}…
                      </td>
                      <td className="px-[18px] py-3 psy-mono text-[12px]" style={{ color: "var(--psy-ink-3)" }}>
                        {inv.issue_date
                          ? new Date(inv.issue_date).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })
                          : new Date(inv.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })
                        }
                      </td>
                      <td className="px-[18px] py-3 psy-mono psy-tab-num text-right" style={{ color: "var(--psy-ink-1)" }}>
                        ${Number(inv.total_cop).toLocaleString("es-CO")}
                      </td>
                      <td className="px-[18px] py-3">
                        <Tag tone={STATUS_TONES[inv.status]}>
                          {STATUS_LABELS[inv.status]}
                        </Tag>
                      </td>
                      <td className="px-[18px] py-3">
                        <div className="flex items-center gap-2">
                          {inv.status === "draft" && (
                            <PsyButton
                              variant="primary"
                              icon={<Send size={11} />}
                              onClick={() => issueMutation.mutate(inv.id)}
                              className={issueMutation.isPending ? "opacity-50 pointer-events-none text-[11px] px-2.5 py-1.5" : "text-[11px] px-2.5 py-1.5"}
                            >
                              Emitir
                            </PsyButton>
                          )}
                          {inv.status === "issued" && (
                            <PsyButton
                              variant="sage"
                              icon={<CheckCircle size={11} />}
                              onClick={() => payMutation.mutate(inv.id)}
                              className={payMutation.isPending ? "opacity-50 pointer-events-none text-[11px] px-2.5 py-1.5" : "text-[11px] px-2.5 py-1.5"}
                            >
                              Pagada
                            </PsyButton>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDownload(inv.id, inv.invoice_number)}
                            className="inline-flex items-center gap-1 psy-mono text-[11px] transition-colors hover:opacity-70"
                            style={{ color: "var(--psy-ink-3)" }}
                          >
                            <Download size={12} /> PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </PsyCard>
          </div>

          {/* Cards — mobile */}
          <div className="md:hidden space-y-3">
            {items.map((inv) => (
              <InvoiceCard key={inv.id} invoice={inv} onDownload={handleDownload} onIssue={issueMutation} onPay={payMutation} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
