import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";

const schema = z.object({
  full_name: z.string().min(2, "Mínimo 2 caracteres"),
  colpsic_number: z.string().min(1, "Requerido"),
  reps_code: z.string().optional(),
  nit: z.string().optional(),
  city: z.string().min(1, "Requerido"),
  session_duration_min: z.coerce.number().min(30).max(120),
});

type FormValues = z.infer<typeof schema>;

export function ProfileForm() {
  const { data: profile, isLoading } = useProfile();
  const updateMutation = useUpdateProfile();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (profile) {
      reset({
        full_name: profile.full_name,
        colpsic_number: profile.colpsic_number,
        reps_code: profile.reps_code ?? "",
        nit: profile.nit ?? "",
        city: profile.city,
        session_duration_min: profile.session_duration_min,
      });
    }
  }, [profile, reset]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  const onSubmit = async (values: FormValues) => {
    setError(null);
    setSaved(false);
    try {
      await updateMutation.mutateAsync(values);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1">
          <label className="text-xs font-medium uppercase text-muted-foreground">Nombre completo</label>
          <input {...register("full_name")} className="w-full rounded-md border px-3 py-2 text-sm" />
          {errors.full_name && <p className="text-xs text-red-500">{errors.full_name.message}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase text-muted-foreground">N° Colpsic</label>
          <input {...register("colpsic_number")} className="w-full rounded-md border px-3 py-2 text-sm" />
          {errors.colpsic_number && <p className="text-xs text-red-500">{errors.colpsic_number.message}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase text-muted-foreground">Código REPS</label>
          <input {...register("reps_code")} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Opcional" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase text-muted-foreground">NIT</label>
          <input {...register("nit")} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Opcional" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase text-muted-foreground">Ciudad</label>
          <input {...register("city")} className="w-full rounded-md border px-3 py-2 text-sm" />
          {errors.city && <p className="text-xs text-red-500">{errors.city.message}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase text-muted-foreground">Duración sesión (min)</label>
          <input type="number" {...register("session_duration_min")} className="w-full rounded-md border px-3 py-2 text-sm" />
          {errors.session_duration_min && <p className="text-xs text-red-500">{errors.session_duration_min.message}</p>}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Cambios guardados.</p>}

      <Button
        type="submit"
        disabled={!isDirty || updateMutation.isPending}
        className="bg-[#1E3A5F] hover:bg-[#2E86AB] text-white"
      >
        {updateMutation.isPending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}