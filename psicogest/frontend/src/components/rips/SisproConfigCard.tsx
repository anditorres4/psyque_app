import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { api, type SisproCredentials } from "@/lib/api";
import { PsyCard, PsyButton } from "@/components/ui/psy";

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  background: "var(--psy-bg-soft)",
  border: "1px solid var(--psy-line)",
  color: "var(--psy-ink-1)",
  borderRadius: "var(--radius)",
  padding: "8px 12px",
  fontSize: "13px",
  outline: "none",
};

const schema = z.object({
  tipo_usuario: z.enum(["PIN", "RE"]),
  doc_type: z.enum(["CC", "NIT", "PA"]),
  doc_number: z.string().min(4, "Mínimo 4 caracteres"),
  sispro_password: z.string().min(1, "Contraseña requerida"),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  configured: boolean;
}

export function SisproConfigCard({ configured }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(!configured);
  const [showPass, setShowPass] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { register, handleSubmit, getValues, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { tipo_usuario: "PIN", doc_type: "CC", doc_number: "", sispro_password: "" },
  });

  const saveMutation = useMutation({
    mutationFn: (data: SisproCredentials) => api.profile.updateSisproCredentials(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      setEditing(false);
      setTestResult(null);
    },
  });

  const testMutation = useMutation({
    mutationFn: (data: SisproCredentials) => api.profile.testSisproConnection(data),
    onSuccess: (result) => setTestResult(result),
  });

  const onTest = () => {
    const values = getValues();
    if (!values.doc_number || !values.sispro_password) return;
    setTestResult(null);
    testMutation.mutate(values as SisproCredentials);
  };

  const onSave = handleSubmit((data) => {
    saveMutation.mutate(data as SisproCredentials);
  });

  if (configured && !editing) {
    return (
      <PsyCard>
        <div className="flex items-center justify-between">
          <div>
            <div
              className="psy-mono text-[10.5px] uppercase tracking-wider mb-1.5"
              style={{ color: "var(--psy-ink-3)" }}
            >
              Credenciales SISPRO MinSalud
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} style={{ color: "var(--psy-ok)" }} />
              <span className="text-[13px]" style={{ color: "var(--psy-ink-1)" }}>Configurado</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PsyButton
              variant="ghost"
              onClick={onTest}
              className={testMutation.isPending ? "opacity-50 pointer-events-none" : ""}
            >
              {testMutation.isPending ? "Probando…" : "Probar conexión"}
            </PsyButton>
            <PsyButton variant="ghost" onClick={() => { setEditing(true); setTestResult(null); }}>
              Editar
            </PsyButton>
          </div>
        </div>
        {testResult && <TestResultBanner result={testResult} />}
      </PsyCard>
    );
  }

  return (
    <PsyCard title="Credenciales SISPRO MinSalud">
      {!configured && (
        <div
          className="mb-4 px-3 py-2.5 rounded-[var(--radius)] text-[12px]"
          style={{
            background: "var(--psy-amber-bg, #FFFBEB)",
            border: "1px solid var(--psy-amber-soft, #FDE68A)",
            color: "var(--psy-ink-2)",
          }}
        >
          Para enviar RIPS automáticamente al MinSalud configure sus credenciales del portal SISPRO.
        </div>
      )}

      <form onSubmit={onSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo de usuario">
            <select {...register("tipo_usuario")} style={INPUT_STYLE}>
              <option value="PIN">PIN — Profesional Independiente</option>
              <option value="RE">RE — IPS / Empresa</option>
            </select>
          </Field>
          <Field label="Tipo de documento">
            <select {...register("doc_type")} style={INPUT_STYLE}>
              <option value="CC">CC — Cédula de Ciudadanía</option>
              <option value="NIT">NIT</option>
              <option value="PA">PA — Pasaporte</option>
            </select>
          </Field>
        </div>

        <Field label="Número de documento" error={errors.doc_number?.message}>
          <input
            {...register("doc_number")}
            placeholder="Ej: 1234567890"
            style={INPUT_STYLE}
          />
        </Field>

        <Field label="Contraseña SISPRO" error={errors.sispro_password?.message}>
          <div className="relative">
            <input
              {...register("sispro_password")}
              type={showPass ? "text" : "password"}
              placeholder="Contraseña del portal SISPRO"
              style={{ ...INPUT_STYLE, paddingRight: "40px" }}
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-80"
              style={{ color: "var(--psy-ink-3)", opacity: 0.6 }}
            >
              {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </Field>

        {testResult && <TestResultBanner result={testResult} />}

        <div className="flex items-center gap-2 pt-1">
          <PsyButton
            type="button"
            variant="ghost"
            onClick={onTest}
            className={testMutation.isPending ? "opacity-50 pointer-events-none" : ""}
          >
            {testMutation.isPending ? "Probando…" : "Probar conexión"}
          </PsyButton>
          <PsyButton
            type="submit"
            variant="primary"
            className={saveMutation.isPending ? "opacity-50 pointer-events-none" : ""}
          >
            {saveMutation.isPending ? "Guardando…" : "Guardar"}
          </PsyButton>
          {configured && (
            <PsyButton
              type="button"
              variant="ghost"
              onClick={() => { setEditing(false); setTestResult(null); }}
            >
              Cancelar
            </PsyButton>
          )}
        </div>

        {saveMutation.isError && (
          <div className="psy-mono text-[11px]" style={{ color: "var(--psy-danger)" }}>
            {(saveMutation.error as Error)?.message ?? "Error al guardar"}
          </div>
        )}
      </form>
    </PsyCard>
  );
}

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
    <div className="flex flex-col gap-1.5">
      <label
        className="psy-mono text-[10.5px] uppercase tracking-wider"
        style={{ color: "var(--psy-ink-3)" }}
      >
        {label}
      </label>
      {children}
      {error && (
        <span className="psy-mono text-[10.5px]" style={{ color: "var(--psy-danger)" }}>
          {error}
        </span>
      )}
    </div>
  );
}

function TestResultBanner({ result }: { result: { ok: boolean; message: string } }) {
  return (
    <div
      className="flex items-start gap-2 px-3 py-2.5 rounded-[var(--radius)] mt-1"
      style={{
        background: result.ok ? "var(--psy-sage-bg)" : "#FEF2F2",
        border: `1px solid ${result.ok ? "var(--psy-sage-soft)" : "#FECACA"}`,
      }}
    >
      {result.ok
        ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: "var(--psy-ok)" }} />
        : <XCircle size={14} className="mt-0.5 shrink-0" style={{ color: "var(--psy-danger)" }} />}
      <span className="text-[12px]" style={{ color: result.ok ? "var(--psy-ok)" : "var(--psy-danger)" }}>
        {result.message}
      </span>
    </div>
  );
}
