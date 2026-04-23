/**
 * Global patient search — RF-PAC-02
 * Triggered with Ctrl+K / Cmd+K from anywhere in the app.
 * Debounced 300ms per PRD spec.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PatientCard } from "./PatientCard";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

interface PatientSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PatientSearch({ isOpen, onClose }: PatientSearchProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  const { data, isFetching } = useQuery({
    queryKey: ["patient-search", debouncedQuery],
    queryFn: () => api.patients.list({ search: debouncedQuery, page_size: 8 }),
    enabled: debouncedQuery.length >= 2,
  });

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSelect = useCallback(
    (patientId: string) => {
      navigate(`/patients/${patientId}`);
      onClose();
    },
    [navigate, onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Búsqueda global de pacientes"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <span className="text-muted-foreground">🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar paciente por nombre, apellido o documento..."
            className="flex-1 outline-none text-sm bg-transparent"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {isFetching && (
            <span className="text-xs text-muted-foreground">Buscando...</span>
          )}
          <kbd className="text-xs bg-slate-100 px-1.5 py-0.5 rounded border text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {debouncedQuery.length < 2 && (
            <p className="text-center text-sm text-muted-foreground py-6">
              Escribe al menos 2 caracteres para buscar
            </p>
          )}
          {debouncedQuery.length >= 2 && data?.items.length === 0 && !isFetching && (
            <p className="text-center text-sm text-muted-foreground py-6">
              No se encontraron pacientes con "{debouncedQuery}"
            </p>
          )}
          {data?.items.map((patient) => (
            <PatientCard
              key={patient.id}
              patient={patient}
              onClick={() => handleSelect(patient.id)}
              className="mb-1"
            />
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t bg-slate-50 text-xs text-muted-foreground">
          ↵ para abrir · ESC para cerrar
        </div>
      </div>
    </div>
  );
}
