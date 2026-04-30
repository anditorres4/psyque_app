import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import type { HMSPrebuiltRefType } from "@100mslive/roomkit-react";
import type { Screens } from "@100mslive/types-prebuilt";
import { api, ApiError } from "@/lib/api";

const HMSPrebuilt = lazy(() =>
  import("@100mslive/roomkit-react").then((m) => ({ default: m.HMSPrebuilt }))
);

export function JoinPage() {
  const { appointmentId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const initialToken = searchParams.get("t");
  const joinKey = searchParams.get("k");
  const role = searchParams.get("role");
  const peerName = searchParams.get("name") || (role === "host" ? "Psicólogo" : "Paciente");
  const prebuiltRef = useRef<HMSPrebuiltRefType | null>(null);
  const [token, setToken] = useState(initialToken);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const screens = useMemo<Screens | undefined>(() => {
    if (role !== "patient") return undefined;
    return {
      preview: {
        skip_preview_screen: true,
      },
    };
  }, [role]);

  useEffect(() => {
    if (initialToken || role !== "patient" || !joinKey || !appointmentId) return;

    let active = true;
    void api.video.getPublicJoinToken(appointmentId, joinKey)
      .then((data) => {
        if (!active) return;
        setToken(data.token);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setTokenError(
          err instanceof ApiError
            ? err.message
            : "No fue posible reconectar la videollamada."
        );
      });

    return () => {
      active = false;
    };
  }, [appointmentId, initialToken, joinKey, role]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-center">
          <p className="text-[#1E3A5F] font-semibold mb-2">
            {tokenError ? "No fue posible entrar" : "Preparando videollamada"}
          </p>
          <p className="text-sm text-muted-foreground">
            {tokenError ?? "Estamos generando un acceso nuevo para esta cita."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-black">
      <Suspense
        fallback={
          <div className="h-screen w-screen flex items-center justify-center bg-[#F8FAFC]">
            <p className="text-sm text-muted-foreground">Iniciando videollamada...</p>
          </div>
        }
      >
        <div className="h-full w-full">
          <HMSPrebuilt
            ref={prebuiltRef}
            authToken={token}
            options={{ userName: peerName }}
            screens={screens}
            onJoin={() => {
              if (role === "patient" && prebuiltRef.current) {
                void prebuiltRef.current.hmsActions.setLocalAudioEnabled(true);
                void prebuiltRef.current.hmsActions.setLocalVideoEnabled(true);
              }
            }}
          />
        </div>
      </Suspense>
    </div>
  );
}
