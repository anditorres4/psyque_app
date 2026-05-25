import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const schema = z.object({
  marital_status: z.enum(["S", "C", "U", "D", "V", "SE"], {
    required_error: "Selecciona el estado civil",
  }),
  occupation: z.string().min(2, "Mínimo 2 caracteres").max(150),
  address: z.string().min(5, "Mínimo 5 caracteres"),
  municipality_dane: z
    .string()
    .regex(/^\d{5}$/, "Debe ser el código DANE de 5 dígitos (ej: 11001)"),
  zone: z.enum(["U", "R"], { required_error: "Selecciona la zona" }),
  payer_type: z.enum(["PA", "CC", "SS", "PE", "SE"], {
    required_error: "Selecciona el tipo de afiliación",
  }),
  emergency_contact_name: z.string().min(3, "Mínimo 3 caracteres").max(200),
  emergency_contact_phone: z
    .string()
    .min(7, "Mínimo 7 dígitos")
    .max(20),
});

type FormValues = z.infer<typeof schema>;

const MARITAL_OPTIONS = [
  { value: "S", label: "Soltero/a" },
  { value: "C", label: "Casado/a" },
  { value: "U", label: "Unión libre" },
  { value: "D", label: "Divorciado/a" },
  { value: "V", label: "Viudo/a" },
  { value: "SE", label: "Separado/a" },
];

const ZONE_OPTIONS = [
  { value: "U", label: "Urbana" },
  { value: "R", label: "Rural" },
];

const PAYER_OPTIONS = [
  { value: "PA", label: "Particular (pago directo)" },
  { value: "CC", label: "Contributivo (EPS)" },
  { value: "SS", label: "Subsidiado (SISBEN)" },
  { value: "PE", label: "Especial (fuerzas militares, etc.)" },
  { value: "SE", label: "Sin afiliación" },
];

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="text-xs font-medium uppercase tracking-wide block mb-1"
        style={{ color: "var(--psy-ink-4)" }}
      >
        {label} <span style={{ color: "var(--psy-danger, #DC2626)" }}>*</span>
      </label>
      {children}
      {error && (
        <p className="text-xs mt-1" style={{ color: "var(--psy-danger, #DC2626)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls =
  "w-full text-sm border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1";
const inputStyle = { borderColor: "var(--psy-line)", color: "var(--psy-ink-1)" };

export function PortalCompleteProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: FormValues) => api.portal.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "me"] });
      navigate("/portal/dashboard", { replace: true });
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  return (
    <div className="min-h-screen" style={{ background: "var(--psy-bg, #F4F1EC)" }}>
      <div className="max-w-xl mx-auto px-4 pt-10 pb-16">
        <div className="text-center mb-8">
          <h1
            className="psy-serif text-2xl italic mb-1"
            style={{ color: "var(--psy-ink-1)" }}
          >
            Completa tu perfil
          </h1>
          <p className="text-sm" style={{ color: "var(--psy-ink-3)" }}>
            Necesitamos algunos datos adicionales para tu historia clínica (Res. 1995/1999).
          </p>
        </div>

        <div
          className="rounded-xl border p-6 space-y-4"
          style={{ background: "var(--psy-surface)", borderColor: "var(--psy-line)" }}
        >
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Estado civil" error={errors.marital_status?.message}>
                <select {...register("marital_status")} className={inputCls} style={inputStyle}>
                  <option value="">Seleccionar...</option>
                  {MARITAL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Zona de residencia" error={errors.zone?.message}>
                <select {...register("zone")} className={inputCls} style={inputStyle}>
                  <option value="">Seleccionar...</option>
                  {ZONE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Ocupación / Profesión" error={errors.occupation?.message}>
              <input
                {...register("occupation")}
                className={inputCls}
                style={inputStyle}
                placeholder="Ej: Estudiante, Contador, Docente..."
              />
            </Field>

            <Field label="Dirección de residencia" error={errors.address?.message}>
              <input
                {...register("address")}
                className={inputCls}
                style={inputStyle}
                placeholder="Calle 123 # 45-67, Apto 8"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Código DANE municipio"
                error={errors.municipality_dane?.message}
              >
                <input
                  {...register("municipality_dane")}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="11001"
                  maxLength={5}
                />
                <p className="text-xs mt-1" style={{ color: "var(--psy-ink-4)" }}>
                  5 dígitos · Bogotá: 11001
                </p>
              </Field>

              <Field label="Tipo de afiliación" error={errors.payer_type?.message}>
                <select {...register("payer_type")} className={inputCls} style={inputStyle}>
                  <option value="">Seleccionar...</option>
                  {PAYER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div
              className="rounded-lg p-3 text-xs"
              style={{
                background: "var(--psy-primary-faint, #EEF4FF)",
                color: "var(--psy-ink-3)",
              }}
            >
              Contacto de emergencia — persona a quien avisar si no puedes ser localizado/a.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Nombre contacto emergencia"
                error={errors.emergency_contact_name?.message}
              >
                <input
                  {...register("emergency_contact_name")}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="Nombre completo"
                />
              </Field>

              <Field
                label="Teléfono contacto emergencia"
                error={errors.emergency_contact_phone?.message}
              >
                <input
                  {...register("emergency_contact_phone")}
                  type="tel"
                  className={inputCls}
                  style={inputStyle}
                  placeholder="3001234567"
                />
              </Field>
            </div>

            {mutation.isError && (
              <p className="text-sm" style={{ color: "var(--psy-danger, #DC2626)" }}>
                {(mutation.error as Error).message ?? "Error al guardar. Intenta de nuevo."}
              </p>
            )}

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
              style={{ background: "var(--psy-primary, #1E3A5F)" }}
            >
              {mutation.isPending ? "Guardando..." : "Guardar y continuar →"}
            </button>
          </form>
        </div>

        <p
          className="text-center text-xs mt-4"
          style={{ color: "var(--psy-ink-4)" }}
        >
          Tus datos se protegen bajo la Ley 1581/2012 de habeas data.
        </p>
      </div>
    </div>
  );
}
