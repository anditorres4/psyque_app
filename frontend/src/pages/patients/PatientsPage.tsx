import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePatients, useCreatePatient } from "@/hooks/usePatients";
import { PatientCard } from "@/components/patients/PatientCard";
import { PatientForm } from "@/components/patients/PatientForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type PatientCreatePayload, ApiError } from "@/lib/api";

const PAGE_SIZE = 20;

export function PatientsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined);
  const [filterEps, setFilterEps] = useState<boolean | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isError } = usePatients({
    page,
    page_size: PAGE_SIZE,
    search: search.length >= 2 ? search : undefined,
    active: filterActive,
    has_eps: filterEps,
  });

  const createMutation = useCreatePatient();

  const handleCreate = async (payload: PatientCreatePayload) => {
    setFormError(null);
    try {
      const patient = await createMutation.mutateAsync(payload);
      setShowForm(false);
      navigate(`/patients/${patient.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError(err.message);
      } else {
        setFormError("Error al registrar el paciente. Intenta de nuevo.");
      }
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Pacientes</h1>
          {data && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {data.total} paciente{data.total !== 1 ? "s" : ""} registrado{data.total !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <Button
          className="bg-[#2E86AB] hover:bg-[#1E3A5F]"
          onClick={() => { setShowForm(true); setFormError(null); }}
        >
          + Nuevo paciente
        </Button>
      </div>

      {/* New patient form (inline modal) */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-[#1E3A5F]">Registrar nuevo paciente</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            {formError && (
              <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-[#E74C3C]" role="alert">
                {formError}
              </div>
            )}
            <PatientForm
              onSubmit={handleCreate}
              isSubmitting={createMutation.isPending}
            />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <Input
          placeholder="Buscar por nombre, apellido o documento..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
        <select
          className="h-10 rounded-md border border-input px-3 text-sm"
          value={filterActive === undefined ? "" : String(filterActive)}
          onChange={(e) => {
            setFilterActive(e.target.value === "" ? undefined : e.target.value === "true");
            setPage(1);
          }}
        >
          <option value="">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
        <select
          className="h-10 rounded-md border border-input px-3 text-sm"
          value={filterEps === undefined ? "" : String(filterEps)}
          onChange={(e) => {
            setFilterEps(e.target.value === "" ? undefined : e.target.value === "true");
            setPage(1);
          }}
        >
          <option value="">Con y sin EPS</option>
          <option value="true">Con EPS</option>
          <option value="false">Sin EPS</option>
        </select>
      </div>

      {/* Patient list */}
      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">Cargando pacientes...</div>
      )}
      {isError && (
        <div className="text-center py-12 text-[#E74C3C]">
          Error al cargar pacientes. Verifica tu conexión.
        </div>
      )}
      {data && data.items.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {search ? "No se encontraron pacientes con esa búsqueda." : "Aún no tienes pacientes registrados."}
        </div>
      )}
      {data && data.items.length > 0 && (
        <>
          <div className="space-y-2">
            {data.items.map((patient) => (
              <PatientCard
                key={patient.id}
                patient={patient}
                onClick={() => navigate(`/patients/${patient.id}`)}
              />
            ))}
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-muted-foreground">
                Página {data.page} de {data.pages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ← Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente →
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
