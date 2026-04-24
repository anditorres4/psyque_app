import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api, PatientSummary } from "@/lib/api";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function PatientPicker({
  selected,
  onSelect,
  onClear,
}: {
  selected: PatientSummary | null;
  onSelect: (p: PatientSummary) => void;
  onClear: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const debouncedQuery = useDebounce(searchQuery, 300);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: searchResults, isFetching } = useQuery({
    queryKey: ["patient-search-bulk", debouncedQuery],
    queryFn: () => api.patients.list({ search: debouncedQuery, page_size: 6 }),
    enabled: debouncedQuery.length >= 2 && !selected,
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

  if (selected) {
    const surnames = [selected.first_surname, selected.second_surname].filter(Boolean).join(" ");
    return (
      <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-slate-50 text-sm">
        <span className="flex-1 truncate">{surnames}, {selected.first_name} — {selected.doc_type} {selected.doc_number}</span>
        <button type="button" className="text-muted-foreground hover:text-foreground shrink-0" onClick={onClear}>✕</button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={searchQuery}
        onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
        onFocus={() => setShowResults(true)}
        placeholder="Buscar por nombre o documento..."
        autoComplete="off"
      />
      {showResults && debouncedQuery.length >= 2 && (
        <div className="absolute z-10 top-full mt-1 w-full bg-white border rounded-md shadow-lg max-h-52 overflow-y-auto">
          {isFetching && <p className="text-xs text-muted-foreground p-3">Buscando...</p>}
          {!isFetching && searchResults?.items.length === 0 && (
            <p className="text-xs text-muted-foreground p-3">Sin resultados para "{debouncedQuery}"</p>
          )}
          {searchResults?.items.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 border-b last:border-b-0"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelect(p); setSearchQuery(""); setShowResults(false); }}
            >
              <span className="font-medium">{[p.first_surname, p.second_surname].filter(Boolean).join(" ")}, {p.first_name}</span>
              <span className="text-muted-foreground ml-2 text-xs">{p.doc_type} {p.doc_number}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function InvoiceBulkPage() {
  const navigate = useNavigate();
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const bulkMutation = useMutation({
    mutationFn: ({ patient_id, date_from, date_to }: { patient_id: string; date_from: string; date_to: string }) =>
      api.invoices.bulk({ patient_id, date_from, date_to }),
    onSuccess: () => {
      navigate("/invoices");
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedPatient) {
      setError("Selecciona un paciente");
      return;
    }
    if (!dateFrom || !dateTo) {
      setError("Selecciona el rango de fechas");
      return;
    }

    bulkMutation.mutate({
      patient_id: selectedPatient.id,
      date_from: new Date(dateFrom + "T00:00:00").toISOString(),
      date_to: new Date(dateTo + "T23:59:59").toISOString(),
    });
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Facturación en masa</h1>
        <p className="text-muted-foreground mt-1">
          Genera una factura automáticamente desde sesiones firmadas en un rango de fechas
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nueva factura</CardTitle>
          <CardDescription>
            Selecciona el paciente y el período de sesiones a facturar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label>Paciente</Label>
              <PatientPicker
                selected={selectedPatient}
                onSelect={setSelectedPatient}
                onClear={() => setSelectedPatient(null)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Desde</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Hasta</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="bg-[#2E86AB] hover:bg-[#1E3A5F] w-full"
              disabled={bulkMutation.isPending}
            >
              {bulkMutation.isPending ? "Generando..." : "Generar factura"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
