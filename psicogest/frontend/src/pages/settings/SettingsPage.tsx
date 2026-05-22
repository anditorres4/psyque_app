import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";

import { ProfileForm } from "@/components/settings/ProfileForm";
import { AvailabilityGrid } from "@/components/settings/AvailabilityGrid";
import { BookingSettings } from "@/components/settings/BookingSettings";
import { GoogleCalendarSettings } from "@/components/settings/GoogleCalendarSettings";
import { AiSettings } from "@/components/settings/AiSettings";
import { useBillingStatus } from "@/hooks/useBillingStatus";
import { billingApi } from "@/services/billing";

const TABS = [
  { id: "perfil", label: "Perfil profesional" },
  { id: "disponibilidad", label: "Disponibilidad" },
  { id: "recordatorios", label: "Recordatorios" },
  { id: "agendamiento", label: "Agendamiento" },
  { id: "google-calendar", label: "Google Calendar" },
  { id: "psycent-ia", label: "PsyCent IA" },
  { id: "plan", label: "Plan y facturación" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function PlanTabContent() {
  const { data: billing, isLoading } = useBillingStatus();
  const [portalLoading, setPortalLoading] = useState(false);

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando...</p>;
  if (!billing) return null;

  const planLabels: Record<string, string> = {
    free_trial: "Prueba gratuita",
    estandar: "Estándar",
    premium: "Premium",
  };

  const statusLabels: Record<string, string> = {
    trial: "Período de prueba",
    active: "Activo",
    past_due: "Pago pendiente",
    canceled: "Cancelado",
    expired: "Vencido",
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const { portal_url } = await billingApi.createCustomerPortal();
      window.location.href = portal_url;
    } catch {
      // error handled silently
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="rounded-[var(--radius)] p-5 space-y-4" style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--psy-ink-1)]">Plan actual</p>
          <p className="text-2xl font-bold text-[var(--psy-primary)]">
            {planLabels[billing.plan] ?? billing.plan}
          </p>
        </div>
        <span className="text-xs px-3 py-1 rounded-full font-medium"
          style={{ background: billing.subscription_status === "active" ? "var(--psy-sage-bg)" : "#fef3c7", color: billing.subscription_status === "active" ? "var(--psy-ok)" : "#92400e" }}>
          {statusLabels[billing.subscription_status] ?? billing.subscription_status}
        </span>
      </div>

      {billing.days_remaining > 0 && (
        <p className="text-sm text-muted-foreground">
          Vence en <strong>{billing.days_remaining} día{billing.days_remaining !== 1 ? "s" : ""}</strong>
        </p>
      )}

      <div className="flex gap-3 flex-wrap">
        <Link to="/select-plan"
          className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-[var(--psy-sage)] text-white hover:opacity-90 transition-opacity">
          Actualizar plan
        </Link>
        {billing.subscription_status === "active" && (
          <button onClick={handlePortal} disabled={portalLoading}
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium border border-[var(--psy-line)] text-[var(--psy-ink-1)] hover:bg-[var(--psy-bg)] transition-colors disabled:opacity-50">
            {portalLoading ? "Abriendo..." : "Gestionar suscripción →"}
          </button>
        )}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const [active, setActive] = useState<TabId>("perfil");
  const [gcalConnected, setGcalConnected] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const gcalParam = searchParams.get("gcal");
  const tabParam = searchParams.get("tab");

  useEffect(() => {
    if (gcalParam === "connected") {
      setActive("google-calendar");
      setGcalConnected(true);
      setSearchParams({}, { replace: true });
    }
  }, [gcalParam, setSearchParams]);

  useEffect(() => {
    if (tabParam === "plan") setActive("plan");
  }, [tabParam]);

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="psy-page-title">Configuración</h1>

      {gcalConnected && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "var(--psy-sage-bg)", border: "1px solid var(--psy-sage-soft)", color: "var(--psy-ok)" }}>
          ✓ Google Calendar conectado correctamente. Las citas se sincronizarán automáticamente.
        </div>
      )}
      {gcalParam === "error" && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "color-mix(in srgb, var(--psy-danger) 8%, var(--psy-surface))", border: "1px solid color-mix(in srgb, var(--psy-danger) 25%, var(--psy-line))", color: "var(--psy-danger)" }}>
          No se pudo conectar con Google Calendar. Intenta de nuevo.
        </div>
      )}

      <div className="flex flex-wrap border-b gap-x-6 gap-y-0 overflow-x-auto psy-no-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`shrink-0 pb-2 text-sm font-medium border-b-2 transition-colors ${
              active === tab.id
                ? "border-[var(--psy-sage)] text-[var(--psy-primary)]"
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
          <div className="rounded-[var(--radius)] p-4 space-y-2" style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}>
            <h3 className="text-sm font-semibold text-[var(--psy-ink-1)]">Recordatorios automáticos por email</h3>
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
            <div className="rounded-md p-3 text-xs mt-2" style={{ background: "var(--psy-sage-bg)", border: "1px solid var(--psy-sage-soft)", color: "var(--psy-ok)" }}>
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

      {active === "psycent-ia" && (
        <section className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configura el proveedor de IA para usar las funcionalidades de PsyCent IA.
          </p>
          <AiSettings />
        </section>
      )}

      {active === "plan" && (
        <section className="space-y-4 max-w-md">
          <PlanTabContent />
        </section>
      )}
    </div>
  );
}