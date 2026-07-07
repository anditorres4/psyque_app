/**
 * PatientForm — RF-PAC-01 complete patient registration form.
 * Used for both create and edit. In edit mode, immutable fields are readonly.
 */
import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MUNICIPIOS } from "@/data/municipios";
import { COUNTRIES } from "@/data/countries";
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
  municipality_dane: z.string().min(5, "Selecciona un municipio").max(10),
  zone: z.enum(["U", "R"]),
  phone: z.string().min(7, "Teléfono inválido").max(20),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  emergency_contact_name: z.string().max(200).optional(),
  emergency_contact_phone: z.string().max(20).optional(),
  payer_type: z.enum(["PA", "CC", "SS", "PE", "SE"]),
  eps_name: z.string().max(200).optional(),
  eps_code: z.string().max(10).optional(),
  authorization_number: z.string().max(30).optional(),
  incapacidad: z.enum(["NO", "SI"]).default("NO"),
  cod_pais_residencia: z.string().max(3).default("170"),
  cod_pais_origen: z.string().max(3).default("170"),
});


type PatientFormData = z.infer<typeof patientSchema>;

interface PatientFormProps {
  onSubmit: (data: PatientCreatePayload) => Promise<void>;
  defaultValues?: Partial<PatientDetail>;
  isEdit?: boolean;
  isSubmitting?: boolean;
}

// ---------------------------------------------------------------------------
// Field wrapper
// ---------------------------------------------------------------------------
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
        {required && <span style={{ color: "var(--psy-danger)" }} className="ml-0.5">*</span>}
      </Label>
      {children}
      {error && (
        <p className="text-xs" role="alert" style={{ color: "var(--psy-danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Select — uses forwardRef so React Hook Form can register the DOM element
// ---------------------------------------------------------------------------
const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & {
    options: { value: string; label: string }[];
  }
>(function Select({ options, className, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ""}`}
      {...props}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
});

// ---------------------------------------------------------------------------
// MunicipioCombobox — searchable dropdown for DANE municipality codes
// ---------------------------------------------------------------------------
function MunicipioCombobox({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const selected = MUNICIPIOS.find((m) => m.code === value);
  const displayText = selected
    ? `${selected.name} — ${selected.dept} (${selected.code})`
    : value || "";

  const filtered =
    search.length >= 2
      ? MUNICIPIOS.filter(
          (m) =>
            m.name.toLowerCase().includes(search.toLowerCase()) ||
            m.dept.toLowerCase().includes(search.toLowerCase()) ||
            m.code.includes(search)
        ).slice(0, 8)
      : [];

  return (
    <div className="relative">
      <Input
        value={open ? search : displayText}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
          onChange("");
        }}
        onFocus={() => {
          setSearch("");
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Buscar por nombre o código DANE..."
        disabled={disabled}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-input rounded-md shadow-lg mt-1 max-h-52 overflow-y-auto">
          {filtered.map((m) => (
            <li key={m.code}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-baseline gap-2"
                onMouseDown={() => {
                  onChange(m.code);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <span className="font-mono text-xs text-muted-foreground shrink-0">
                  {m.code}
                </span>
                <span className="font-medium">{m.name}</span>
                <span className="text-xs text-muted-foreground">
                  — {m.dept}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CountryCombobox — searchable dropdown for ADRES country codes
// ---------------------------------------------------------------------------
function CountryCombobox({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const selected = COUNTRIES.find((c) => c.code === value);
  const displayText = selected ? `${selected.name} (${selected.code})` : value || "";

  const filtered =
    search.length >= 1
      ? COUNTRIES.filter(
          (c) =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.code.includes(search)
        ).slice(0, 8)
      : [];

  return (
    <div className="relative">
      <Input
        value={open ? search : displayText}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
          onChange("");
        }}
        onFocus={() => {
          setSearch("");
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Buscar país..."
        disabled={disabled}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-input rounded-md shadow-lg mt-1 max-h-52 overflow-y-auto">
          {filtered.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-baseline gap-2"
                onMouseDown={() => {
                  onChange(c.code);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <span className="font-mono text-xs text-muted-foreground shrink-0">
                  {c.code}
                </span>
                <span className="font-medium">{c.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PatientForm
// ---------------------------------------------------------------------------
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
    control,
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
      incapacidad: (defaultValues?.incapacidad as "NO" | "SI") ?? "NO",
      cod_pais_residencia: defaultValues?.cod_pais_residencia ?? "170",
      cod_pais_origen: defaultValues?.cod_pais_origen ?? "170",
    },
  });

  const payerType = watch("payer_type");

  const handleFormSubmit = async (data: PatientFormData) => {
    await onSubmit({
      ...data,
      consent_accepted: true,
      second_surname: data.second_surname || undefined,
      second_name: data.second_name || undefined,
      email: data.email || undefined,
      gender_identity: data.gender_identity || undefined,
      emergency_contact_name: data.emergency_contact_name || undefined,
      emergency_contact_phone: data.emergency_contact_phone || undefined,
      eps_name: data.eps_name || undefined,
      eps_code: data.eps_code || undefined,
      authorization_number: data.authorization_number || undefined,
      incapacidad: data.incapacidad,
      cod_pais_residencia: data.cod_pais_residencia,
      cod_pais_origen: data.cod_pais_origen,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6" noValidate>
      {/* Identificación */}
      <section>
        <h3 className="psy-mono text-[10.5px] font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--psy-ink-2)" }}>
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
        <h3 className="psy-mono text-[10.5px] font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--psy-ink-2)" }}>
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
        <h3 className="psy-mono text-[10.5px] font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--psy-ink-2)" }}>
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
        <h3 className="psy-mono text-[10.5px] font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--psy-ink-2)" }}>
          Contacto y ubicación
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Dirección completa" error={errors.address?.message} required>
            <Input {...register("address")} placeholder="Calle 1 # 2-3, Bogotá" />
          </Field>
          <Field label="Municipio" error={errors.municipality_dane?.message} required>
            <Controller
              name="municipality_dane"
              control={control}
              render={({ field }) => (
                <MunicipioCombobox
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isEdit}
                />
              )}
            />
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
        <h3 className="psy-mono text-[10.5px] font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--psy-ink-2)" }}>
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

      {/* Datos adicionales RIPS */}
      <section>
        <h3 className="psy-mono text-[10.5px] font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--psy-ink-2)" }}>
          Datos adicionales RIPS
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Incapacidad" error={errors.incapacidad?.message}>
            <Select
              {...register("incapacidad")}
              options={[
                { value: "NO", label: "NO" },
                { value: "SI", label: "SI" },
              ]}
            />
          </Field>
          <div />
          <Field label="País de residencia" error={errors.cod_pais_residencia?.message}>
            <Controller
              name="cod_pais_residencia"
              control={control}
              render={({ field }) => (
                <CountryCombobox
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </Field>
          <Field label="País de origen" error={errors.cod_pais_origen?.message}>
            <Controller
              name="cod_pais_origen"
              control={control}
              render={({ field }) => (
                <CountryCombobox
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </Field>
        </div>
      </section>

      <Button
        type="submit"
        className="w-full bg-[var(--psy-primary)] hover:bg-[var(--psy-primary-soft)]"
        disabled={isSubmitting}
      >
        {isSubmitting
          ? isEdit ? "Guardando..." : "Registrando paciente..."
          : isEdit ? "Guardar cambios" : "Registrar paciente"}
      </Button>
    </form>
  );
}
