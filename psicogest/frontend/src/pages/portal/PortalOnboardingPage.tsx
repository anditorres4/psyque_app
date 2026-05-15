import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, OnboardingStatus } from "@/lib/api";
import { CheckCircle2, Circle, ChevronRight, AlertTriangle } from "lucide-react";

// ── Document content ─────────────────────────────────────────────────────────

const DOC_LABELS: Record<string, string> = {
  service_conditions: "Condiciones de prestación del servicio",
  consent_therapeutic: "Consentimiento informado del proceso terapéutico",
  assent_minor_u13: "Asentimiento informado (menor de 13 años)",
  assent_minor_13_18: "Asentimiento informado (13 a 17 años)",
  consent_guardian: "Consentimiento del adulto responsable",
  intake_questionnaire: "Confirmación de datos personales",
};

const DOC_CONTENT: Record<string, React.ReactNode> = {
  service_conditions: (
    <div className="space-y-3 text-sm leading-relaxed" style={{ color: "var(--psy-ink-2)" }}>
      <p><strong>1. Modalidad del servicio</strong><br />
        Las sesiones se realizan de forma virtual a través de videollamada en plataforma segura, o de forma presencial según lo acordado.
        La duración estándar de cada sesión es de 50 minutos.
      </p>
      <p><strong>2. Valor y forma de pago</strong><br />
        El valor por sesión fue informado y acordado previamente con el profesional.
        El pago debe realizarse antes o al inicio de cada sesión, salvo acuerdo previo distinto.
        En caso de paquetes de sesiones, el valor no reembolsable una vez iniciado el proceso.
      </p>
      <p><strong>3. Cancelaciones y reagendamientos</strong><br />
        Se solicita notificar cancelaciones con al menos 24 horas de anticipación.
        Cancelaciones tardías o inasistencias sin aviso pueden generar cobro de la sesión a criterio del profesional.
      </p>
      <p><strong>4. Comunicación entre sesiones</strong><br />
        El psicólogo no está disponible para atención de emergencias entre sesiones.
        En caso de crisis, debe contactar una línea de emergencias (línea 106 — Salud Mental, Colombia).
      </p>
      <p><strong>5. Registros y plataforma</strong><br />
        Las notas clínicas y la historia clínica se almacenan de forma segura conforme a la Res. 1995/1999.
        Los resúmenes de sesión para el paciente se comparten a través de este portal.
      </p>
    </div>
  ),

  consent_therapeutic: (
    <div className="space-y-3 text-sm leading-relaxed" style={{ color: "var(--psy-ink-2)" }}>
      <p><strong>Consentimiento informado para proceso psicoterapéutico</strong></p>
      <p>
        Declaro que he sido informado(a) sobre la naturaleza del proceso terapéutico,
        sus objetivos, metodología, posibles riesgos y beneficios esperados.
      </p>
      <p><strong>Confidencialidad</strong><br />
        Toda la información compartida en este proceso es estrictamente confidencial y
        está protegida por el secreto profesional (Ley 1090/2006) y la Ley de Protección
        de Datos Personales (Ley 1581/2012).
      </p>
      <p><strong>Excepciones a la confidencialidad</strong><br />
        La confidencialidad puede levantarse únicamente cuando exista riesgo inminente
        para la vida del paciente o de terceros, o por orden judicial debidamente motivada.
      </p>
      <p><strong>Derechos del paciente</strong><br />
        Tengo derecho a acceder, rectificar y solicitar la supresión de mis datos en cualquier
        momento. Puedo retirar este consentimiento y finalizar el proceso terapéutico cuando lo desee,
        sin que ello genere consecuencias negativas. Mi historia clínica se conservará por 20 años
        según la normativa vigente (Res. 1995/1999).
      </p>
      <p>
        Al aceptar este documento, autorizo expresamente el tratamiento de mis datos personales
        y de salud para los fines del proceso psicológico descrito.
      </p>
    </div>
  ),

  assent_minor_u13: (
    <div className="space-y-4 text-sm leading-relaxed" style={{ color: "var(--psy-ink-2)" }}>
      <p className="text-base font-semibold" style={{ color: "var(--psy-ink-1)" }}>
        Este es un espacio seguro para ti 🌱
      </p>
      <p>
        Vamos a tener conversaciones donde puedes hablar de cómo te sientes, qué te preocupa,
        o cosas que te han pasado. Todo lo que me cuentes lo guardo con cuidado.
      </p>
      <p><strong>¿Quién puede saber lo que hablamos?</strong><br />
        Lo que me cuentes es privado. Solo si veo que estás en peligro, le informaré a tu mamá,
        papá o a quien te cuida para protegerte.
      </p>
      <p><strong>Tus derechos</strong><br />
        Puedes decirme si no quieres hablar de algo. Puedes hacer preguntas cuando quieras.
        Puedes decidir no continuar si así lo deseas.
      </p>
      <p>
        Si estás de acuerdo con participar en este proceso, marca la casilla de abajo.
      </p>
    </div>
  ),

  assent_minor_13_18: (
    <div className="space-y-3 text-sm leading-relaxed" style={{ color: "var(--psy-ink-2)" }}>
      <p><strong>Asentimiento informado para adolescentes (13 a 17 años)</strong></p>
      <p>
        Se te ha explicado en qué consiste este proceso psicoterapéutico, cuáles son sus
        objetivos y cómo se desarrollará. Participar en este proceso es voluntario.
      </p>
      <p><strong>Confidencialidad</strong><br />
        La información que compartas en las sesiones es confidencial. Solo se informará a
        tu representante legal en caso de riesgo inminente para tu integridad o la de otros,
        o cuando la ley lo exija.
      </p>
      <p><strong>Tus derechos</strong><br />
        Tienes derecho a hacer preguntas sobre el proceso en cualquier momento.
        Puedes decidir no responder preguntas específicas. Puedes retirar tu asentimiento
        y abandonar el proceso cuando lo desees, sin consecuencias negativas.
      </p>
      <p>
        Al marcar la casilla, confirmas que entiendes esta información y que participas
        de manera voluntaria en el proceso terapéutico.
      </p>
    </div>
  ),

  consent_guardian: (
    <div className="space-y-3 text-sm leading-relaxed" style={{ color: "var(--psy-ink-2)" }}>
      <p><strong>Consentimiento del representante legal / adulto responsable</strong></p>
      <p>
        Como representante legal o adulto responsable del menor, declaro que he sido
        informado(a) sobre la naturaleza del proceso psicoterapéutico, sus objetivos,
        metodología y alcances.
      </p>
      <p>
        Autorizo expresamente al menor bajo mi cuidado a participar en el proceso
        terapéutico con el profesional de psicología, y autorizo el tratamiento de sus
        datos personales y de salud conforme a la Ley 1581/2012 y la Res. 1995/1999.
      </p>
      <p>
        Entiendo que la información compartida por el menor en las sesiones es confidencial,
        y que solo se me informará en caso de riesgo inminente para su integridad.
      </p>
    </div>
  ),

  intake_questionnaire: (
    <div className="space-y-3 text-sm leading-relaxed" style={{ color: "var(--psy-ink-2)" }}>
      <p>
        Para iniciar el proceso terapéutico, el psicólogo necesita tener tus datos personales
        completos y actualizados en el sistema.
      </p>
      <p>
        Tu información fue registrada por el profesional o durante tu proceso de registro.
        Al confirmar este paso, declaras que los datos registrados son correctos y que
        autorizas su uso para los fines del proceso psicológico.
      </p>
      <p>
        Si necesitas corregir algún dato, comunícaselo directamente a tu psicólogo antes
        de comenzar las sesiones.
      </p>
    </div>
  ),
};

const ACCEPT_LABELS: Record<string, string> = {
  service_conditions: "He leído y acepto las condiciones de prestación del servicio.",
  consent_therapeutic: "He leído y acepto el consentimiento informado del proceso terapéutico. Autorizo el tratamiento de mis datos personales y de salud.",
  assent_minor_u13: "Estoy de acuerdo con participar en las sesiones.",
  assent_minor_13_18: "He leído este documento y doy mi asentimiento para participar en el proceso terapéutico.",
  consent_guardian: "Soy el representante legal / adulto responsable del paciente y otorgo mi consentimiento para el proceso terapéutico.",
  intake_questionnaire: "Confirmo que mis datos personales son correctos y autorizo su uso para el proceso psicológico.",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function PortalOnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [accepted, setAccepted] = useState(false);

  const { data: status, isLoading, isError } = useQuery({
    queryKey: ["portal", "onboarding"],
    queryFn: () => api.portal.onboardingStatus(),
  });

  const signMutation = useMutation({
    mutationFn: (doc_type: string) => api.portal.signDocument(doc_type),
    onSuccess: (res) => {
      setAccepted(false);
      queryClient.invalidateQueries({ queryKey: ["portal", "onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["portal", "me"] });
      if (res.onboarding_complete) {
        navigate("/portal/dashboard", { replace: true });
      }
    },
  });

  if (isLoading) return <OnboardingShell><LoadingState /></OnboardingShell>;
  if (isError || !status) return (
    <OnboardingShell>
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertTriangle size={32} style={{ color: "var(--psy-warm-amber, #D97706)" }} />
        <p className="text-sm" style={{ color: "var(--psy-ink-2)" }}>
          No se pudo cargar el estado de onboarding. Intenta recargar la página.
        </p>
      </div>
    </OnboardingShell>
  );

  if (status.status === "active") {
    navigate("/portal/dashboard", { replace: true });
    return null;
  }

  const currentDoc = status.pending_docs[0];
  const totalSteps = status.required_docs.length;
  const completedSteps = status.signed_docs.length;

  return (
    <OnboardingShell>
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--psy-ink-4)" }}>
            Paso {completedSteps + 1} de {totalSteps}
          </span>
          <span className="text-xs" style={{ color: "var(--psy-ink-4)" }}>
            {Math.round((completedSteps / totalSteps) * 100)}% completado
          </span>
        </div>
        <div className="h-1.5 rounded-full" style={{ background: "var(--psy-line)" }}>
          <div
            className="h-1.5 rounded-full transition-all duration-500"
            style={{
              width: `${(completedSteps / totalSteps) * 100}%`,
              background: "var(--psy-primary, #1E3A5F)",
            }}
          />
        </div>
      </div>

      {/* Steps index */}
      <div className="space-y-2 mb-6">
        {status.required_docs.map((doc, i) => {
          const signed = status.signed_docs.some((s) => s.doc_type === doc);
          const isCurrent = doc === currentDoc;
          return (
            <div
              key={doc}
              className="flex items-center gap-3 px-4 py-3 rounded-lg"
              style={{
                background: isCurrent ? "var(--psy-primary-faint, #EEF4FF)" : "transparent",
                border: isCurrent ? "1px solid var(--psy-primary-light, #BFDBFE)" : "1px solid transparent",
              }}
            >
              {signed ? (
                <CheckCircle2 size={18} style={{ color: "var(--psy-sage, #4CAF7D)", flexShrink: 0 }} />
              ) : (
                <Circle
                  size={18}
                  style={{ color: isCurrent ? "var(--psy-primary, #1E3A5F)" : "var(--psy-ink-4)", flexShrink: 0 }}
                />
              )}
              <span
                className="text-sm"
                style={{
                  color: signed
                    ? "var(--psy-ink-4)"
                    : isCurrent
                    ? "var(--psy-ink-1)"
                    : "var(--psy-ink-3)",
                  fontWeight: isCurrent ? 600 : 400,
                  textDecoration: signed ? "line-through" : "none",
                }}
              >
                {i + 1}. {DOC_LABELS[doc] ?? doc}
              </span>
              {isCurrent && (
                <ChevronRight size={14} style={{ color: "var(--psy-primary, #1E3A5F)", marginLeft: "auto", flexShrink: 0 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Current document */}
      {currentDoc && (
        <div
          className="rounded-xl border p-5"
          style={{ background: "var(--psy-surface)", borderColor: "var(--psy-line)" }}
        >
          <h2 className="text-base font-semibold mb-4" style={{ color: "var(--psy-ink-1)" }}>
            {DOC_LABELS[currentDoc] ?? currentDoc}
          </h2>

          <div
            className="rounded-lg p-4 mb-4 max-h-72 overflow-y-auto"
            style={{ background: "var(--psy-bg, #F4F1EC)", border: "1px solid var(--psy-line)" }}
          >
            {DOC_CONTENT[currentDoc] ?? (
              <p className="text-sm" style={{ color: "var(--psy-ink-2)" }}>
                Documento en preparación.
              </p>
            )}
          </div>

          <label className="flex items-start gap-3 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[var(--psy-primary,#1E3A5F)]"
            />
            <span className="text-sm" style={{ color: "var(--psy-ink-2)" }}>
              {ACCEPT_LABELS[currentDoc] ?? "He leído y acepto este documento."}{" "}
              <span style={{ color: "var(--psy-danger, #DC2626)" }}>*</span>
            </span>
          </label>

          {signMutation.isError && (
            <p className="text-sm mb-3" style={{ color: "var(--psy-danger, #DC2626)" }}>
              {(signMutation.error as Error).message}
            </p>
          )}

          <button
            type="button"
            disabled={!accepted || signMutation.isPending}
            onClick={() => signMutation.mutate(currentDoc)}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
            style={{ background: "var(--psy-primary, #1E3A5F)", color: "#fff" }}
          >
            {signMutation.isPending
              ? "Guardando..."
              : completedSteps + 1 === totalSteps
              ? "Finalizar y acceder al portal →"
              : "Aceptar y continuar →"}
          </button>
        </div>
      )}
    </OnboardingShell>
  );
}

function OnboardingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--psy-bg, #F4F1EC)" }}>
      <div className="max-w-xl mx-auto px-4 pt-10 pb-16">
        <div className="text-center mb-8">
          <h1 className="psy-serif text-2xl italic mb-1" style={{ color: "var(--psy-ink-1)" }}>
            Bienvenido/a a tu portal
          </h1>
          <p className="text-sm" style={{ color: "var(--psy-ink-3)" }}>
            Antes de comenzar, necesitamos que leas y aceptes los siguientes documentos.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-12 rounded-lg animate-pulse"
          style={{ background: "var(--psy-line)" }}
        />
      ))}
    </div>
  );
}
