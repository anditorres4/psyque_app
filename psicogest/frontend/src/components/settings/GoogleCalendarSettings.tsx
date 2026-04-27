import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useGCalStatus, useGCalConnect, useGCalDisconnect, useGCalSyncNow } from "@/hooks/useGoogleCalendar";

export function GoogleCalendarSettings() {
  const { data: status, isLoading } = useGCalStatus();
  const connectMutation = useGCalConnect();
  const disconnectMutation = useGCalDisconnect();
  const syncMutation = useGCalSyncNow();
  const [syncDone, setSyncDone] = useState(false);

  const handleSync = () => {
    setSyncDone(false);
    syncMutation.mutate(undefined, { onSuccess: () => setSyncDone(true) });
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border p-4 bg-white flex items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[#1E3A5F]">Google Calendar</p>
          <p className="text-xs text-muted-foreground">
            {status?.connected
              ? "Conectado — las citas se sincronizan automáticamente con tu calendario."
              : "No conectado — conecta para sincronizar citas bidireccionalmente."}
          </p>
        </div>
        <div className="shrink-0">
          {status?.connected ? (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 font-medium">
              ● Conectado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
              ○ Desconectado
            </span>
          )}
        </div>
      </div>

      {!status?.connected ? (
        <Button
          onClick={() => connectMutation.mutate()}
          disabled={connectMutation.isPending}
          className="w-full bg-[#1E3A5F] hover:bg-[#162d4a] text-white"
        >
          {connectMutation.isPending ? "Redirigiendo..." : "Conectar con Google Calendar"}
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border p-4 bg-white space-y-3">
            <p className="text-sm font-semibold text-[#1E3A5F]">Sincronización de eventos externos</p>
            <p className="text-xs text-muted-foreground">
              Los eventos de tu Google Calendar que no son citas de Psyque se importan cada 15 minutos y bloquean esos horarios en el agendamiento público.
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? "Sincronizando..." : "Sincronizar ahora"}
              </Button>
              {syncDone && (
                <span className="text-xs text-green-600">✓ Sincronización completada</span>
              )}
              {syncMutation.isError && (
                <span className="text-xs text-red-600">Error al sincronizar</span>
              )}
            </div>
          </div>

          <div className="rounded-lg border p-4 bg-gray-50 space-y-2">
            <p className="text-xs font-semibold text-[#1E3A5F]">¿Cómo funciona?</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              <li>Citas creadas en Psyque → aparecen automáticamente en tu Google Calendar.</li>
              <li>Al actualizar o cancelar una cita en Psyque → el evento de GCal se actualiza/elimina.</li>
              <li>Eventos personales en GCal → bloquean esos horarios para el agendamiento público.</li>
            </ul>
          </div>

          <div className="rounded-lg border border-red-100 p-4 bg-white flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-red-700">Desconectar</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Las citas existentes en Google Calendar no se eliminarán.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-red-300 text-red-600 hover:bg-red-50 shrink-0"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
            >
              {disconnectMutation.isPending ? "Desconectando..." : "Desconectar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}