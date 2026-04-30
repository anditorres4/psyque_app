# Reglas Base de Datos (Supabase + PostgreSQL)

## RLS (Row Level Security)

Toda tabla nueva con datos de pacientes o sesiones DEBE tener RLS habilitado:

```sql
-- Habilitar RLS
ALTER TABLE nueva_tabla ENABLE ROW LEVEL SECURITY;

-- Política estándar de tenant
CREATE POLICY "psychologist_owns_data" ON nueva_tabla
  FOR ALL USING (psychologist_id = auth.uid()::uuid);
```

## Esquema de tablas

- Columna `id`: UUID, default `gen_random_uuid()`
- Columna `psychologist_id`: UUID, FK a `auth.users`, NOT NULL
- Columnas de auditoría: `created_at`, `updated_at` con default `now()`
- Historial clínico: campo `signed_at` — una vez poblado, es inmutable (trigger o check constraint)

## Supabase Storage

- Archivos de pacientes: bucket privado, acceso solo con JWT válido del psicólogo dueño
- URLs firmadas con expiración corta (máx. 1 hora) para documentos sensibles

## Performance

- Índices en `psychologist_id` en todas las tablas con RLS
- Índices en `patient_id` para queries de historial
- Para tablas grandes (sesiones, logs), agregar índice en `created_at`

## Lo que NO hacer

- No usar `supabase.auth.admin` en queries de usuario final
- No deshabilitar RLS aunque sea temporalmente en producción
- No almacenar tokens de sesión o refresh tokens en la DB de la app
