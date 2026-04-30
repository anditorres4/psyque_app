import { lazy, Suspense } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const HMSPrebuilt = lazy(() =>
  import("@100mslive/roomkit-react").then((m) => ({ default: m.HMSPrebuilt }))
);

interface Props {
  open: boolean;
  onClose: () => void;
  hostToken: string;
  patientJoinUrl: string;
}

export function VideoCallModal({ open, onClose, hostToken, patientJoinUrl }: Props) {
  const handleCopyLink = () => {
    navigator.clipboard.writeText(patientJoinUrl);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl w-full h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b flex flex-row items-center justify-between">
          <DialogTitle className="text-[#1E3A5F] text-sm font-semibold">
            Videollamada en curso
          </DialogTitle>
          <button
            type="button"
            onClick={handleCopyLink}
            className="text-xs text-[#2E86AB] hover:underline mr-6"
            title="Copiar link del paciente"
          >
            Copiar link del paciente
          </button>
        </DialogHeader>

        <div className="flex-1 overflow-hidden w-full h-full">
          {!hostToken ? (
            <div className="h-full flex items-center justify-center text-sm text-[#E74C3C]">
              Error: no se obtuvo el token de sala. Revisa los logs del backend.
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Iniciando videollamada...
                </div>
              }
            >
              <HMSPrebuilt
                authToken={hostToken}
                options={{ userName: "Psicólogo" }}
                onLeave={onClose}
              />
            </Suspense>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
