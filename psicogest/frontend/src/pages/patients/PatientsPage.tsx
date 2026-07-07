import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePatients, useCreatePatient } from "@/hooks/usePatients";
import { PatientCard } from "@/components/patients/PatientCard";
import { PatientForm } from "@/components/patients/PatientForm";
import { Button } from "@/components/ui/button";
import { PsyButton } from "@/components/ui/psy";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { type PatientCreatePayload, ApiError } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { api as rawApi } from "@/lib/api";

const PAGE_SIZE = 20;

export function PatientsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined);
  const [filterEps, setFilterEps] = useState<boolean | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [settingUp, setSettingUp] = useState(false);
  const [setupDone, setSetupDone] = useState(false);

  const handleSetup = async () => {
    setSettingUp(true);
    try {
      await rawApi.auth.setupProfile();
      // Force Supabase to issue a new JWT with the tenant_id now set in app_metadata
      await supabase.auth.refreshSession();
      setSetupDone(true);
      window.location.reload();
    } catch {
      setSettingUp(false);
    }
  };

  const { data, isLoading, isError, error } = usePatients({
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
    <div className="px-4 py-5 md:px-8 md:py-7">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="psy-page-title">Pacientes</h1>
          {data && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {data.total} paciente{data.total !== 1 ? "s" : ""} registrado{data.total !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <PsyButton
          variant="primary"
          onClick={() => { setShowForm(true); setFormError(null); }}
        >
          + Nuevo paciente
        </PsyButton>
      </div>

      {/* New patient form (inline modal) */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--psy-surface)] rounded-xl shadow-xl w-full max-w-2xl my-8 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-[var(--psy-ink-1)]">Registrar nuevo paciente</h2>
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
              <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-[var(--psy-danger)]" role="alert">
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
      <div className="flex flex-col gap-2 mb-4">
        <Input
          placeholder="Buscar por nombre, apellido o documento..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
        <div className="flex items-center gap-2 flex-wrap">
          {([
            { value: undefined, label: "Todos" },
            { value: true,      label: "Activos" },
            { value: false,     label: "Inactivos" },
          ] as const).map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => { setFilterActive(opt.value); setPage(1); }}
              className="text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors border"
              style={
                filterActive === opt.value
                  ? { background: "var(--psy-primary)", color: "#fff", borderColor: "var(--psy-primary)" }
                  : { background: "var(--psy-surface)", color: "var(--psy-ink-2)", borderColor: "var(--psy-line)" }
              }
            >
              {opt.label}
            </button>
          ))}
          <span className="mx-1 text-[11px]" style={{ color: "var(--psy-line)" }}>|</span>
          {([
            { value: undefined, label: "Con y sin EPS" },
            { value: true,      label: "Con EPS" },
            { value: false,     label: "Sin EPS" },
          ] as const).map((opt) => (
            <button
              key={`eps-${String(opt.value)}`}
              type="button"
              onClick={() => { setFilterEps(opt.value); setPage(1); }}
              className="text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors border"
              style={
                filterEps === opt.value
                  ? { background: "var(--psy-primary)", color: "#fff", borderColor: "var(--psy-primary)" }
                  : { background: "var(--psy-surface)", color: "var(--psy-ink-2)", borderColor: "var(--psy-line)" }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Patient list */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      )}
      {isError && (
        <div className="text-center py-12">
          {error instanceof ApiError && error.status === 401 ? (
            <div className="max-w-sm mx-auto space-y-3">
              <p className="text-[var(--psy-primary)] font-medium">Tu cuenta aún no está configurada</p>
              <p className="text-sm text-muted-foreground">
                Necesitas activar tu perfil profesional para empezar a registrar pacientes.
              </p>
              <Button
                className="bg-[var(--psy-primary)] hover:bg-[var(--psy-primary-soft)]"
                onClick={handleSetup}
                disabled={settingUp || setupDone}
              >
                {settingUp ? "Configurando..." : "Activar mi cuenta"}
              </Button>
            </div>
          ) : (
            <ErrorState />
          )}
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
