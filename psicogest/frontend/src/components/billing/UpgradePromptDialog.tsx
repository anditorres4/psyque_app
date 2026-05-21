import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useBillingStatus } from "@/hooks/useBillingStatus";
import { billingApi } from "@/services/billing";

interface UpgradePromptDialogProps {
  open: boolean;
  onClose: () => void;
}

export function UpgradePromptDialog({ open, onClose }: UpgradePromptDialogProps) {
  const navigate = useNavigate();
  const { data: billing } = useBillingStatus();

  const handleUpgrade = async () => {
    if (billing?.subscription_status === "active") {
      const { portal_url } = await billingApi.createCustomerPortal();
      window.location.href = portal_url;
    } else {
      navigate("/select-plan");
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-[var(--psy-primary)]">
            Función exclusiva del plan Premium
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          RIPS automático, Facturación electrónica DIAN y Funciones IA están
          incluidos en el plan Premium ($90.000 COP/mes).
        </p>
        <DialogFooter className="flex gap-2 flex-row">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cerrar
          </Button>
          <Button
            onClick={handleUpgrade}
            className="flex-1 bg-[var(--psy-sage)] hover:bg-[var(--psy-sage)]/90 text-white"
          >
            Ver planes →
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
