import { useState } from "react";

import { ProfileForm } from "@/components/settings/ProfileForm";
import { AvailabilityGrid } from "@/components/settings/AvailabilityGrid";

const TABS = [
  { id: "perfil", label: "Perfil profesional" },
  { id: "disponibilidad", label: "Disponibilidad" },
  { id: "recordatorios", label: "Recordatorios" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function SettingsPage() {
  const [active, setActive] = useState<TabId>("perfil");

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-[#1E3A5F]">Configuración</h1>

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
    </div>
  );
}