import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
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

const schema = z.object({
  fullName: z.string().min(3, "Nombre completo requerido (mín. 3 caracteres)"),
  colpsicNumber: z.string().min(4, "Número de tarjeta profesional Colpsic requerido"),
  repsCode: z.string().optional(),
  city: z.string().min(2, "Ciudad de la consulta requerida"),
});

type FormData = z.infer<typeof schema>;

export function CompleteProfilePage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [googleName, setGoogleName] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/login", { replace: true });
        return;
      }
      if (session.user.app_metadata?.tenant_id) {
        navigate("/dashboard", { replace: true });
        return;
      }
      const meta = session.user.user_metadata ?? {};
      const name = (meta.full_name || meta.name || "").trim();
      setGoogleName(name);
      if (name) setValue("fullName", name);
    });
  }, [navigate, setValue]);

  const onSubmit = async (data: FormData) => {
    setServerError(null);

    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        full_name: data.fullName,
        colpsic_number: data.colpsicNumber,
        reps_code: data.repsCode || undefined,
        city: data.city,
      },
    });

    if (updateError) {
      setServerError("Error al guardar tu perfil. Intenta de nuevo.");
      return;
    }

    // Refresh JWT so backend sees the new user_metadata
    await supabase.auth.refreshSession();

    try {
      await api.auth.setupProfile();
    } catch {
      setServerError(
        "Error al configurar tu cuenta profesional. Verifica tus datos e intenta de nuevo."
      );
      return;
    }

    // Refresh again to get tenant_id in app_metadata
    await supabase.auth.refreshSession();
    navigate("/select-plan", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--psy-bg)] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-[var(--psy-primary)]">
            Completa tu perfil
          </CardTitle>
          <CardDescription>
            {googleName
              ? `Hola, ${googleName}. Necesitamos algunos datos profesionales para activar tu cuenta.`
              : "Necesitamos algunos datos profesionales para activar tu cuenta."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Tu nombre completo"
                aria-invalid={!!errors.fullName}
                {...register("fullName")}
              />
              {errors.fullName && (
                <p className="text-sm text-[var(--psy-danger)]" role="alert">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="colpsicNumber">
                Tarjeta profesional Colpsic <span className="text-[var(--psy-danger)]">*</span>
              </Label>
              <Input
                id="colpsicNumber"
                type="text"
                placeholder="Ej: 123456"
                aria-invalid={!!errors.colpsicNumber}
                {...register("colpsicNumber")}
              />
              {errors.colpsicNumber && (
                <p className="text-sm text-[var(--psy-danger)]" role="alert">
                  {errors.colpsicNumber.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="repsCode">
                Código REPS{" "}
                <span className="text-muted-foreground text-xs">(opcional)</span>
              </Label>
              <Input
                id="repsCode"
                type="text"
                placeholder="Ej: ABC-123"
                aria-invalid={!!errors.repsCode}
                {...register("repsCode")}
              />
              {errors.repsCode && (
                <p className="text-sm text-[var(--psy-danger)]" role="alert">
                  {errors.repsCode.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">Ciudad de consulta</Label>
              <Input
                id="city"
                type="text"
                placeholder="Bogotá"
                aria-invalid={!!errors.city}
                {...register("city")}
              />
              {errors.city && (
                <p className="text-sm text-[var(--psy-danger)]" role="alert">
                  {errors.city.message}
                </p>
              )}
            </div>

            {serverError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-[var(--psy-danger)]" role="alert">
                {serverError}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Activando cuenta..." : "Activar cuenta"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
