import { lazy, Suspense, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import type { HMSPrebuiltRefType } from "@100mslive/roomkit-react";
import type { Screens } from "@100mslive/types-prebuilt";

const HMSPrebuilt = lazy(() =>
  import("@100mslive/roomkit-react").then((m) => ({ default: m.HMSPrebuilt }))
);

export function JoinPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("t");
  const role = searchParams.get("role");
  const peerName = searchParams.get("name") || (role === "psychologist" ? "Psicólogo" : "Paciente");
  const prebuiltRef = useRef<HMSPrebuiltRefType | null>(null);
  const screens = useMemo<Screens | undefined>(() => {
    if (role !== "patient") return undefined;
    return {
      preview: {
        skip_preview_screen: true,
      },
    };
  }, [role]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-center">
          <p className="text-[#1E3A5F] font-semibold mb-2">Link inválido</p>
          <p className="text-sm text-muted-foreground">
            El link de videollamada no es válido o ha expirado.
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
