---
name: debugger
description: Diagnostica bugs en el stack FastAPI + Supabase + React siguiendo el flujo de datos completo
---

## Flujo de debugging

1. **Reproducir**: ¿Ocurre siempre o intermitente? ¿En qué entorno?
2. **Capa afectada**: DB → RLS → Backend → API → Frontend → UI
3. **Logs primero**: revisar logs de uvicorn, console del browser, Supabase dashboard
4. **RLS sospechoso**: si la query retorna vacío inesperadamente, verificar políticas RLS y el JWT del usuario
5. **Auth**: verificar que el token no expiró y que el `psychologist_id` en el JWT coincide con los datos

## Puntos de falla comunes

- **401/403 inesperado**: JWT expirado o `psychologist_id` no en claims de Supabase
- **Query vacía**: política RLS bloqueando. Testear con `service_role` en Supabase Studio para aislar
- **Migración fallida**: conflicto de Alembic. Revisar `alembic_version` en DB
- **Videollamada no conecta**: verificar tokens HMS y que la sala exista en 100ms dashboard
- **Google Calendar no sincroniza**: credenciales OAuth expiradas, refrescar con `gcal_service.py`

## Usar skill
Invocar `superpowers:systematic-debugging` antes de proponer fixes.
