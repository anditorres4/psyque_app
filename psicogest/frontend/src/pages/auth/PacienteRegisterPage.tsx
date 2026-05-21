import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const schema = z.object({
  fullName: z.string().min(3, "Nombre completo requerido (mínimo 3 caracteres)"),
  email: z.string().email("Ingresa un email válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});
type FormData = z.infer<typeof schema>;

export function PacienteRegisterPage() {
  const [emailSent, setEmailSent] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          register_as: "patient",
        },
      },
    });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already registered") || error.code === "user_already_registered") {
        setServerError("Ya existe una cuenta con este email. Intenta iniciar sesión.");
      } else {
        setServerError("Error al crear la cuenta. Intenta de nuevo.");
      }
      return;
    }
    setRegisteredEmail(data.email);
    setEmailSent(true);
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--psy-bg)] px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6 space-y-3">
            <div className="text-4xl">📧</div>
            <h2 className="text-xl font-bold text-[var(--psy-primary)]">Revisa tu email</h2>
            <p className="text-sm text-muted-foreground">
              Te enviamos un enlace de confirmación a <strong>{registeredEmail}</strong>.
              Haz clic en el enlace para activar tu cuenta.
            </p>
            <p className="text-xs text-muted-foreground">¿No lo ves? Revisa la carpeta de spam.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--psy-bg)] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-[var(--psy-primary)]">
            Crear cuenta de paciente
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Tu terapeuta te vinculará a su consulta una vez actives tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input id="fullName" type="text" {...register("fullName")} aria-invalid={!!errors.fullName} />
              {errors.fullName && <p className="text-sm text-[var(--psy-danger)]">{errors.fullName.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...register("email")} aria-invalid={!!errors.email} />
              {errors.email && <p className="text-sm text-[var(--psy-danger)]">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" autoComplete="new-password" {...register("password")} aria-invalid={!!errors.password} />
              {errors.password && <p className="text-sm text-[var(--psy-danger)]">{errors.password.message}</p>}
            </div>
            {serverError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-[var(--psy-danger)]">{serverError}</div>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login/paciente" className="text-[var(--psy-sage)] hover:underline">
              Inicia sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
