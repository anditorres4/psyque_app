import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  email: z.string().email("Ingresa un email válido"),
  password: z.string().min(1, "La contraseña es requerida"),
});
type FormData = z.infer<typeof schema>;

export function TerapeutaLoginPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) {
      if (error.code === "email_not_confirmed") {
        setServerError("Confirma tu email antes de iniciar sesión. Revisa tu bandeja y carpeta de spam.");
      } else if (error.code === "invalid_credentials") {
        setServerError("Email o contraseña incorrectos.");
      } else {
        setServerError("Error al iniciar sesión. Intenta de nuevo.");
      }
      return;
    }
    navigate("/dashboard");
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--psy-bg)] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-[var(--psy-primary)]">
            Acceso para terapeutas
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Bienvenido de vuelta. Gestiona tus pacientes y sesiones.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
          >
            Continuar con Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">O con email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                {...register("email")}
                aria-invalid={!!errors.email}
              />
              {errors.email && <p className="text-sm text-[var(--psy-danger)]">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
                aria-invalid={!!errors.password}
              />
              {errors.password && <p className="text-sm text-[var(--psy-danger)]">{errors.password.message}</p>}
            </div>
            {serverError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-[var(--psy-danger)]">
                {serverError}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Iniciando sesión..." : "Iniciar sesión"}
            </Button>
          </form>

          <div className="flex flex-col gap-2 text-center text-sm text-muted-foreground">
            <Link to="/forgot-password" className="text-[var(--psy-sage)] hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
            <span>
              ¿No tienes cuenta?{" "}
              <Link to="/register/terapeuta" className="text-[var(--psy-sage)] hover:underline">
                Regístrate
              </Link>
            </span>
            <span>
              ¿Eres paciente?{" "}
              <Link to="/login/paciente" className="text-[var(--psy-sage)] hover:underline">
                Ingresa aquí →
              </Link>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
