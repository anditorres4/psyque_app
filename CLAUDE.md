# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

PsyCent es un sistema de gestión clínica para psicólogos independientes en Colombia. Incluye un administrador de pacientes multi-tenant y una integración planificada de triage por WhatsApp (vía Kapso + n8n).

## Arquitectura

Monorepo en `psicogest/`:

```
psicogest/
├── backend/   FastAPI + SQLAlchemy 2.0 + PostgreSQL (Supabase). Python 3.12.
├── frontend/  React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui.
└── shared/    Tipos TypeScript compartidos entre frontend y contratos del backend.
```

**Auth:** Supabase Auth (JWT). El backend valida tokens via JWK. El frontend usa `@supabase/supabase-js`.

**Multi-tenancy:** Cada tabla tiene columna `psychologist_id`. Las políticas RLS de Supabase aplican el aislamiento — nunca usar `service_role` key en rutas de usuario final.

**Roles actuales:** `psychologist` (acceso completo). **Planificado:** `patient` (portal de solo lectura, mismo proyecto Supabase).

**n8n MCP:** Disponible en esta sesión de Claude Code como `n8n-mcp`. Úsalo para crear flujos de WhatsApp, email y automatización de pacientes. Siempre validar con `n8n_validate_workflow` antes de desplegar.

## Comandos de Desarrollo

### Backend
```bash
cd psicogest/backend
source .venv/bin/activate          # Windows: .venv\Scripts\activate
uvicorn app.main:app --reload      # http://localhost:8000
alembic upgrade head               # Ejecutar migraciones pendientes
alembic revision --autogenerate -m "descripcion"
pytest
pytest tests/test_patients.py -v  # Test específico
```

### Frontend
```bash
cd psicogest/frontend
npm run dev     # http://localhost:5173
npm run build
npm run lint
```

## Integraciones

| Servicio | Propósito | Variables |
|----------|-----------|-----------|
| Supabase | DB + Auth + Storage | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` |
| 100ms (HMS) | Videoconsultas | `HMS_APP_ACCESS_KEY`, `HMS_APP_SECRET` |
| Google Calendar | Sincronización citas | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Anthropic / OpenAI | Funciones AI clínicas | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` |
| Railway | Deploy backend | `railway.toml` |
| Vercel | Deploy frontend | `vercel.json` |
| n8n | Automatización + triage | VPS independiente, MCP via `n8n-mcp` |
| Kapso | WhatsApp Business API | VPS independiente |
| Resend | Email transaccional | `RESEND_API_KEY` (recomendado) |

## Normativa Colombiana

- **Res. 2275/2023** — RIPS (reportes de reclamación de salud). `rips_service.py` genera XML válido.
- **Res. 1995/1999** — Historial clínico inmutable una vez firmado. Las notas de sesión tienen campo de firma digital.
- **Ley 1581/2012** — Protección de datos (habeas data). Requiere auditoría de consentimiento.
- **Ley 527/1999** — Validez legal de documentos electrónicos.

## Features Planificados (no implementar sin solicitud explícita)

- **Portal de Pacientes** — Rol `patient` en el mismo app React. Auth Supabase (email/contraseña + Google OAuth). Acceso a propios registros, agendamiento.
- **Triage WhatsApp** — Kapso → n8n → webhook backend. Cuestionarios automatizados, scoring de urgencia, alerta al psicólogo.
- **Notificaciones in-app** — Supabase Realtime para alertas en vivo.
- **Email** — Resend API para recordatorios de citas y entrega de notas de sesión.

## Diseño Frontend

Contexto de salud mental: UI calmada, profesional, bajo costo cognitivo.
- Paleta: verdes y azules suaves, grises neutros, alto contraste para texto clínico.
- Componentes: shadcn/ui con tema personalizado. Evitar rojos/naranjas intensos fuera de alertas críticas.
- Portal pacientes: extra simplificado, áreas táctiles grandes, tonos cálidos.

## Licencias de Dependencias

Antes del lanzamiento comercial verificar cumplimiento:

- **`psycopg2-binary`** — LGPL-2.1. Distribución como binario permite uso en SaaS sin obligación de liberar código fuente, siempre que no se modifique la librería. Revisar al distribuir instaladores de escritorio.
- **`reportlab`** — BSD (ReportLab Toolkit OSS). Libre para uso comercial bajo BSD. La versión ReportLab Plus (propietaria) no es usada aquí.

## Convenciones de Código

- **Backend:** `async/await` en todas las rutas. `Depends()` para sesiones DB y auth. Nunca `service_role` en rutas de usuario.
- **Frontend:** React Query para todo el estado del servidor. Schemas Zod espejean los schemas Pydantic del backend. Sin prop drilling — usar cache de React Query.
- **Migraciones:** Siempre Alembic. Nunca editar el esquema DB manualmente.
- **Secretos:** `.env.local` (frontend), `.env` (backend). Nunca commitear archivos `.env`.
- **Nuevos devs:** Ver `.claude/rules/` para guías por capa. `.claude/agents/` para agentes especializados.
