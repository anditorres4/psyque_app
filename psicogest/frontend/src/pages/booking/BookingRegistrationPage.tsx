import { useState } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRegistrationInfo, useCompleteRegistration } from "@/hooks/useBooking";

const schema = z.object({
  doc_type: z.enum(["CC", "TI", "CE", "PA", "RC", "MS"], {
    required_error: "Selecciona el tipo de documento",
  }),
  doc_number: z.string().min(4, "Mínimo 4 caracteres").max(20),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
  biological_sex: z.enum(["M", "F", "I"], { required_error: "Selecciona una opción" }),
  phone: z.string().min(7, "Mínimo 7 dígitos").max(20),
});

type FormValues = z.infer<typeof schema>;

const DOC_TYPES = [
  { value: "CC", label: "Cédula de Ciudadanía" },
  { value: "TI", label: "Tarjeta de Identidad" },
  { value: "CE", label: "Cédula de Extranjería" },
  { value: "PA", label: "Pasaporte" },
  { value: "RC", label: "Registro Civil" },
  { value: "MS", label: "Mayor de Edad sin Documento" },
];

const SEX_OPTIONS = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Femenino" },
  { value: "I", label: "Indeterminado / Intersexual" },
];

const SESSION_LABELS: Record<string, string> = {
  individual: "Individual",
  couple: "Pareja",
  family: "Familia",
  followup: "Seguimiento",
};

export function BookingRegistrationPage() {
  const { token = "" } = useParams<{ token: string }>();
  const { data: info, isLoading, error } = useRegistrationInfo(token);
  const mutation = useCompleteRegistration(token);
  const [done, setDone] = useState(false);
  const [appointmentStart, setAppointmentStart] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { doc_type: "CC", biological_sex: "M" },
  });

  const onSubmit = async (values: FormValues) => {
    const result = await mutation.mutateAsync(values);
    setAppointmentStart(result.appointment_start);
    setDone(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <p className="text-sm text-[#4A7B6F]">Cargando...</p>
      </div>
    );
  }

  if (error || !info) {
    const detail = (error as { message?: string })?.message ?? "";
    const isExpired = detail.includes("expiró");
    const isUsed = detail.includes("utilizado");
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6">
        <div className="max-w-md w-full text-center space-y-3">
          <div className="text-4xl">{isUsed ? "✅" : "⏰"}</div>
          <h1 className="text-xl font-semibold text-[#1E3A5F]">
            {isUsed
              ? "Registro ya completado"
              : isExpired
              ? "Enlace expirado"
              : "Enlace no válido"}
          </h1>
          <p className="text-sm text-[#6B7A7E]">
            {isUsed
              ? "Tu registro ya fue completado anteriormente."
              : isExpired
              ? "Este enlace expiró. Escríbele a tu psicólogo para que te envíe uno nuevo."
              : "Este enlace no es válido. Verifica que hayas abierto el enlace del email correctamente."}
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    const date = appointmentStart
      ? new Date(appointmentStart).toLocaleString("es-CO", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-5xl">🎉</div>
          <h1 className="text-2xl font-semibold text-[#1E3A5F]">¡Registro completado!</h1>
          <p className="text-[#374151]">
            Tu cita con <strong>{info.psychologist_name}</strong>
            {date ? ` el ${date}` : ""} está confirmada.
          </p>
          <p className="text-sm text-[#6B7A7E]">
            Revisa tu correo — te enviamos un enlace para acceder a tu portal de paciente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-[#1E3A5F] mb-1">Completa tu registro</h1>
          <p className="text-sm text-[#6B7A7E]">
            Cita con <strong>{info.psychologist_name}</strong> —{" "}
            {new Date(info.requested_start).toLocaleString("es-CO", {
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {" · "}
            {SESSION_LABELS[info.session_type] ?? info.session_type}
          </p>
        </div>

        <div
          className="rounded-xl p-6 space-y-4"
          style={{ background: "white", border: "1px solid #E2EAF0" }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#6B7A7E] uppercase tracking-wide">
                Nombre
              </label>
              <p className="text-sm text-[#1E3A5F] mt-1">{info.patient_name}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-[#6B7A7E] uppercase tracking-wide">
                Email
              </label>
              <p className="text-sm text-[#1E3A5F] mt-1 truncate">{info.patient_email}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[#6B7A7E] uppercase tracking-wide block mb-1">
                  Tipo de documento
                </label>
                <select
                  {...register("doc_type")}
                  className="w-full text-sm border rounded-md px-3 py-2 text-[#1E3A5F]"
                  style={{ borderColor: "#E2EAF0" }}
                >
                  {DOC_TYPES.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
                {errors.doc_type && (
                  <p className="text-xs text-red-500 mt-1">{errors.doc_type.message}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-[#6B7A7E] uppercase tracking-wide block mb-1">
                  Número de documento
                </label>
                <input
                  {...register("doc_number")}
                  className="w-full text-sm border rounded-md px-3 py-2 text-[#1E3A5F]"
                  style={{ borderColor: "#E2EAF0" }}
                  placeholder="12345678"
                />
                {errors.doc_number && (
                  <p className="text-xs text-red-500 mt-1">{errors.doc_number.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[#6B7A7E] uppercase tracking-wide block mb-1">
                  Fecha de nacimiento
                </label>
                <input
                  {...register("birth_date")}
                  type="date"
                  className="w-full text-sm border rounded-md px-3 py-2 text-[#1E3A5F]"
                  style={{ borderColor: "#E2EAF0" }}
                />
                {errors.birth_date && (
                  <p className="text-xs text-red-500 mt-1">{errors.birth_date.message}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-[#6B7A7E] uppercase tracking-wide block mb-1">
                  Sexo biológico
                </label>
                <select
                  {...register("biological_sex")}
                  className="w-full text-sm border rounded-md px-3 py-2 text-[#1E3A5F]"
                  style={{ borderColor: "#E2EAF0" }}
                >
                  {SEX_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {errors.biological_sex && (
                  <p className="text-xs text-red-500 mt-1">{errors.biological_sex.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-[#6B7A7E] uppercase tracking-wide block mb-1">
                Teléfono
              </label>
              <input
                {...register("phone")}
                type="tel"
                className="w-full text-sm border rounded-md px-3 py-2 text-[#1E3A5F]"
                style={{ borderColor: "#E2EAF0" }}
                placeholder="3001234567"
              />
              {errors.phone && (
                <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>
              )}
            </div>

            {mutation.error && (
              <p className="text-sm text-red-600 text-center">
                {(mutation.error as { message?: string })?.message ??
                  "Error al guardar. Intenta de nuevo."}
              </p>
            )}

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full py-3 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ background: "#2E5E8A" }}
            >
              {mutation.isPending ? "Guardando..." : "Confirmar mi registro"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#6B7A7E] mt-4">
          Tus datos se protegen bajo la Ley 1581/2012 de habeas data.
        </p>
      </div>
    </div>
  );
}
