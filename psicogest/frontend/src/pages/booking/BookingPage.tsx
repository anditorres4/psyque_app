import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { BookingRequestCreate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SESSION_TYPE_OPTIONS = [
  { value: "individual", label: "Individual" },
  { value: "couple", label: "Pareja" },
  { value: "family", label: "Familia" },
  { value: "followup", label: "Seguimiento" },
] as const;

function groupSlotsByDate(slots: string[]): Record<string, string[]> {
  return slots.reduce<Record<string, string[]>>((acc, slot) => {
    const date = slot.split("T")[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(slot);
    return acc;
  }, {});
}

export function BookingPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: info, isLoading, isError } = useQuery({
    queryKey: ["booking", slug],
    queryFn: () => api.booking.getInfo(slug!),
    enabled: !!slug,
    retry: false,
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sessionType, setSessionType] = useState<BookingRequestCreate["session_type"]>("individual");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: (body: BookingRequestCreate) => api.booking.createRequest(slug!, body),
    onSuccess: () => setSuccess(true),
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Error al enviar solicitud."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) { setFormError("Selecciona un horario disponible."); return; }
    setFormError(null);
    mutation.mutate({
      patient_name: name, patient_email: email,
      patient_phone: phone || undefined, session_type: sessionType,
      requested_start: selectedSlot, notes: notes || undefined,
    });
  };

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <p className="text-muted-foreground text-sm">Cargando...</p>
    </div>
  );

  if (isError || !info) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <div className="text-center space-y-2">
        <p className="text-lg font-semibold text-[#1E3A5F]">Enlace no disponible</p>
        <p className="text-sm text-muted-foreground">Esta página no existe o el agendamiento está desactivado.</p>
      </div>
    </div>
  );

  if (success) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <div className="text-center space-y-3 max-w-sm">
        <div className="text-4xl">✓</div>
        <p className="text-lg font-semibold text-[#1E3A5F]">¡Solicitud enviada!</p>
        <p className="text-sm text-muted-foreground">
          {info.tenant_name} revisará tu solicitud y se pondrá en contacto contigo.
        </p>
      </div>
    </div>
  );

  const slotsByDate = groupSlotsByDate(info.slots);

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-10 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-[#1E3A5F]">{info.tenant_name}</h1>
          {info.welcome_message && (
            <p className="text-sm text-muted-foreground">{info.welcome_message}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-100 shadow-sm p-6 space-y-4">
          {formError && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">{formError}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="name">Nombre completo *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tipo de sesión</Label>
            <Select value={sessionType} onValueChange={(v) => setSessionType(v as typeof sessionType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SESSION_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Horario disponible *</Label>
            {info.slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay horarios disponibles en los próximos 14 días.</p>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto border rounded-md p-3">
                {Object.entries(slotsByDate).map(([date, dateSlots]) => (
                  <div key={date}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                      {new Date(date + "T12:00:00").toLocaleDateString("es-CO", {
                        weekday: "long", month: "long", day: "numeric",
                      })}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {dateSlots.map((slot) => (
                        <button
                          key={slot} type="button" onClick={() => setSelectedSlot(slot)}
                          className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                            selectedSlot === slot
                              ? "bg-[#1E3A5F] text-white border-[#1E3A5F]"
                              : "border-gray-200 hover:border-[#2E86AB] hover:text-[#2E86AB]"
                          }`}
                        >
                          {new Date(slot).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Motivo / Notas (opcional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Enviando..." : "Solicitar cita"}
          </Button>
        </form>
      </div>
    </div>
  );
}