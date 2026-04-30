import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";

const HMSPrebuilt = lazy(() =>
  import("@100mslive/roomkit-react").then((m) => ({ default: m.HMSPrebuilt }))
);

export function JoinPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("t");

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
    <div className="min-h-screen bg-black">
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
            <p className="text-sm text-muted-foreground">Iniciando videollamada...</p>
          </div>
        }
      >
        <HMSPrebuilt
          authToken={token}
          options={{ userName: "Paciente" }}
        />
      </Suspense>
    </div>
  );
}
