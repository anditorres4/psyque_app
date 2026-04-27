import { useState } from "react";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import { ProfileForm } from "@/components/settings/ProfileForm";
import { AvailabilityGrid } from "@/components/settings/AvailabilityGrid";
import { BookingSettings } from "@/components/settings/BookingSettings";
import { GoogleCalendarSettings } from "@/components/settings/GoogleCalendarSettings";
import { AiSettings } from "@/components/settings/AiSettings";

const TABS = [
  { id: "perfil", label: "Perfil profesional" },
  { id: "disponibilidad", label: "Disponibilidad" },
  { id: "recordatorios", label: "Recordatorios" },
  { id: "agendamiento", label: "Agendamiento" },
  { id: "google-calendar", label: "Google Calendar" },
  { id: "psyque-ia", label: "Psyque IA" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function SettingsPage() {
  const [active, setActive] = useState<TabId>("perfil");
  const [gcalConnected, setGcalConnected] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const gcalParam = searchParams.get("gcal");

  useEffect(() => {
    if (gcalParam === "connected") {
      setActive("google-calendar");
      setGcalConnected(true);
      setSearchParams({}, { replace: true });
    }
  }, [gcalParam, setSearchParams]);

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-[#1E3A5F]">Configuración</h1>

      {gcalConnected && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          ✓ Google Calendar conectado correctamente. Las citas se sincronizarán automáticamente.
        </div>
      )}
      {gcalParam === "error" && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          No se pudo conectar con Google Calendar. Intenta de nuevo.
        </div>
      )}

      <div className="flex border-b gap-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              active === tab.id
                ? "border-[#2E86AB] text-[#1E3A5F]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === "perfil" && (
        <section className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Esta información aparece en los encabezados de RIPS, facturas y notas de sesión.
          </p>
          <ProfileForm />
        </section>
      )}

      {active === "disponibilidad" && (
        <section className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Define los bloques horarios en que atiendes. El sistema los usa como referencia al agendar citas.
          </p>
          <AvailabilityGrid />
        </section>
      )}

      {active === "recordatorios" && (
        <section className="space-y-4">
          <div className="rounded-lg border p-4 bg-white space-y-2">
            <h3 className="text-sm font-semibold text-[#1E3A5F]">Recordatorios automáticos por email</h3>
            <p className="text-sm text-muted-foreground">
              El sistema envía automáticamente dos recordatorios por cita:
            </p>
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li>48 horas antes de la cita</li>
              <li>2 horas antes de la cita</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Los recordatorios se envían al email registrado del paciente. Si el paciente no tiene email, se omiten.
            </p>
            <div className="rounded-md bg-green-50 border border-green-200 p-3 text-xs text-green-800 mt-2">
              ✓ Recordatorios activos — el sistema revisa citas pendientes cada 15 minutos.
            </div>
          </div>
        </section>
      )}

      {active === "agendamiento" && (
        <section className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Permite que tus pacientes soliciten citas mediante un enlace público o código QR.
          </p>
          <BookingSettings />
        </section>
      )}

      {active === "google-calendar" && (
        <section className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sincroniza tus citas con Google Calendar y bloquea horarios automáticamente.
          </p>
          <GoogleCalendarSettings />
        </section>
      )}

      {active === "psyque-ia" && (
        <section className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configura el proveedor de IA para usar las funcionalidades de Psyque IA.
          </p>
          <AiSettings />
        </section>
      )}
    </div>
  );
}