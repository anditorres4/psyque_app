import { useState } from "react";
import { useReferrals, useCreateReferral } from "@/hooks/useReferrals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/api";
import type { ReferralCreate } from "@/lib/api";

interface ReferralsTabProps {
  patientId: string;
}

const PRIORITY_OPTIONS = [
  { value: "programado", label: "Programado" },
  { value: "preferente", label: "Preferente" },
  { value: "urgente", label: "Urgente" },
] as const;

function ReferralCard({ referral, onDownloadPdf }: { referral: any; onDownloadPdf: () => void }) {
  const priorityColors: Record<string, string> = {
    urgente: "bg-red-100 text-red-800 border-red-200",
    preferente: "bg-amber-100 text-amber-800 border-amber-200",
    programado: "bg-green-100 text-green-800 border-green-200",
  };
  
  const priorityLabels: Record<string, string> = {
    urgente: "Urgente",
    preferente: "Preferente",
    programado: "Programado",
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${priorityColors[referral.priority]}`}>
            {priorityLabels[referral.priority]}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(referral.created_at).toLocaleDateString("es-CO", { 
              year: "numeric", 
              month: "short", 
              day: "numeric" 
            })}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={onDownloadPdf}>
          Descargar PDF
        </Button>
      </div>
      
      <div className="space-y-1">
        <div className="flex gap-1 text-sm">
          <span className="font-medium text-xs uppercase text-muted-foreground w-24 shrink-0">Referido a</span>
          <span className="font-medium">{referral.referred_to_name}</span>
        </div>
        <div className="flex gap-1 text-sm">
          <span className="font-medium text-xs uppercase text-muted-foreground w-24 shrink-0">Especialidad</span>
          <span>{referral.referred_to_specialty}</span>
        </div>
        {referral.referred_to_institution && (
          <div className="flex gap-1 text-sm">
            <span className="font-medium text-xs uppercase text-muted-foreground w-24 shrink-0">Institución</span>
            <span>{referral.referred_to_institution}</span>
          </div>
        )}
      </div>

      <div className="text-sm space-y-1">
        <p className="font-medium text-xs uppercase text-muted-foreground">Motivo</p>
        <p>{referral.reason}</p>
      </div>
      
      {referral.notes && (
        <div className="text-sm">
          <p className="font-medium text-xs uppercase text-muted-foreground">Observaciones</p>
          <p className="text-sm">{referral.notes}</p>
        </div>
      )}
    </div>
  );
}

function ReferralForm({ patientId, onSuccess, onCancel }: { patientId: string; onSuccess: () => void; onCancel: () => void }) {
  const createMutation = useCreateReferral(patientId);
  const [error, setError] = useState<string | null>(null);
  
  const [referred_to_name, setReferredToName] = useState("");
  const [referred_to_specialty, setReferredToSpecialty] = useState("");
  const [referred_to_institution, setReferredToInstitution] = useState("");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<"programado">("programado");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const payload: ReferralCreate = {
      referred_to_name,
      referred_to_specialty,
      referred_to_institution: referred_to_institution || undefined,
      reason,
      priority,
      notes: notes || undefined,
    };

    try {
      await createMutation.mutateAsync(payload);
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al crear remisión.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="referred_to_name">Nombre del profesional *</Label>
          <Input
            id="referred_to_name"
            value={referred_to_name}
            onChange={(e) => setReferredToName(e.target.value)}
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="referred_to_specialty">Especialidad *</Label>
          <Input
            id="referred_to_specialty"
            value={referred_to_specialty}
            onChange={(e) => setReferredToSpecialty(e.target.value)}
            required
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="referred_to_institution">Institución</Label>
        <Input
          id="referred_to_institution"
          value={referred_to_institution}
          onChange={(e) => setReferredToInstitution(e.target.value)}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="reason">Motivo de remisión *</Label>
        <Textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="priority">Prioridad</Label>
        <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="notes">Observaciones</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>
      
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </form>
  );
}

export function ReferralsTab({ patientId }: ReferralsTabProps) {
  const { data: referrals, isLoading, isError } = useReferrals(patientId);
  const [showForm, setShowForm] = useState(false);

  const handleDownloadPdf = async (referralId: string) => {
    try {
      const result = await api.referrals.downloadPdf(referralId);
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading PDF:", err);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Cargando remisiones...</div>;
  }

  if (isError) {
    return <div className="p-8 text-center text-red-600">Error al cargar remisiones.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button>Nueva remisión</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva remisión</DialogTitle>
            </DialogHeader>
            <ReferralForm
              patientId={patientId}
              onSuccess={() => setShowForm(false)}
              onCancel={() => setShowForm(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {!referrals || referrals.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground border rounded-lg">
          No hay remisiones registradas.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {referrals.map((referral) => (
            <ReferralCard
              key={referral.id}
              referral={referral}
              onDownloadPdf={() => handleDownloadPdf(referral.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}