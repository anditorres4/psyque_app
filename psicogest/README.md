# psyque app Colombia

Sistema SaaS de gestión clínica para psicólogos independientes en Colombia.

Stack: React 18 + FastAPI + PostgreSQL 16 (Supabase) + RLS multitenant

## Prerrequisitos

- Python 3.12+
- Node 20+
- Cuenta Supabase gratuita en [supabase.com](https://supabase.com)

## Iniciar y detener el proyecto

### Iniciar (PowerShell)

**Backend** — desde `psicogest\backend\`:
```powershell
& "C:\Users\aneto\AppData\Local\Python\bin\python3.exe" -m uvicorn app.main:app --reload --port 8000
```

**Frontend** — desde `psicogest\frontend\`:
```powershell
npm run dev
```

### Detener (PowerShell)

```powershell
Get-Process -Name python3 -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
```

---

## Setup local

### 1. Obtener credenciales Supabase

En el dashboard de tu proyecto Supabase:
- `Settings → API` → copiar `Project URL`, `anon key`, `service_role key`
- `Settings → JWT Settings` → copiar `JWT Secret`
- `Settings → Database` → copiar el connection string (Transaction mode, puerto 5432)

### 2. Backend

```bash
cd backend
cp .env.example .env
# Editar .env con tus credenciales Supabase

pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Verificar: `curl http://localhost:8000/api/v1/health`

### 3. Frontend

```bash
cd frontend
cp .env.example .env
# Editar .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY

npm install
npm run dev
```

Abrir: http://localhost:5173

### 4. Tests

```bash
cd backend
pytest tests/ -v
```

## Estructura del monorepo

```
psicogest/
├── backend/      FastAPI + Alembic + tests
├── frontend/     React 18 + Vite + shadcn/ui
├── shared/       Tipos TypeScript compartidos
└── docs/         Planes de implementación y documentación técnica
```

## Normativa implementada

- **Res. 2275/2023 + 1442/2024**: RIPS en JSON con CIE-11
- **Res. 1995/1999**: Historia clínica con registros firmados inmutables
- **Ley 1581/2012**: Consentimiento informado digital con retención 20 años
- **Ley 527/1999**: Firma electrónica con SHA-256 + timestamp servidor
