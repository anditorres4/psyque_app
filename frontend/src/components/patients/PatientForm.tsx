/**
 * PatientForm — RF-PAC-01 complete patient registration form.
 * Used for both create and edit. In edit mode, immutable fields are readonly.
 */
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PatientCreatePayload, PatientDetail } from "@/lib/api";

// ---------------------------------------------------------------------------
// Validation schema — mirrors backend PatientCreate
// ---------------------------------------------------------------------------
const patientSchema = z.object({
  doc_type: z.enum(["CC", "TI", "CE", "PA", "RC", "MS"]),
  doc_number: z.string().min(4, "Mínimo 4 dígitos").max(20),
  first_surname: z.string().min(1, "Requerido").max(100),
  second_surname: z.string().max(100).optional(),
  first_name: z.string().min(1, "Requerido").max(100),
  second_name: z.string().max(100).optional(),
  birth_date: z.string().min(1, "Requerido"),
  biological_sex: z.enum(["M", "F", "I"]),
  gender_identity: z.string().max(50).optional(),
  marital_status: z.enum(["S", "C", "U", "D", "V", "SE"]),
  occupation: z.string().min(1, "Requerido").max(150),
  address: z.string().min(5, "Dirección completa requerida"),
  municipality_dane: z.string().min(5, "Código DANE requerido").max(10),
  zone: z.enum(["U", "R"]),
  phone: z.string().min(7, "Teléfono inválido").max(20),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  emergency_contact_name: z.string().max(200).optional(),
  emergency_contact_phone: z.string().max(20).optional(),
  payer_type: z.enum(["PA", "CC", "SS", "PE", "SE"]),
  eps_name: z.string().max(200).optional(),
  eps_code: z.string().max(10).optional(),
  authorization_number: z.string().max(30).optional(),
  consent_accepted: z.literal(true, {
    errorMap: () => ({ message: "Debe aceptar el consentimiento informado (Ley 1581/2012)" }),
  }),
});

type PatientFormData = z.infer<typeof patientSchema>;

interface PatientFormProps {
  onSubmit: (data: PatientCreatePayload) => Promise<void>;
  defaultValues?: Partial<PatientDetail>;
  isEdit?: boolean;
  isSubmitting?: boolean;
}

function Field({
  label,
  error,
  children,
  required,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label>
        {label}
        {required && <span className="text-[#E74C3C] ml-0.5">*</span>}
      </Label>
      {children}
      {error && (
        <p className="text-xs text-[#E74C3C]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Select({
  options,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[];
}) {
  return (
    <select
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      {...props}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function PatientForm({
  onSubmit,
  defaultValues,
  isEdit = false,
  isSubmitting = false,
}: PatientFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      doc_type: (defaultValues?.doc_type as PatientFormData["doc_type"]) ?? "CC",
      doc_number: defaultValues?.doc_number ?? "",
      first_surname: defaultValues?.first_surname ?? "",
      second_surname: defaultValues?.second_surname ?? "",
      first_name: defaultValues?.first_name ?? "",
      second_name: defaultValues?.second_name ?? "",
      birth_date: defaultValues?.birth_date ?? "",
      biological_sex: (defaultValues?.biological_sex as PatientFormData["biological_sex"]) ?? "F",
      gender_identity: defaultValues?.gender_identity ?? "",
      marital_status: (defaultValues?.marital_status as PatientFormData["marital_status"]) ?? "S",
      occupation: defaultValues?.occupation ?? "",
      address: defaultValues?.address ?? "",
      municipality_dane: defaultValues?.municipality_dane ?? "",
      zone: (defaultValues?.zone as PatientFormData["zone"]) ?? "U",
      phone: defaultValues?.phone ?? "",
      email: defaultValues?.email ?? "",
      emergency_contact_name: defaultValues?.emergency_contact_name ?? "",
      emergency_contact_phone: defaultValues?.emergency_contact_phone ?? "",
      payer_type: (defaultValues?.payer_type as PatientFormData["payer_type"]) ?? "PA",
      eps_name: defaultValues?.eps_name ?? "",
      eps_code: defaultValues?.eps_code ?? "",
      authorization_number: defaultValues?.authorization_number ?? "",
    },
  });

  const payerType = watch("payer_type");

  const handleFormSubmit = async (data: PatientFormData) => {
    await onSubmit({
      ...data,
      second_surname: data.second_surname || undefined,
      second_name: data.second_name || undefined,
      email: data.email || undefined,
      gender_identity: data.gender_identity || undefined,
      emergency_contact_name: data.emergency_contact_name || undefined,
      emergency_contact_phone: data.emergency_contact_phone || undefined,
      eps_name: data.eps_name || undefined,
      eps_code: data.eps_code || undefined,
      authorization_number: data.authorization_number || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6" noValidate>
      {/* Identificación */}
      <section>
        <h3 className="text-sm font-semibold text-[#1E3A5F] uppercase tracking-wide mb-3">
          Identificación
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tipo de documento" error={errors.doc_type?.message} required>
            <Select
              {...register("doc_type")}
              disabled={isEdit}
              options={[
                { value: "CC", label: "Cédula de Ciudadanía" },
                { value: "TI", label: "Tarjeta de Identidad" },
                { value: "CE", label: "Cédula de Extranjería" },
                { value: "PA", label: "Pasaporte" },
                { value: "RC", label: "Registro Civil" },
                { value: "MS", label: "Menor sin identificación" },
              ]}
            />
          </Field>
          <Field label="Número de documento" error={errors.doc_number?.message} required>
            <Input
              {...register("doc_number")}
              disabled={isEdit}
              placeholder="12345678"
            />
          </Field>
        </div>
      </section>

      {/* Nombres y apellidos */}
      <section>
        <h3 className="text-sm font-semibold text-[#1E3A5F] uppercase tracking-wide mb-3">
          Nombre completo
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Primer apellido" error={errors.first_surname?.message} required>
            <Input {...register("first_surname")} placeholder="García" />
          </Field>
          <Field label="Segundo apellido" error={errors.second_surname?.message}>
            <Input {...register("second_surname")} placeholder="López" />
          </Field>
          <Field label="Primer nombre" error={errors.first_name?.message} required>
            <Input {...register("first_name")} placeholder="Ana" />
          </Field>
          <Field label="Segundo nombre" error={errors.second_name?.message}>
            <Input {...register("second_name")} placeholder="María" />
          </Field>
        </div>
      </section>

      {/* Datos demográficos */}
      <section>
        <h3 className="text-sm font-semibold text-[#1E3A5F] uppercase tracking-wide mb-3">
          Datos personales
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Fecha de nacimiento" error={errors.birth_date?.message} required>
            <Input type="date" {...register("birth_date")} disabled={isEdit} />
          </Field>
          <Field label="Sexo biológico (RIPS)" error={errors.biological_sex?.message} required>
            <Select
              {...register("biological_sex")}
              disabled={isEdit}
              options={[
                { value: "F", label: "Femenino" },
                { value: "M", label: "Masculino" },
                { value: "I", label: "Indeterminado" },
              ]}
            />
          </Field>
          <Field label="Género de identidad" error={errors.gender_identity?.message}>
            <Input {...register("gender_identity")} placeholder="Opcional" />
          </Field>
          <Field label="Estado civil" error={errors.marital_status?.message} required>
            <Select
              {...register("marital_status")}
              options={[
                { value: "S", label: "Soltero/a" },
                { value: "C", label: "Casado/a" },
                { value: "U", label: "Unión libre" },
                { value: "D", label: "Divorciado/a" },
                { value: "V", label: "Viudo/a" },
                { value: "SE", label: "Separado/a" },
              ]}
            />
          </Field>
          <Field label="Ocupación" error={errors.occupation?.message} required>
            <Input {...register("occupation")} placeholder="Profesora, Ingeniero..." />
          </Field>
        </div>
      </section>

      {/* Ubicación y contacto */}
      <section>
        <h3 className="text-sm font-semibold text-[#1E3A5F] uppercase tracking-wide mb-3">
          Contacto y ubicación
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Dirección completa" error={errors.address?.message} required>
            <Input {...register("address")} placeholder="Calle 1 # 2-3, Bogotá" className="col-span-2" />
          </Field>
          <Field label="Código DANE del municipio" error={errors.municipality_dane?.message} required>
            <Input {...register("municipality_dane")} placeholder="11001 (Bogotá)" />
          </Field>
          <Field label="Zona" error={errors.zone?.message} required>
            <Select
              {...register("zone")}
              options={[
                { value: "U", label: "Urbana" },
                { value: "R", label: "Rural" },
              ]}
            />
          </Field>
          <Field label="Teléfono" error={errors.phone?.message} required>
            <Input {...register("phone")} placeholder="3001234567" type="tel" />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <Input {...register("email")} placeholder="paciente@email.com" type="email" />
          </Field>
          <Field label="Contacto de emergencia" error={errors.emergency_contact_name?.message}>
            <Input {...register("emergency_contact_name")} placeholder="Nombre" />
          </Field>
          <Field label="Teléfono emergencia" error={errors.emergency_contact_phone?.message}>
            <Input {...register("emergency_contact_phone")} placeholder="3009999999" />
          </Field>
        </div>
      </section>

      {/* Vinculación / RIPS */}
      <section>
        <h3 className="text-sm font-semibold text-[#1E3A5F] uppercase tracking-wide mb-3">
          Vinculación (RIPS)
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tipo de vinculación" error={errors.payer_type?.message} required>
            <Select
              {...register("payer_type")}
              options={[
                { value: "PA", label: "Particular" },
                { value: "CC", label: "Contributivo (EPS)" },
                { value: "SS", label: "Subsidiado (EPS)" },
                { value: "PE", label: "Especial" },
                { value: "SE", label: "Excepción" },
              ]}
            />
          </Field>
          {(payerType === "CC" || payerType === "SS") && (
            <>
              <Field label="Nombre de la EPS" error={errors.eps_name?.message}>
                <Input {...register("eps_name")} placeholder="Sura, Compensar..." />
              </Field>
              <Field label="Código EPS (DANE)" error={errors.eps_code?.message}>
                <Input {...register("eps_code")} placeholder="EPS001" />
              </Field>
              <Field label="Número de autorización" error={errors.authorization_number?.message}>
                <Input {...register("authorization_number")} placeholder="Si aplica" />
              </Field>
            </>
          )}
        </div>
      </section>

      {/* Consentimiento informado — solo en creación */}
      {!isEdit && (
        <section className="rounded-lg border border-[#E67E22] bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-[#E67E22] mb-2">
            Consentimiento informado — Ley 1581/2012
          </h3>
          <p className="text-xs text-slate-600 mb-3">
            El paciente autoriza el tratamiento de sus datos personales de salud para fines
            exclusivamente clínicos y administrativos. Esta autorización quedará registrada
            con fecha, hora e IP del dispositivo de forma permanente.
          </p>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              {...register("consent_accepted")}
            />
            <span className="text-sm">
              El paciente ha leído y acepta el tratamiento de sus datos personales de salud
            </span>
          </label>
          {errors.consent_accepted && (
            <p className="text-xs text-[#E74C3C] mt-1" role="alert">
              {errors.consent_accepted.message}
            </p>
          )}
        </section>
      )}

      <Button
        type="submit"
        className="w-full bg-[#2E86AB] hover:bg-[#1E3A5F]"
        disabled={isSubmitting}
      >
        {isSubmitting
          ? isEdit ? "Guardando..." : "Registrando paciente..."
          : isEdit ? "Guardar cambios" : "Registrar paciente"}
      </Button>
    </form>
  );
}
