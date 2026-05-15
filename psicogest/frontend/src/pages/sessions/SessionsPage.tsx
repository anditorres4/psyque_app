import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSessions, useCreateSession } from "@/hooks/useSessions";
import { SessionForm } from "@/components/sessions/SessionForm";
import { SessionDetail } from "@/components/sessions/SessionDetail";
import type { SessionCreatePayload, SessionSummary } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader, PsyButton, PsyCard, Tag } from "@/components/ui/psy";
import { Plus } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  signed: "Firmada",
};

const STATUS_TONES: Record<string, "amber" | "sage"> = {
  draft: "amber",
  signed: "sage",
};

function SessionCard({ session, onClick }: { session: SessionSummary; onClick: () => void }) {
  const start = new Date(session.actual_start);
  return (
    <button
      type="button"
      className="w-full p-4 rounded-[var(--radius)] transition-colors hover:bg-[var(--psy-bg-soft)] text-left"
      style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="psy-mono text-[12px]" style={{ color: "var(--psy-ink-2)" }}>
          {start.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" })}
        </span>
        <Tag tone={STATUS_TONES[session.status] ?? "default"}>
          {STATUS_LABELS[session.status] ?? session.status}
        </Tag>
      </div>
      <div className="flex items-center gap-3 mb-2">
        <span className="psy-mono font-semibold" style={{ color: "var(--psy-primary)" }}>
          {session.diagnosis_cie11}
        </span>
        <span className="psy-mono text-[11px]" style={{ color: "var(--psy-ink-3)" }}>
          {session.cups_code}
        </span>
      </div>
      <span className="psy-mono psy-tab-num text-[14px] font-semibold" style={{ color: "var(--psy-ink-1)" }}>
        ${Number(session.session_fee).toLocaleString("es-CO")}
      </span>
    </button>
  );
}

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
      // Redirect to the two-panel documentation view
      navigate(`/sessions/${sess.id}/doc`, { replace: true });
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Error al crear la sesión.");
    }
  };

  if (selectedSessionId) {
    return (
      <div className="max-w-3xl">
        <SessionDetail
          sessionId={selectedSessionId}
          onBack={() => setSelectedSessionId(null)}
        />
      </div>
    );
  }

  const handleRowClick = (sess: SessionSummary) => {
    if (sess.status === "draft") {
      navigate(`/sessions/${sess.id}/doc`);
    } else {
      setSelectedSessionId(sess.id);
    }
  };

  if (isNewMode) {
    return (
      <div className="max-w-2xl">
        <button
          type="button"
          onClick={() => navigate("/sessions")}
          className="psy-mono text-[12px] mb-5 flex items-center gap-1 transition-colors"
          style={{ color: "var(--psy-ink-3)" }}
        >
          ← Volver a sesiones
        </button>
        <h1 className="psy-page-title mb-6">Nueva nota de sesión</h1>
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

  const items = data?.items ?? [];
  const draftCount = items.filter((s) => s.status === "draft").length;
  const signedCount = items.filter((s) => s.status === "signed").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sesiones activas"
        subtitle={
          isLoading
            ? "Cargando…"
            : `${items.length} nota${items.length !== 1 ? "s" : ""}${draftCount > 0 ? ` · ${draftCount} borrador${draftCount !== 1 ? "es" : ""}` : ""}`
        }
        actions={
          <PsyButton
            variant="primary"
            icon={<Plus size={14} />}
            onClick={() => navigate("/sessions?new")}
          >
            Nueva sesión
          </PsyButton>
        }
      />

      {/* Filter strip */}
      <div className="flex items-center gap-2">
        {(["", "draft", "signed"] as const).map((val) => (
          <button
            key={val}
            type="button"
            onClick={() => setStatusFilter(val)}
            className="psy-mono text-[11px] px-3 py-1.5 rounded-full transition-colors"
            style={{
              background: statusFilter === val ? "var(--psy-primary)" : "var(--psy-surface)",
              color: statusFilter === val ? "#fff" : "var(--psy-ink-3)",
              border: "1px solid var(--psy-line)",
            }}
          >
            {val === "" ? "Todas" : STATUS_LABELS[val]}
          </button>
        ))}
        {draftCount > 0 && (
          <span className="ml-auto psy-mono text-[11px]" style={{ color: "var(--psy-warn)" }}>
            {draftCount} sin firmar
          </span>
        )}
      </div>

      {isLoading && (
        <PsyCard padded={false}>
          <div className="p-4 space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        </PsyCard>
      )}

      {isError && !isLoading && (
        <PsyCard>
          <ErrorState />
        </PsyCard>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <PsyCard>
          <EmptyState
            title="Sin sesiones registradas"
            description={statusFilter ? "No hay sesiones con ese filtro." : "Crea tu primera nota de sesión para comenzar."}
            icon="📝"
          />
        </PsyCard>
      )}

      {!isLoading && items.length > 0 && (
        <>
          {/* Tabla — md+ */}
          <div className="hidden md:block">
            <PsyCard padded={false}>
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--psy-line)" }}>
                    {["Fecha", "CIE-11", "CUPS", "Valor", "Estado"].map((h, i) => (
                      <th
                        key={h}
                        className={`px-[18px] py-3 psy-mono text-[10.5px] uppercase tracking-wider font-medium ${i === 3 ? "text-right" : "text-left"}`}
                        style={{ color: "var(--psy-ink-3)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((sess) => (
                    <tr
                      key={sess.id}
                      onClick={() => handleRowClick(sess)}
                      className="cursor-pointer transition-colors hover:bg-[var(--psy-bg-soft)]"
                      style={{ borderBottom: "1px solid var(--psy-line)" }}
                    >
                      <td className="px-[18px] py-3 psy-mono text-[12px]" style={{ color: "var(--psy-ink-2)" }}>
                        {new Date(sess.actual_start).toLocaleDateString("es-CO", {
                          year: "numeric", month: "short", day: "numeric",
                        })}
                      </td>
                      <td className="px-[18px] py-3 psy-mono font-semibold" style={{ color: "var(--psy-primary)" }}>
                        {sess.diagnosis_cie11}
                      </td>
                      <td className="px-[18px] py-3 psy-mono" style={{ color: "var(--psy-ink-2)" }}>
                        {sess.cups_code}
                      </td>
                      <td className="px-[18px] py-3 psy-mono psy-tab-num text-right" style={{ color: "var(--psy-ink-1)" }}>
                        ${Number(sess.session_fee).toLocaleString("es-CO")}
                      </td>
                      <td className="px-[18px] py-3">
                        <Tag tone={STATUS_TONES[sess.status] ?? "default"}>
                          {STATUS_LABELS[sess.status] ?? sess.status}
                        </Tag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {signedCount > 0 && (
                <div
                  className="px-[18px] py-2.5 psy-mono text-[11px] flex justify-between"
                  style={{ borderTop: "1px solid var(--psy-line)", color: "var(--psy-ink-3)" }}
                >
                  <span>{signedCount} firma{signedCount !== 1 ? "s" : ""}</span>
                  <span>{draftCount} borrador{draftCount !== 1 ? "es" : ""}</span>
                </div>
              )}
            </PsyCard>
          </div>

          {/* Cards — mobile */}
          <div className="md:hidden space-y-3">
            {items.map((sess) => (
              <SessionCard
                key={sess.id}
                session={sess}
                onClick={() => handleRowClick(sess)}
              />
            ))}
            {signedCount > 0 && (
              <div
                className="px-4 py-2.5 psy-mono text-[11px] flex justify-between"
                style={{ color: "var(--psy-ink-3)" }}
              >
                <span>{signedCount} firma{signedCount !== 1 ? "s" : ""}</span>
                <span>{draftCount} borrador{draftCount !== 1 ? "es" : ""}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
