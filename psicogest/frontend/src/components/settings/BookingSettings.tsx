import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import QRCode from "react-qr-code";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function BookingSettings() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.profile.get(),
  });

  const [welcomeMsg, setWelcomeMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.profile.update>[0]) => api.profile.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2000);
    },
    onError: () => setSaveError("Error al guardar cambios."),
  });

  if (isLoading || !profile) return <div className="text-sm text-muted-foreground">Cargando...</div>;

  const bookingUrl = profile.booking_slug
    ? `${window.location.origin}/book/${profile.booking_slug}`
    : null;
  const effectiveMsg = welcomeMsg ?? profile.booking_welcome_message ?? "";

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4 bg-white flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#1E3A5F]">Agendamiento público</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Comparte un enlace para que los pacientes soliciten citas.
          </p>
        </div>
        <Button
          variant={profile.booking_enabled ? "default" : "outline"}
          size="sm"
          onClick={() => { setSaveError(null); updateMutation.mutate({ booking_enabled: !profile.booking_enabled }); }}
          disabled={updateMutation.isPending}
          className={profile.booking_enabled ? "bg-[#27AE60] hover:bg-green-700 text-white" : ""}
        >
          {profile.booking_enabled ? "Activo" : "Inactivo"}
        </Button>
      </div>

      {profile.booking_enabled && !bookingUrl && (
        <div className="rounded-lg border p-4 bg-amber-50 space-y-3">
          <p className="text-sm font-semibold text-amber-800">Enlace no generado</p>
          <p className="text-xs text-amber-700">
            El enlace de agendamiento no se ha generado. Haz clic para crear uno.
          </p>
          <Button
            size="sm"
            onClick={() => { setSaveError(null); updateMutation.mutate({ booking_enabled: true }); }}
            disabled={updateMutation.isPending}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            Generar enlace
          </Button>
        </div>
      )}

      {profile.booking_enabled && bookingUrl && (
        <>
          <div className="rounded-lg border p-4 bg-white space-y-2">
            <p className="text-sm font-semibold text-[#1E3A5F]">Enlace de agendamiento</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-gray-50 border rounded px-2 py-1 flex-1 break-all">{bookingUrl}</code>
              <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(bookingUrl)}>
                Copiar
              </Button>
            </div>
          </div>

          <div className="rounded-lg border p-4 bg-white space-y-3">
            <p className="text-sm font-semibold text-[#1E3A5F]">Código QR</p>
            <div className="flex justify-center p-4 bg-white border rounded-lg">
              <QRCode value={bookingUrl} size={160} />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Imprime o comparte en redes sociales.
            </p>
          </div>

          <div className="rounded-lg border p-4 bg-white space-y-3">
            <p className="text-sm font-semibold text-[#1E3A5F]">Mensaje de bienvenida</p>
            <Label htmlFor="welcome_msg" className="sr-only">Mensaje de bienvenida</Label>
            <Textarea
              id="welcome_msg" rows={3}
              value={effectiveMsg}
              onChange={(e) => setWelcomeMsg(e.target.value)}
              placeholder="Ej: Bienvenido/a. Completa el formulario para solicitar una cita."
            />
            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
            <div className="flex justify-end gap-2">
              {saveOk && <span className="text-xs text-green-600 self-center">✓ Guardado</span>}
              <Button size="sm" onClick={() => { setSaveError(null); updateMutation.mutate({ booking_welcome_message: effectiveMsg }); }} disabled={updateMutation.isPending}>
                Guardar mensaje
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}