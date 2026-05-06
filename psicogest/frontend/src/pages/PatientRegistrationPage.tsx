import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { API_BASE } from "@/lib/api";
import { MUNICIPIOS } from "@/data/municipios";
import { EPS_COLOMBIA } from "@/lib/eps-colombia";

interface PsychInfo {
  psychologist_name: string;
  token: string;
  status: string;
}

async function fetchPsychInfo(slug: string): Promise<PsychInfo> {
  const res = await fetch(`${API_BASE}/public/patient-registration/${slug}`);
  if (!res.ok) throw new Error("Enlace no válido");
  return res.json();
}

async function submitRegistration(slug: string, data: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${API_BASE}/public/patient-registration/${slug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Error al enviar" }));
    throw new Error(err.detail);
  }
}

type Step = "personal" | "antecedentes" | "consent" | "done";

const DOC_TYPES = ["CC", "TI", "CE", "PA", "RC", "MS"] as const;
const SEX_OPTIONS = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Femenino" },
  { value: "I", label: "Indeterminado / Intersexual" },
];
const MARITAL_OPTIONS = [
  { value: "S", label: "Soltero/a" },
  { value: "C", label: "Casado/a" },
  { value: "U", label: "Unión libre" },
  { value: "D", label: "Divorciado/a" },
  { value: "V", label: "Viudo/a" },
  { value: "SE", label: "Separado/a" },
];
const PAYER_OPTIONS = [
  { value: "PA", label: "Particular (pago directo)" },
  { value: "CC", label: "Contributivo (EPS)" },
  { value: "SS", label: "Subsidiado (EPS)" },
  { value: "PE", label: "Especial" },
  { value: "SE", label: "Excepción" },
];

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full h-10 rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30";
const textareaCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30";

export function PatientRegistrationPage() {
  const { slug } = useParams<{ slug: string }>();
  const [step, setStep] = useState<Step>("personal");
  const [form, setForm] = useState({
    // Personal
    first_name: "", first_surname: "", second_surname: "",
    doc_type: "CC", doc_number: "", birth_date: "",
    biological_sex: "M", gender_identity: "", marital_status: "S",
    occupation: "", email: "", phone: "",
    address: "", municipality_dane: "11001", zone: "U",
    payer_type: "PA", eps_name: "",
    emergency_contact_name: "", emergency_contact_phone: "",
    // Antecedentes
    motivo_consulta: "",
    antecedentes_medicos: "",
    medicamentos_actuales: "",
    antecedentes_psicologicos: "",
    antecedentes_familiares: "",
    // Consent
    consent_accepted: false,
  });

  const set = (key: string, val: string | boolean) => setForm((f) => ({ ...f, [key]: val }));

  const { data: psych, isLoading, isError } = useQuery({
    queryKey: ["psych-info", slug],
    queryFn: () => fetchPsychInfo(slug!),
    enabled: !!slug,
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: () => submitRegistration(slug!, {
      ...form,
      second_surname: form.second_surname || null,
      gender_identity: form.gender_identity || null,
      antecedentes_medicos: form.antecedentes_medicos || null,
      medicamentos_actuales: form.medicamentos_actuales || null,
      antecedentes_psicologicos: form.antecedentes_psicologicos || null,
      antecedentes_familiares: form.antecedentes_familiares || null,
      eps_name: form.eps_name || null,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
      condiciones_actuales: [],
    }),
    onSuccess: () => setStep("done"),
  });

  if (isLoading) return <Centered>Cargando...</Centered>;
  if (isError || !psych) return <Centered>Enlace no válido o expirado.</Centered>;
  if (step === "done") return (
    <Centered>
      <div className="max-w-sm text-center p-8 bg-white rounded-2xl shadow-sm border border-slate-100">
        <div className="text-5xl mb-4">🌿</div>
        <h2 className="text-xl font-semibold text-slate-700 mb-2">¡Registro enviado!</h2>
        <p className="text-sm text-slate-500">
          Tu información ha sido recibida por <strong>{psych.psychologist_name}</strong>.
          Pronto recibirás un correo de bienvenida para coordinar tu primera cita.
        </p>
      </div>
    </Centered>
  );

  return (
    <div className="min-h-screen bg-[#F0F4F8] p-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6 pt-6">
          <div className="text-3xl mb-2">🌿</div>
          <h1 className="text-xl font-semibold text-slate-700">Registro de paciente</h1>
          <p className="text-sm text-slate-500 mt-1">
            Proceso terapéutico con <strong>{psych.psychologist_name}</strong>
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {(["personal", "antecedentes", "consent"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s ? "bg-[#2E86AB] text-white" :
                (["personal", "antecedentes", "consent"].indexOf(step) > i ? "bg-[#2E86AB]/20 text-[#2E86AB]" : "bg-slate-200 text-slate-500")
              }`}>{i + 1}</div>
              {i < 2 && <div className="w-8 h-px bg-slate-200" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
          {step === "personal" && (
            <>
              <h2 className="text-base font-semibold text-slate-700 mb-4">Datos personales</h2>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Primer nombre" required>
                  <input className={inputCls} value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
                </Field>
                <Field label="Primer apellido" required>
                  <input className={inputCls} value={form.first_surname} onChange={(e) => set("first_surname", e.target.value)} />
                </Field>
                <Field label="Segundo apellido">
                  <input className={inputCls} value={form.second_surname} onChange={(e) => set("second_surname", e.target.value)} />
                </Field>
                <Field label="Tipo de documento" required>
                  <select className={inputCls} value={form.doc_type} onChange={(e) => set("doc_type", e.target.value)}>
                    {DOC_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Número de documento" required>
                  <input className={inputCls} value={form.doc_number} onChange={(e) => set("doc_number", e.target.value)} />
                </Field>
                <Field label="Fecha de nacimiento" required>
                  <input type="date" className={inputCls} value={form.birth_date} onChange={(e) => set("birth_date", e.target.value)} />
                </Field>
                <Field label="Sexo biológico" required>
                  <select className={inputCls} value={form.biological_sex} onChange={(e) => set("biological_sex", e.target.value)}>
                    {SEX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label="Estado civil" required>
                  <select className={inputCls} value={form.marital_status} onChange={(e) => set("marital_status", e.target.value)}>
                    {MARITAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Ocupación" required>
                <input className={inputCls} value={form.occupation} onChange={(e) => set("occupation", e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email" required>
                  <input type="email" className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} />
                </Field>
                <Field label="Teléfono" required>
                  <input className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </Field>
              </div>
              <Field label="Dirección" required>
                <input className={inputCls} value={form.address} onChange={(e) => set("address", e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Régimen" required>
                  <select className={inputCls} value={form.payer_type} onChange={(e) => set("payer_type", e.target.value)}>
                    {PAYER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                {(form.payer_type === "CC" || form.payer_type === "SS") && (
                  <Field label="EPS">
                    <input className={inputCls} value={form.eps_name} onChange={(e) => set("eps_name", e.target.value)} placeholder="Nombre de la EPS..." />
                  </Field>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Contacto de emergencia">
                  <input className={inputCls} value={form.emergency_contact_name} onChange={(e) => set("emergency_contact_name", e.target.value)} />
                </Field>
                <Field label="Tel. emergencia">
                  <input className={inputCls} value={form.emergency_contact_phone} onChange={(e) => set("emergency_contact_phone", e.target.value)} />
                </Field>
              </div>

              <button
                type="button"
                className="w-full py-3 rounded-xl bg-[#2E86AB] text-white font-semibold text-sm"
                onClick={() => setStep("antecedentes")}
                disabled={!form.first_name || !form.first_surname || !form.doc_number || !form.birth_date || !form.email || !form.phone}
              >
                Continuar →
              </button>
            </>
          )}

          {step === "antecedentes" && (
            <>
              <h2 className="text-base font-semibold text-slate-700 mb-4">Antecedentes y motivo de consulta</h2>
              <Field label="Motivo de consulta" required>
                <textarea
                  className={textareaCls}
                  value={form.motivo_consulta}
                  onChange={(e) => set("motivo_consulta", e.target.value)}
                  placeholder="¿Qué te trae a terapia? ¿Qué esperas lograr en este proceso?"
                />
              </Field>
              <Field label="Antecedentes médicos (enfermedades, cirugías, etc.)">
                <textarea className={textareaCls} value={form.antecedentes_medicos} onChange={(e) => set("antecedentes_medicos", e.target.value)} placeholder="Describe si tienes alguna condición médica relevante..." />
              </Field>
              <Field label="Medicamentos actuales">
                <textarea className={textareaCls} value={form.medicamentos_actuales} onChange={(e) => set("medicamentos_actuales", e.target.value)} placeholder="¿Estás tomando algún medicamento actualmente?" />
              </Field>
              <Field label="Antecedentes psicológicos/psiquiátricos">
                <textarea className={textareaCls} value={form.antecedentes_psicologicos} onChange={(e) => set("antecedentes_psicologicos", e.target.value)} placeholder="¿Has recibido atención psicológica o psiquiátrica antes?" />
              </Field>
              <Field label="Antecedentes familiares relevantes">
                <textarea className={textareaCls} value={form.antecedentes_familiares} onChange={(e) => set("antecedentes_familiares", e.target.value)} placeholder="¿Hay condiciones de salud mental en tu familia?" />
              </Field>
              <div className="flex gap-3">
                <button type="button" className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-medium" onClick={() => setStep("personal")}>← Atrás</button>
                <button
                  type="button"
                  className="flex-1 py-3 rounded-xl bg-[#2E86AB] text-white font-semibold text-sm"
                  onClick={() => setStep("consent")}
                  disabled={!form.motivo_consulta || form.motivo_consulta.length < 10}
                >Continuar →</button>
              </div>
            </>
          )}

          {step === "consent" && (
            <>
              <h2 className="text-base font-semibold text-slate-700 mb-4">Consentimiento informado</h2>
              <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600 space-y-3 max-h-72 overflow-y-auto border border-slate-200">
                <p><strong>Proceso terapéutico</strong></p>
                <p>La información que compartas en este proceso es <strong>completamente confidencial</strong> y está protegida por el secreto profesional (Ley 1090/2006) y la Ley de Protección de Datos (Ley 1581/2012).</p>
                <p>Excepcionalmente, la confidencialidad puede levantarse cuando existe riesgo inminente para tu vida o la de terceros, o por orden judicial.</p>
                <p>Tienes derecho a acceder, rectificar y eliminar tus datos en cualquier momento. Tu historia clínica se conservará por 20 años según la Resolución 1995/1999.</p>
                <p>Al continuar, autorizas el tratamiento de tus datos personales y de salud para los fines del proceso psicológico.</p>
              </div>
              <label className="flex items-start gap-3 cursor-pointer mt-3">
                <input
                  type="checkbox"
                  checked={form.consent_accepted}
                  onChange={(e) => set("consent_accepted", e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#2E86AB]"
                />
                <span className="text-sm text-slate-700">
                  He leído y acepto el consentimiento informado. Autorizo el tratamiento de mis datos personales y de salud. <strong className="text-red-500">*</strong>
                </span>
              </label>

              {mutation.isError && (
                <p className="text-sm text-red-600">{(mutation.error as Error).message}</p>
              )}

              <div className="flex gap-3">
                <button type="button" className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-medium" onClick={() => setStep("antecedentes")}>← Atrás</button>
                <button
                  type="button"
                  className="flex-1 py-3 rounded-xl bg-[#2E86AB] text-white font-semibold text-sm disabled:opacity-50"
                  onClick={() => mutation.mutate()}
                  disabled={!form.consent_accepted || mutation.isPending}
                >
                  {mutation.isPending ? "Enviando..." : "Enviar registro"}
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-4 pb-8">
          Tus datos están protegidos · Ley 1581/2012
        </p>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F0F4F8] p-4">
      <div className="text-slate-600 text-sm">{children}</div>
    </div>
  );
}
