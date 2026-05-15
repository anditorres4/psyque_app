import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

const CUPS_LABELS: Record<string, string> = {
  "890101": "Primera vez",
  "890102": "Control",
  "890403": "Psicoterapia individual adultos",
  "890404": "Psicoterapia individual niños/adolescentes",
  "890601": "Psicoterapia de pareja",
  "890701": "Psicoterapia familiar",
};

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function PortalSessionsPage() {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["portal", "sessions"],
    queryFn: () => api.portal.sessions(),
  });

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingGlobal, setDownloadingGlobal] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showFilter, setShowFilter] = useState(false);

  const handleDownloadSession = async (sessionId: string) => {
    setDownloadingId(sessionId);
    try {
      const { blob, filename } = await api.portal.downloadSessionCertificate(sessionId);
      triggerDownload(blob, filename);
    } catch {
      // silently fail — user will see no download
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadGlobal = async () => {
    setDownloadingGlobal(true);
    try {
      const { blob, filename } = await api.portal.downloadGlobalCertificate({
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      triggerDownload(blob, filename);
    } catch {
      // silently fail
    } finally {
      setDownloadingGlobal(false);
    }
  };

  return (
    <div className="space-y-5 pb-12">
      <div>
        <h1 className="psy-serif text-2xl italic" style={{ color: "var(--psy-ink-1)" }}>Mis sesiones</h1>
        <p className="text-xs mt-1" style={{ color: "var(--psy-ink-4)" }}>
          Solo sesiones firmadas por tu psicólogo.
        </p>
      </div>

      {/* Global certificate card */}
      {sessions && sessions.length > 0 && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: "var(--psy-ink-1)" }}>
              Constancia general de asistencia
            </p>
            <button
              type="button"
              onClick={() => setShowFilter((v) => !v)}
              className="text-xs px-2 py-1 rounded-md transition-colors"
              style={{ color: "var(--psy-primary)", background: "var(--psy-bg-soft)" }}
            >
              {showFilter ? "Ocultar filtros" : "Filtrar fechas"}
            </button>
          </div>
          {showFilter && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs" style={{ color: "var(--psy-ink-3)" }}>Desde</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full mt-0.5 rounded-md border px-2 py-1.5 text-sm focus:outline-none"
                  style={{ borderColor: "var(--psy-line)", background: "var(--psy-surface)" }}
                />
              </div>
              <div>
                <label className="text-xs" style={{ color: "var(--psy-ink-3)" }}>Hasta</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full mt-0.5 rounded-md border px-2 py-1.5 text-sm focus:outline-none"
                  style={{ borderColor: "var(--psy-line)", background: "var(--psy-surface)" }}
                />
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={handleDownloadGlobal}
            disabled={downloadingGlobal}
            className="w-full py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
            style={{ background: "var(--psy-primary)", color: "#fff" }}
          >
            {downloadingGlobal ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            {downloadingGlobal ? "Generando…" : "Descargar constancia general"}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: "var(--psy-ink-3)" }}>
          No hay sesiones registradas.
        </p>
      ) : (
        <div className="divide-y rounded-lg border overflow-hidden" style={{ borderColor: "var(--psy-line)" }}>
          {sessions.map((s) => {
            const d = new Date(s.actual_start);
            const isDownloading = downloadingId === s.id;
            return (
              <div
                key={s.id}
                className="px-4 py-3 flex items-center justify-between gap-3"
                style={{ background: "var(--psy-surface)" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium" style={{ color: "var(--psy-ink-1)" }}>
                      {d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    <span className="text-xs psy-mono" style={{ color: "var(--psy-ink-3)" }}>
                      {d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "var(--psy-ink-3)" }}>
                    {s.diagnosis_cie11} · {CUPS_LABELS[s.cups_code] ?? s.cups_code}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadSession(s.id)}
                  disabled={isDownloading}
                  className="shrink-0 p-1.5 rounded-md transition-colors disabled:opacity-50"
                  style={{ color: "var(--psy-primary)", background: "var(--psy-bg-soft)" }}
                  title="Descargar constancia de esta sesión"
                >
                  {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
