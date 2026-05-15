import { lazy, Suspense, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Video, VideoOff, Copy, Check } from "lucide-react";
import { api } from "@/lib/api";

const HMSPrebuilt = lazy(() =>
  import("@100mslive/roomkit-react").then((m) => ({ default: m.HMSPrebuilt }))
);

interface Props {
  appointmentId: string | null;
}

export function HmsVideoPanel({ appointmentId }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [patientUrl, setPatientUrl] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [copied, setCopied] = useState(false);

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!appointmentId) throw new Error("Sin cita asociada");
      const room = await api.video.createRoom(appointmentId);
      return room;
    },
    onSuccess: (room) => {
      setToken(room.host_token);
      setPatientUrl(room.patient_join_url);
      setJoined(true);
    },
  });

  const handleCopyLink = () => {
    if (!patientUrl) return;
    navigator.clipboard.writeText(patientUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!appointmentId) {
    return (
      <div
        className="flex flex-col items-center justify-center h-48 rounded-xl gap-3"
        style={{ background: "var(--psy-bg-soft)", border: "1px dashed var(--psy-line)" }}
      >
        <VideoOff size={28} style={{ color: "var(--psy-ink-3)" }} />
        <span className="psy-mono text-[12px]" style={{ color: "var(--psy-ink-3)" }}>
          Sin videollamada — sesión sin cita asociada
        </span>
      </div>
    );
  }

  if (!joined) {
    return (
      <div
        className="flex flex-col items-center justify-center h-48 rounded-xl gap-4"
        style={{ background: "var(--psy-bg-soft)", border: "1px dashed var(--psy-line)" }}
      >
        <Video size={28} style={{ color: "var(--psy-primary)" }} />
        <button
          type="button"
          onClick={() => joinMutation.mutate()}
          disabled={joinMutation.isPending}
          className="psy-mono text-[13px] px-5 py-2.5 rounded-lg font-medium transition-opacity disabled:opacity-60"
          style={{ background: "var(--psy-primary)", color: "#fff" }}
        >
          {joinMutation.isPending ? "Iniciando…" : "Unirse a videollamada"}
        </button>
        {joinMutation.isError && (
          <span className="psy-mono text-[11px]" style={{ color: "var(--psy-danger)" }}>
            {(joinMutation.error as Error).message}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl overflow-hidden" style={{ border: "1px solid var(--psy-line)" }}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: "var(--psy-surface)", borderBottom: "1px solid var(--psy-line)" }}
      >
        <span className="psy-mono text-[11px] font-medium flex items-center gap-1.5" style={{ color: "var(--psy-primary)" }}>
          <Video size={13} />
          Videollamada en curso
        </span>
        {patientUrl && (
          <button
            type="button"
            onClick={handleCopyLink}
            className="psy-mono text-[11px] flex items-center gap-1 transition-colors"
            style={{ color: copied ? "var(--psy-sage)" : "var(--psy-ink-3)" }}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? "Copiado" : "Copiar link paciente"}
          </button>
        )}
      </div>

      {/* Video embed */}
      <div style={{ height: "340px", position: "relative" }}>
        <Suspense
          fallback={
            <div className="h-full flex items-center justify-center psy-mono text-[12px]" style={{ color: "var(--psy-ink-3)" }}>
              Iniciando videollamada…
            </div>
          }
        >
          {token && (
            <HMSPrebuilt
              authToken={token}
              options={{ userName: "Psicólogo" }}
              onLeave={() => setJoined(false)}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}
