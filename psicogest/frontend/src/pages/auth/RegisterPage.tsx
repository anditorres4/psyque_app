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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const registerSchema = z.object({
  fullName: z.string().min(3, "Nombre completo requerido (mín. 3 caracteres)"),
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
    .regex(/[0-9]/, "Debe contener al menos un número"),
  colpsicNumber: z.string().min(4, "Número de tarjeta profesional Colpsic requerido"),
  repsCode: z.string().optional(),
  city: z.string().min(2, "Ciudad de la consulta requerida"),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          colpsic_number: data.colpsicNumber,
          reps_code: data.repsCode ?? null,
          city: data.city,
        },
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already registered") || error.code === "user_already_registered") {
        setServerError("Ya existe una cuenta con este email. Intenta iniciar sesión.");
      } else {
        setServerError("Error al crear la cuenta. Por favor intenta de nuevo.");
      }
      return;
    }
    setRegisteredEmail(data.email);
    setEmailSent(true);
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="text-4xl mb-2">📬</div>
            <CardTitle className="text-[#27AE60]">¡Revisa tu email!</CardTitle>
            <CardDescription>
              Enviamos un enlace de verificación a <strong>{registeredEmail}</strong>. Haz clic en el enlace para activar tu cuenta. Si no lo ves, revisa la carpeta de spam.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              ⚠️ No cierres esta ventana — necesitarás el enlace de confirmación.
            </div>
            <Button
              variant="outline"
              onClick={() => navigate("/login")}
              className="mt-2"
            >
              Volver al inicio de sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-[#1E3A5F]">
            Crea tu cuenta
          </CardTitle>
          <CardDescription>
            psyque app — gestión clínica para psicólogos en Colombia
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input
                id="fullName"
                placeholder="Dra. María García López"
                autoComplete="name"
                aria-invalid={!!errors.fullName}
                {...register("fullName")}
              />
              {errors.fullName && (
                <p className="text-sm text-[#E74C3C]" role="alert">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-email">Email profesional</Label>
              <Input
                id="reg-email"
                type="email"
                placeholder="dra.garcia@consulta.com"
                autoComplete="email"
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-[#E74C3C]" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-password">Contraseña</Label>
              <Input
                id="reg-password"
                type="password"
                placeholder="Mín. 8 caracteres, 1 mayúscula, 1 número"
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-[#E74C3C]" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="colpsicNumber">
                Tarjeta profesional Colpsic{" "}
                <span className="text-[#E74C3C]" aria-label="requerido">*</span>
              </Label>
              <Input
                id="colpsicNumber"
                placeholder="COL-XXXXX"
                aria-invalid={!!errors.colpsicNumber}
                {...register("colpsicNumber")}
              />
              {errors.colpsicNumber && (
                <p className="text-sm text-[#E74C3C]" role="alert">
                  {errors.colpsicNumber.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="repsCode">
                Rethus{" "}
                <span className="text-xs text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="repsCode"
                placeholder="Si estás habilitado como prestador de salud"
                {...register("repsCode")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">Ciudad de la consulta</Label>
              <Input
                id="city"
                placeholder="Bogotá, Medellín, Cali..."
                aria-invalid={!!errors.city}
                {...register("city")}
              />
              {errors.city && (
                <p className="text-sm text-[#E74C3C]" role="alert">
                  {errors.city.message}
                </p>
              )}
            </div>

            {serverError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-[#E74C3C]" role="alert">
                {serverError}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-[#2E86AB] hover:bg-[#1E3A5F]"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creando cuenta..." : "Crear cuenta — 30 días gratis"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="text-[#2E86AB] hover:underline font-medium">
              Inicia sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
