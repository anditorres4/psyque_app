import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSessions, useCreateSession } from "@/hooks/useSessions";
import { SessionForm } from "@/components/sessions/SessionForm";
import { SessionDetail } from "@/components/sessions/SessionDetail";
import type { SessionCreatePayload } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  signed: "Firmada",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-amber-50 text-amber-700",
  signed: "bg-green-50 text-green-700",
};

export function SessionsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const prefilledApptId = searchParams.get("appointment_id") ?? "";
  const prefilledPatientId = searchParams.get("patient_id") ?? "";
  const prefilledStart = searchParams.get("start") ?? "";
  const prefilledEnd = searchParams.get("end") ?? "";
  const isNewMode = searchParams.get("new") !== null || !!prefilledApptId;

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data, isLoading, isError } = useSessions({ status: statusFilter || undefined });
  const createMutation = useCreateSession();

  const handleCreate = async (payload: SessionCreatePayload) => {
    setCreateError(null);
    try {
      const sess = await createMutation.mutateAsync(payload);
      setSelectedSessionId(sess.id);
      navigate("/sessions", { replace: true });
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Error al crear la sesión.");
    }
  };

  if (selectedSessionId) {
    return (
      <div className="p-8 max-w-3xl">
        <SessionDetail
          sessionId={selectedSessionId}
          onBack={() => setSelectedSessionId(null)}
        />
      </div>
    );
  }

  if (isNewMode) {
    return (
      <div className="p-8 max-w-2xl">
        <button
          type="button"
          onClick={() => navigate("/sessions")}
          className="text-sm text-muted-foreground hover:text-foreground mb-4 block"
        >
          ← Volver a sesiones
        </button>
        <h1 className="text-2xl font-bold text-[#1E3A5F] mb-6">Nueva nota de sesión</h1>
        <SessionForm
          defaultAppointmentId={prefilledApptId}
          defaultPatientId={prefilledPatientId}
          defaultStart={prefilledStart}
          defaultEnd={prefilledEnd}
          onSubmit={handleCreate}
          isSubmitting={createMutation.isPending}
          error={createError}
        />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Sesiones</h1>
        <button
          type="button"
          onClick={() => navigate("/sessions?new")}
          className="bg-[#2E86AB] hover:bg-[#1E3A5F] text-white text-sm px-4 py-2 rounded-md"
        >
          + Nueva sesión
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <select
          className="h-9 rounded-md border border-input px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="draft">Borradores</option>
          <option value="signed">Firmadas</option>
        </select>
      </div>

      {isLoading && (
        <div className="border rounded-lg overflow-hidden">
          <Skeleton className="h-10 border-b" />
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-12 border-b last:border-0" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <div className="border rounded-lg p-8">
          <ErrorState />
        </div>
      )}

      {!isLoading && !isError && data && data.items.length === 0 && (
        <div className="border rounded-lg p-8">
          <EmptyState
            title="Sin sesiones registradas"
            description={statusFilter ? "No hay sesiones con ese filtro." : "Crea tu primera nota de sesión para comenzar."}
            icon="📝"
          />
        </div>
      )}

      {!isLoading && data && data.items.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">CIE-11</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">CUPS</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.items.map((sess) => (
                <tr
                  key={sess.id}
                  onClick={() => setSelectedSessionId(sess.id)}
                  className="hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    {new Date(sess.actual_start).toLocaleDateString("es-CO", {
                      year: "numeric", month: "short", day: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 font-mono">{sess.diagnosis_cie11}</td>
                  <td className="px-4 py-3 font-mono">{sess.cups_code}</td>
                  <td className="px-4 py-3 text-right">${Number(sess.session_fee).toLocaleString("es-CO")}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[sess.status] ?? ""}`}>
                      {STATUS_LABELS[sess.status] ?? sess.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
