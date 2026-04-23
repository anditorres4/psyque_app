# Sprint 1 — Monorepo Setup, DB Schema, Auth & RLS

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffoldar el monorepo completo de psyque app con todas las migraciones de base de datos, RLS multitenant, middleware JWT de FastAPI, y las páginas de autenticación React — con el test de aislamiento multitenant pasando antes de continuar al Sprint 2.

**Architecture:** Monorepo en `psicogest/` con tres workspaces: `backend/` (FastAPI + Alembic sobre Supabase PostgreSQL), `frontend/` (React 18 + Vite + TypeScript + shadcn/ui), y `shared/` (tipos TS compartidos). La seguridad multitenant se implementa con Row-Level Security de PostgreSQL: el JWT de Supabase Auth lleva `tenant_id` como claim, y cada tabla clínica tiene política RLS que filtra por ese claim. El backend valida el JWT en cada request y lo inyecta en el contexto de la conexión DB.

**Tech Stack:** Python 3.12 / FastAPI / SQLAlchemy 2 / Alembic / Supabase (PostgreSQL 16 + Auth + Storage) / React 18 / Vite / TypeScript / shadcn/ui / Tailwind CSS / Zod / pytest / Vitest

---

## Pre-requisitos de entorno (manual, no automatizable)

Antes de correr cualquier comando, el desarrollador debe:
1. Crear un proyecto en [supabase.com](https://supabase.com) (plan gratuito)
2. Copiar `SUPABASE_URL`, `SUPABASE_ANON_KEY`, y `SUPABASE_SERVICE_KEY` del dashboard → Settings → API
3. Copiar `SUPABASE_JWT_SECRET` del dashboard → Settings → JWT Settings
4. Tener Python 3.12 y Node 20+ instalados
5. Tener `uv` o `pip` disponibles para Python

---

## File Map

```
psicogest/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                          # FastAPI app factory
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       └── health.py                # GET /api/v1/health
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── config.py                    # Settings con Pydantic BaseSettings
│   │   │   ├── database.py                  # Engine + SessionLocal + get_db
│   │   │   └── security.py                  # JWT validation, get_current_tenant
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── base.py                      # Base declarativa + mixins timestamp
│   │   └── schemas/
│   │       ├── __init__.py
│   │       └── auth.py                      # TenantContext schema
│   ├── alembic/
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   │       └── 0001_initial_schema.py       # Todas las tablas + RLS policies
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py                      # Fixtures: two_tenants, db, client
│   │   └── test_rls_isolation.py            # Test criterio de éxito Sprint 1
│   ├── alembic.ini
│   ├── pyproject.toml
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                          # Router + auth guard
│   │   ├── lib/
│   │   │   ├── supabase.ts                  # Supabase client singleton
│   │   │   └── utils.ts                     # cn() helper para clases
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.tsx            # Sidebar + topbar wrapper
│   │   │   │   └── Sidebar.tsx              # Navegación lateral fija
│   │   │   └── ui/                          # shadcn/ui components (auto-generados)
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   └── RegisterPage.tsx
│   │   │   └── DashboardPage.tsx            # Placeholder vacío
│   │   ├── hooks/
│   │   │   └── useAuth.ts                   # Hook de sesión Supabase
│   │   └── types/
│   │       └── index.ts                     # Re-export de tipos shared
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── components.json                      # shadcn/ui config
│   ├── package.json
│   └── .env.example
├── shared/
│   └── types/
│       └── index.ts                         # Tipos TS compartidos (DocType, PayerType, etc.)
├── docker-compose.yml                       # Para dev local (opcional, sin Supabase cloud)
└── README.md
```

---

## Task 1: Monorepo skeleton y configuración base

**Files:**
- Create: `psicogest/README.md`
- Create: `psicogest/backend/pyproject.toml`
- Create: `psicogest/backend/.env.example`
- Create: `psicogest/frontend/package.json`
- Create: `psicogest/frontend/.env.example`
- Create: `psicogest/shared/types/index.ts`

- [ ] **Step 1: Crear directorios del monorepo**

```bash
cd c:/Users/aneto/Proyectos/psyque_app
mkdir -p psicogest/backend/app/api/v1
mkdir -p psicogest/backend/app/core
mkdir -p psicogest/backend/app/models
mkdir -p psicogest/backend/app/schemas
mkdir -p psicogest/backend/alembic/versions
mkdir -p psicogest/backend/tests
mkdir -p psicogest/frontend/src/components/layout
mkdir -p psicogest/frontend/src/components/ui
mkdir -p psicogest/frontend/src/pages/auth
mkdir -p psicogest/frontend/src/hooks
mkdir -p psicogest/frontend/src/lib
mkdir -p psicogest/frontend/src/types
mkdir -p psicogest/shared/types
mkdir -p psicogest/docs
```

- [ ] **Step 2: Crear `psicogest/backend/.env.example`**

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...  # service_role key (server-side only, never commit real value)
SUPABASE_JWT_SECRET=your-jwt-secret

# App
APP_URL=http://localhost:3000
ENVIRONMENT=development

# Email (Resend)
RESEND_API_KEY=re_...
```

- [ ] **Step 3: Crear `psicogest/backend/pyproject.toml`**

```toml
[project]
name = "psyque-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.32.0",
    "sqlalchemy>=2.0.36",
    "alembic>=1.14.0",
    "psycopg2-binary>=2.9.10",
    "pydantic>=2.10.0",
    "pydantic-settings>=2.6.0",
    "python-jose[cryptography]>=3.3.0",
    "httpx>=0.28.0",
    "python-dotenv>=1.0.1",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3.0",
    "pytest-asyncio>=0.25.0",
    "pytest-cov>=6.0.0",
    "httpx>=0.28.0",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

- [ ] **Step 4: Crear `psicogest/frontend/.env.example`**

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...  # anon public key (safe to expose in browser)
```

- [ ] **Step 5: Crear tipos compartidos `psicogest/shared/types/index.ts`**

```typescript
// Tipos de documento de identidad Colombia
export type DocType = 'CC' | 'TI' | 'CE' | 'PA' | 'RC' | 'MS';

// Tipo de pagador / vinculación
export type PayerType = 'PA' | 'CC' | 'SS' | 'PE' | 'SE';

// Sexo biológico para RIPS
export type BiologicalSex = 'M' | 'F' | 'I';

// Estado civil
export type MaritalStatus = 'S' | 'C' | 'U' | 'D' | 'V' | 'SE';

// Zona urbano/rural para RIPS
export type Zone = 'U' | 'R';

// Tipo de sesión
export type SessionType = 'individual' | 'couple' | 'family' | 'followup';

// Modalidad de atención
export type Modality = 'presential' | 'virtual';

// Estado de la cita
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'noshow';

// Estado de la nota clínica
export type SessionStatus = 'draft' | 'signed';

// Plan SaaS
export type SaaSPlan = 'starter' | 'pro' | 'clinic';
```

- [ ] **Step 6: Crear `psicogest/README.md`**

```markdown
# psyque app Colombia

Sistema SaaS de gestión clínica para psicólogos independientes en Colombia.

## Setup local (un solo comando)

### Prerrequisitos
- Python 3.12+
- Node 20+
- Cuenta Supabase (gratuita en supabase.com)

### Pasos

```bash
# 1. Clonar e instalar dependencias
cd psicogest

# Backend
cd backend
cp .env.example .env
# Editar .env con tus credenciales Supabase
pip install -e ".[dev]"

# Aplicar migraciones
alembic upgrade head

# Levantar backend
uvicorn app.main:app --reload --port 8000

# Frontend (nueva terminal)
cd ../frontend
cp .env.example .env
# Editar .env con tus credenciales Supabase
npm install
npm run dev
```

Backend: http://localhost:8000
Frontend: http://localhost:3000
API docs: http://localhost:8000/docs
```

- [ ] **Step 7: Commit inicial**

```bash
cd c:/Users/aneto/Proyectos/psyque_app
git init psicogest
cd psicogest
git add .
git commit -m "chore: initialize monorepo structure"
```

---

## Task 2: Backend — Core (config, database, security)

**Files:**
- Create: `psicogest/backend/app/__init__.py`
- Create: `psicogest/backend/app/core/__init__.py`
- Create: `psicogest/backend/app/core/config.py`
- Create: `psicogest/backend/app/core/database.py`
- Create: `psicogest/backend/app/core/security.py`
- Create: `psicogest/backend/app/schemas/__init__.py`
- Create: `psicogest/backend/app/schemas/auth.py`

- [ ] **Step 1: Crear `psicogest/backend/app/core/config.py`**

```python
"""Application configuration loaded from environment variables."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All settings are required — app fails fast if any is missing."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Supabase
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str

    # App
    app_url: str = "http://localhost:3000"
    environment: str = "development"

    # Email
    resend_api_key: str = ""

    @property
    def is_development(self) -> bool:
        """True when running in development environment."""
        return self.environment == "development"


settings = Settings()
```

- [ ] **Step 2: Crear `psicogest/backend/app/core/database.py`**

```python
"""SQLAlchemy engine and session factory for Supabase PostgreSQL."""
from collections.abc import Generator

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

# Build connection URL from Supabase project URL
# Supabase exposes PostgreSQL at: postgresql://postgres:[password]@[host]:5432/postgres
# But we connect via the connection string pattern for service-role access
_SUPABASE_DB_URL = settings.supabase_url.replace("https://", "postgresql://postgres:")
# Note: actual DB password must be added to .env as SUPABASE_DB_PASSWORD
# For now, engine is configured but connection string needs full URL in production


def _build_db_url() -> str:
    """Build the full PostgreSQL DSN from Supabase URL pattern.

    Supabase direct connection:
    postgresql://postgres:[DB_PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
    """
    # This will be read from SUPABASE_DATABASE_URL env var directly
    return settings.supabase_database_url  # type: ignore[attr-defined]


from sqlalchemy import create_engine
from app.core.config import settings as _settings

engine = create_engine(
    _settings.supabase_database_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    echo=_settings.is_development,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that provides a database session.

    Sets the tenant context on the connection so RLS policies can read it.
    The tenant_id must be set via set_tenant_context() after getting the session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def set_tenant_context(db: Session, tenant_id: str) -> None:
    """Inject tenant_id into the PostgreSQL session for RLS evaluation.

    Supabase RLS policies read auth.jwt()->>'tenant_id'. We simulate this
    in the backend by setting a local variable that the RLS policy reads.

    Args:
        db: Active SQLAlchemy session.
        tenant_id: UUID of the authenticated tenant (psychologist).
    """
    db.execute(
        text("SET LOCAL app.tenant_id = :tid"),
        {"tid": tenant_id},
    )
```

- [ ] **Step 3: Actualizar `psicogest/backend/app/core/config.py` para incluir database URL**

Reemplazar el archivo con la versión que incluye `supabase_database_url`:

```python
"""Application configuration loaded from environment variables."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All settings are required — app fails fast if any is missing."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Supabase
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str
    supabase_database_url: str  # Full DSN: postgresql://postgres:[pass]@db.[ref].supabase.co:5432/postgres

    # App
    app_url: str = "http://localhost:3000"
    environment: str = "development"

    # Email
    resend_api_key: str = ""

    @property
    def is_development(self) -> bool:
        """True when running in development environment."""
        return self.environment == "development"


settings = Settings()
```

- [ ] **Step 4: Actualizar `psicogest/backend/.env.example` con `SUPABASE_DATABASE_URL`**

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_DATABASE_URL=postgresql://postgres:your-db-password@db.your-project-ref.supabase.co:5432/postgres

# App
APP_URL=http://localhost:3000
ENVIRONMENT=development

# Email (Resend)
RESEND_API_KEY=re_...
```

- [ ] **Step 5: Crear `psicogest/backend/app/core/security.py`**

```python
"""JWT validation and tenant extraction from Supabase Auth tokens."""
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings

_bearer = HTTPBearer()


class TenantContext:
    """Holds the authenticated tenant's identity extracted from JWT."""

    def __init__(self, tenant_id: str, user_id: str) -> None:
        self.tenant_id = tenant_id
        self.user_id = user_id


def get_current_tenant(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> TenantContext:
    """FastAPI dependency: validate Supabase JWT and extract tenant_id.

    Supabase JWTs store the user UUID as 'sub'. The tenant_id is stored
    in the 'app_metadata' claim as 'tenant_id'. If the tenant record has
    not been created yet (first login), this will raise 401 — the frontend
    must complete onboarding before accessing the API.

    Args:
        credentials: Bearer token from Authorization header.

    Returns:
        TenantContext with tenant_id and user_id.

    Raises:
        HTTPException 401: If token is invalid, expired, or missing tenant_id.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},  # Supabase tokens don't set aud
        )
        user_id: str = payload.get("sub", "")
        if not user_id:
            raise credentials_exception

        # Tenant ID is stored in app_metadata by the trigger that creates tenants
        app_metadata: dict = payload.get("app_metadata", {})
        tenant_id: str = app_metadata.get("tenant_id", "")
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Cuenta no configurada. Complete el registro.",
            )
    except JWTError:
        raise credentials_exception

    return TenantContext(tenant_id=tenant_id, user_id=user_id)


CurrentTenant = Annotated[TenantContext, Depends(get_current_tenant)]
```

- [ ] **Step 6: Crear `psicogest/backend/app/schemas/auth.py`**

```python
"""Pydantic schemas for authentication context."""
from pydantic import BaseModel


class TenantContextSchema(BaseModel):
    """Represents the authenticated psychologist's identity."""

    tenant_id: str
    user_id: str
```

- [ ] **Step 7: Crear archivos `__init__.py` vacíos necesarios**

```bash
touch psicogest/backend/app/__init__.py
touch psicogest/backend/app/api/__init__.py
touch psicogest/backend/app/api/v1/__init__.py
touch psicogest/backend/app/core/__init__.py
touch psicogest/backend/app/models/__init__.py
touch psicogest/backend/app/schemas/__init__.py
touch psicogest/backend/tests/__init__.py
```

---

## Task 3: Backend — SQLAlchemy models base

**Files:**
- Create: `psicogest/backend/app/models/base.py`
- Create: `psicogest/backend/app/models/__init__.py`

- [ ] **Step 1: Crear `psicogest/backend/app/models/base.py`**

```python
"""SQLAlchemy declarative base and shared mixins for all models."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


class TimestampMixin:
    """Adds created_at and updated_at columns managed by PostgreSQL triggers."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class TenantMixin:
    """Adds tenant_id for Row-Level Security filtering."""

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )


class UUIDPrimaryKey:
    """UUID primary key auto-generated by PostgreSQL."""

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
```

---

## Task 4: Backend — Alembic setup + migración inicial completa

**Files:**
- Create: `psicogest/backend/alembic.ini`
- Create: `psicogest/backend/alembic/env.py`
- Create: `psicogest/backend/alembic/script.py.mako`
- Create: `psicogest/backend/alembic/versions/0001_initial_schema.py`

- [ ] **Step 1: Inicializar Alembic en el backend**

```bash
cd psicogest/backend
alembic init alembic
```

Esto crea la estructura base. Los siguientes pasos sobrescriben los archivos generados.

- [ ] **Step 2: Reemplazar `psicogest/backend/alembic/env.py`**

```python
"""Alembic environment configuration for psyque app."""
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# Import all models so Alembic can detect them
from app.models.base import Base  # noqa: F401

config = context.config

# Override sqlalchemy.url from environment variable
config.set_main_option(
    "sqlalchemy.url",
    os.environ.get("SUPABASE_DATABASE_URL", ""),
)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (generates SQL without DB connection)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations with active DB connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 3: Crear `psicogest/backend/alembic/versions/0001_initial_schema.py`**

Esta es la migración más crítica del Sprint 1 — crea todas las tablas con RLS.

```python
"""Initial schema: all tables with RLS policies.

Revision ID: 0001
Revises: 
Create Date: 2026-04-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # =========================================================
    # HELPER: trigger function for updated_at
    # =========================================================
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql';
    """)

    # =========================================================
    # TABLE: tenants
    # =========================================================
    op.create_table(
        'tenants',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('auth_user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('full_name', sa.String(200), nullable=False),
        sa.Column('colpsic_number', sa.String(20), nullable=False),
        sa.Column('reps_code', sa.String(30), nullable=True),
        sa.Column('nit', sa.String(15), nullable=True),
        sa.Column('plan', sa.Enum('starter', 'pro', 'clinic', name='saas_plan'), nullable=False, server_default='starter'),
        sa.Column('plan_expires_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('city', sa.String(100), nullable=False),
        sa.Column('session_duration_min', sa.Integer(), nullable=False, server_default='50'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('auth_user_id'),
    )
    op.create_index('ix_tenants_auth_user_id', 'tenants', ['auth_user_id'])
    op.execute("CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();")

    # =========================================================
    # TABLE: patients
    # =========================================================
    op.create_table(
        'patients',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('hc_number', sa.String(20), nullable=False),
        sa.Column('doc_type', sa.Enum('CC', 'TI', 'CE', 'PA', 'RC', 'MS', name='doc_type'), nullable=False),
        sa.Column('doc_number', sa.String(20), nullable=False),
        sa.Column('first_surname', sa.String(100), nullable=False),
        sa.Column('second_surname', sa.String(100), nullable=True),
        sa.Column('first_name', sa.String(100), nullable=False),
        sa.Column('second_name', sa.String(100), nullable=True),
        sa.Column('birth_date', sa.Date(), nullable=False),
        sa.Column('biological_sex', sa.Enum('M', 'F', 'I', name='biological_sex'), nullable=False),
        sa.Column('gender_identity', sa.String(50), nullable=True),
        sa.Column('marital_status', sa.Enum('S', 'C', 'U', 'D', 'V', 'SE', name='marital_status'), nullable=False),
        sa.Column('occupation', sa.String(150), nullable=False),
        sa.Column('address', sa.Text(), nullable=False),
        sa.Column('municipality_dane', sa.String(10), nullable=False),
        sa.Column('zone', sa.Enum('U', 'R', name='zone'), nullable=False),
        sa.Column('phone', sa.String(20), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('payer_type', sa.Enum('PA', 'CC', 'SS', 'PE', 'SE', name='payer_type'), nullable=False),
        sa.Column('eps_name', sa.String(200), nullable=True),
        sa.Column('eps_code', sa.String(10), nullable=True),
        sa.Column('current_diagnosis_cie11', sa.String(20), nullable=True),
        sa.Column('consent_signed_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('consent_ip', postgresql.INET(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.UniqueConstraint('tenant_id', 'hc_number', name='uq_patients_hc_per_tenant'),
    )
    op.create_index('ix_patients_tenant_id', 'patients', ['tenant_id'])
    op.create_index('ix_patients_doc_number', 'patients', ['tenant_id', 'doc_number'])
    op.execute("CREATE TRIGGER patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();")

    # =========================================================
    # TABLE: appointments
    # =========================================================
    op.create_table(
        'appointments',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('scheduled_start', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('scheduled_end', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('session_type', sa.Enum('individual', 'couple', 'family', 'followup', name='session_type'), nullable=False),
        sa.Column('modality', sa.Enum('presential', 'virtual', name='modality'), nullable=False),
        sa.Column('status', sa.Enum('scheduled', 'completed', 'cancelled', 'noshow', name='appointment_status'), nullable=False, server_default='scheduled'),
        sa.Column('cancellation_reason', sa.Text(), nullable=True),
        sa.Column('cancelled_by', sa.Enum('psychologist', 'patient', name='cancelled_by'), nullable=True),
        sa.Column('reminder_sent_48h', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('reminder_sent_2h', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='RESTRICT'),
    )
    op.create_index('ix_appointments_tenant_id', 'appointments', ['tenant_id'])
    op.create_index('ix_appointments_patient_id', 'appointments', ['patient_id'])
    op.create_index('ix_appointments_scheduled_start', 'appointments', ['tenant_id', 'scheduled_start'])
    op.execute("CREATE TRIGGER appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();")

    # =========================================================
    # TABLE: sessions (clinical notes)
    # =========================================================
    op.create_table(
        'sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('appointment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('actual_start', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('actual_end', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('diagnosis_cie11', sa.String(20), nullable=False),
        sa.Column('diagnosis_description', sa.Text(), nullable=False),
        sa.Column('cups_code', sa.String(10), nullable=False),
        sa.Column('consultation_reason', sa.Text(), nullable=False),
        sa.Column('intervention', sa.Text(), nullable=False),
        sa.Column('evolution', sa.Text(), nullable=True),
        sa.Column('next_session_plan', sa.Text(), nullable=True),
        sa.Column('session_fee', sa.Integer(), nullable=False),
        sa.Column('authorization_number', sa.String(30), nullable=True),
        sa.Column('status', sa.Enum('draft', 'signed', name='session_status'), nullable=False, server_default='draft'),
        sa.Column('session_hash', sa.String(64), nullable=True),
        sa.Column('signed_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('rips_included', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['appointment_id'], ['appointments.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='RESTRICT'),
    )
    op.create_index('ix_sessions_tenant_id', 'sessions', ['tenant_id'])
    op.create_index('ix_sessions_patient_id', 'sessions', ['patient_id'])
    op.create_index('ix_sessions_actual_start', 'sessions', ['tenant_id', 'actual_start'])
    op.execute("CREATE TRIGGER sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();")

    # =========================================================
    # TABLE: session_notes (clarification notes — append-only)
    # =========================================================
    op.create_table(
        'session_notes',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('note_hash', sa.String(64), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        # No updated_at — this table is append-only by design
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ondelete='RESTRICT'),
    )
    op.create_index('ix_session_notes_session_id', 'session_notes', ['session_id'])

    # =========================================================
    # TABLE: rips_exports
    # =========================================================
    op.create_table(
        'rips_exports',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('period_year', sa.SmallInteger(), nullable=False),
        sa.Column('period_month', sa.SmallInteger(), nullable=False),
        sa.Column('sessions_count', sa.Integer(), nullable=False),
        sa.Column('total_value_cop', sa.Integer(), nullable=False),
        sa.Column('json_file_path', sa.Text(), nullable=False),
        sa.Column('generated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('validation_errors', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
    )
    op.create_index('ix_rips_exports_tenant_id', 'rips_exports', ['tenant_id'])
    op.execute("CREATE TRIGGER rips_exports_updated_at BEFORE UPDATE ON rips_exports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();")

    # =========================================================
    # TABLE: audit_logs (append-only, no UPDATE/DELETE allowed)
    # =========================================================
    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),  # nullable for auth events
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('ip_address', postgresql.INET(), nullable=True),
        sa.Column('timestamp', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('metadata', postgresql.JSONB(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_audit_logs_tenant_id', 'audit_logs', ['tenant_id'])
    op.create_index('ix_audit_logs_timestamp', 'audit_logs', ['timestamp'])

    # =========================================================
    # TABLE: availability_blocks (for scheduling)
    # =========================================================
    op.create_table(
        'availability_blocks',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('day_of_week', sa.SmallInteger(), nullable=False),  # 0=Mon, 6=Sun
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_availability_blocks_tenant_id', 'availability_blocks', ['tenant_id'])
    op.execute("CREATE TRIGGER availability_updated_at BEFORE UPDATE ON availability_blocks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();")

    # =========================================================
    # ROW-LEVEL SECURITY — Enable on all clinical tables
    # =========================================================
    clinical_tables = [
        'patients', 'appointments', 'sessions',
        'session_notes', 'rips_exports', 'availability_blocks',
    ]
    for table in clinical_tables:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")

    # RLS Policy: tenant can only see their own rows
    # We use current_setting('app.tenant_id') set by the backend on each request
    for table in clinical_tables:
        op.execute(f"""
            CREATE POLICY {table}_tenant_isolation ON {table}
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
            WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
        """)

    # audit_logs: allow insert from any tenant, read own rows
    op.execute("ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY audit_logs_tenant_isolation ON audit_logs
        FOR SELECT
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
    """)
    op.execute("""
        CREATE POLICY audit_logs_insert ON audit_logs
        FOR INSERT
        WITH CHECK (true);  -- Allow any insert; tenant_id enforced at app layer
    """)


def downgrade() -> None:
    """Remove all tables and types in reverse dependency order."""
    tables_with_rls = [
        'audit_logs', 'availability_blocks', 'rips_exports',
        'session_notes', 'sessions', 'appointments', 'patients', 'tenants',
    ]
    for table in tables_with_rls:
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE;")

    # Drop custom types
    for enum_type in [
        'saas_plan', 'doc_type', 'biological_sex', 'marital_status',
        'zone', 'payer_type', 'session_type', 'modality',
        'appointment_status', 'cancelled_by', 'session_status',
    ]:
        op.execute(f"DROP TYPE IF EXISTS {enum_type};")

    op.execute("DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;")
```

- [ ] **Step 4: Aplicar migración**

```bash
cd psicogest/backend
alembic upgrade head
```

Salida esperada:
```
INFO  [alembic.runtime.migration] Context impl PostgreSQLImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade  -> 0001, Initial schema: all tables with RLS policies
```

---

## Task 5: Backend — FastAPI app + health endpoint

**Files:**
- Create: `psicogest/backend/app/main.py`
- Create: `psicogest/backend/app/api/v1/health.py`

- [ ] **Step 1: Crear `psicogest/backend/app/api/v1/health.py`**

```python
"""Health check endpoint."""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db

router = APIRouter()


@router.get("/health")
def health_check(db: Session = Depends(get_db)) -> dict:
    """Return service health status and database connectivity.

    Returns:
        dict with status, database connectivity, and version.
    """
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "error"

    return {
        "status": "ok",
        "database": db_status,
        "version": "1.0.0",
        "service": "psyque-backend",
    }
```

- [ ] **Step 2: Crear `psicogest/backend/app/main.py`**

```python
"""FastAPI application factory for psyque app backend."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.health import router as health_router
from app.core.config import settings

app = FastAPI(
    title="psyque app API",
    description="Sistema de gestión clínica para psicólogos independientes en Colombia",
    version="1.0.0",
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.app_url, "http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api/v1", tags=["health"])
```

- [ ] **Step 3: Verificar que el servidor arranca**

```bash
cd psicogest/backend
uvicorn app.main:app --reload --port 8000
```

Visitar http://localhost:8000/api/v1/health
Respuesta esperada: `{"status": "ok", "database": "ok", "version": "1.0.0", "service": "psyque-backend"}`

---

## Task 6: Tests — Criterio de éxito Sprint 1 (RLS isolation)

**Files:**
- Create: `psicogest/backend/tests/conftest.py`
- Create: `psicogest/backend/tests/test_rls_isolation.py`

Este es el test de criterio de éxito del Sprint 1. Debe pasar antes de continuar al Sprint 2.

- [ ] **Step 1: Escribir `psicogest/backend/tests/conftest.py`**

```python
"""Pytest fixtures for psyque app backend tests."""
import uuid
from collections.abc import Generator
from datetime import date, datetime, timezone, timedelta

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


@pytest.fixture(scope="session")
def db_engine():
    """Create engine connected to test Supabase database."""
    engine = create_engine(
        settings.supabase_database_url,
        pool_pre_ping=True,
        echo=False,
    )
    yield engine
    engine.dispose()


@pytest.fixture()
def db(db_engine) -> Generator[Session, None, None]:
    """Provide a database session with transaction rollback after each test."""
    connection = db_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


def _create_tenant(db: Session, *, name: str) -> dict:
    """Insert a tenant row and return its id.
    
    Args:
        db: Active database session.
        name: Human-readable name for the tenant (for test identification).
    
    Returns:
        dict with 'id' (UUID str) and 'auth_user_id' (UUID str).
    """
    auth_user_id = str(uuid.uuid4())
    result = db.execute(
        text("""
            INSERT INTO tenants (auth_user_id, full_name, colpsic_number, plan, plan_expires_at, city)
            VALUES (:auth_user_id, :full_name, 'COL-TEST-001', 'starter',
                    NOW() + INTERVAL '30 days', 'Bogotá')
            RETURNING id, auth_user_id
        """),
        {"auth_user_id": auth_user_id, "full_name": name},
    )
    row = result.mappings().one()
    return {"id": str(row["id"]), "auth_user_id": str(row["auth_user_id"])}


def _set_tenant_context(db: Session, tenant_id: str) -> None:
    """Set the PostgreSQL session variable used by RLS policies."""
    db.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": tenant_id})


@pytest.fixture()
def two_tenants(db: Session) -> dict:
    """Create two independent tenants and one patient per tenant.
    
    Returns:
        dict with keys 'tenant_a', 'tenant_b', 'patient_a_id', 'patient_b_id'
    """
    tenant_a = _create_tenant(db, name="Psicólogo Tenant A")
    tenant_b = _create_tenant(db, name="Psicólogo Tenant B")

    # Create patient for tenant A (RLS off temporarily — we're seeding test data)
    db.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": tenant_a["id"]})
    patient_a = db.execute(
        text("""
            INSERT INTO patients (
                tenant_id, hc_number, doc_type, doc_number,
                first_surname, first_name, birth_date, biological_sex,
                marital_status, occupation, address, municipality_dane,
                zone, phone, payer_type, consent_signed_at, consent_ip
            ) VALUES (
                :tenant_id, 'HC-2026-0001', 'CC', '12345678',
                'García', 'Ana', '1990-01-01', 'F',
                'S', 'Profesora', 'Calle 1 # 2-3', '11001',
                'U', '3001234567', 'PA', NOW(), '127.0.0.1'
            ) RETURNING id
        """),
        {"tenant_id": tenant_a["id"]},
    ).mappings().one()

    # Create patient for tenant B
    db.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": tenant_b["id"]})
    patient_b = db.execute(
        text("""
            INSERT INTO patients (
                tenant_id, hc_number, doc_type, doc_number,
                first_surname, first_name, birth_date, biological_sex,
                marital_status, occupation, address, municipality_dane,
                zone, phone, payer_type, consent_signed_at, consent_ip
            ) VALUES (
                :tenant_id, 'HC-2026-0001', 'CC', '87654321',
                'Rodríguez', 'Carlos', '1985-05-15', 'M',
                'C', 'Ingeniero', 'Carrera 5 # 10-20', '11001',
                'U', '3007654321', 'PA', NOW(), '127.0.0.1'
            ) RETURNING id
        """),
        {"tenant_id": tenant_b["id"]},
    ).mappings().one()

    return {
        "tenant_a": tenant_a,
        "tenant_b": tenant_b,
        "patient_a_id": str(patient_a["id"]),
        "patient_b_id": str(patient_b["id"]),
    }
```

- [ ] **Step 2: Escribir `psicogest/backend/tests/test_rls_isolation.py`**

```python
"""
Sprint 1 success criterion: RLS multitenant isolation.

A tenant authenticated as tenant A must NOT be able to read
records belonging to tenant B. The expected behavior is that
the query returns zero rows (the record appears to not exist),
NOT that it returns a 403 error.

This is the "perfect isolation" pattern: tenants don't even
know other tenants' records exist.
"""
from sqlalchemy import text
from sqlalchemy.orm import Session


def test_tenant_a_cannot_read_tenant_b_patient(two_tenants: dict, db: Session) -> None:
    """Authenticated as tenant A, querying tenant B's patient returns empty result."""
    tenant_a_id = two_tenants["tenant_a"]["id"]
    patient_b_id = two_tenants["patient_b_id"]

    # Set RLS context to tenant A
    db.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": tenant_a_id})

    # Try to read tenant B's patient
    result = db.execute(
        text("SELECT id FROM patients WHERE id = :patient_id"),
        {"patient_id": patient_b_id},
    ).fetchall()

    # RLS must return zero rows — the patient appears to not exist
    assert len(result) == 0, (
        f"RLS FAILURE: Tenant A ({tenant_a_id}) can read patient "
        f"{patient_b_id} belonging to Tenant B. "
        "This is a critical security violation."
    )


def test_tenant_a_can_read_own_patient(two_tenants: dict, db: Session) -> None:
    """Authenticated as tenant A, can read their own patient normally."""
    tenant_a_id = two_tenants["tenant_a"]["id"]
    patient_a_id = two_tenants["patient_a_id"]

    db.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": tenant_a_id})

    result = db.execute(
        text("SELECT id FROM patients WHERE id = :patient_id"),
        {"patient_id": patient_a_id},
    ).fetchall()

    assert len(result) == 1, (
        f"Tenant A ({tenant_a_id}) should be able to read their own "
        f"patient {patient_a_id} but got empty result."
    )


def test_tenant_b_cannot_read_tenant_a_patient(two_tenants: dict, db: Session) -> None:
    """Authenticated as tenant B, querying tenant A's patient returns empty result."""
    tenant_b_id = two_tenants["tenant_b"]["id"]
    patient_a_id = two_tenants["patient_a_id"]

    db.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": tenant_b_id})

    result = db.execute(
        text("SELECT id FROM patients WHERE id = :patient_id"),
        {"patient_id": patient_a_id},
    ).fetchall()

    assert len(result) == 0, (
        f"RLS FAILURE: Tenant B ({tenant_b_id}) can read patient "
        f"{patient_a_id} belonging to Tenant A."
    )


def test_no_tenant_context_returns_empty(two_tenants: dict, db: Session) -> None:
    """Without setting app.tenant_id, no clinical records are visible."""
    # Do NOT set app.tenant_id — simulate unauthenticated or missing context
    db.execute(text("RESET app.tenant_id"))

    result = db.execute(text("SELECT COUNT(*) as cnt FROM patients")).mappings().one()

    assert result["cnt"] == 0, (
        "Without tenant context, patients table must return zero rows. "
        f"Got {result['cnt']} rows — RLS is not configured correctly."
    )


def test_rls_prevents_cross_tenant_write(two_tenants: dict, db: Session) -> None:
    """Authenticated as tenant A, cannot insert a patient for tenant B."""
    import uuid
    tenant_a_id = two_tenants["tenant_a"]["id"]
    tenant_b_id = two_tenants["tenant_b"]["id"]

    db.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": tenant_a_id})

    # Attempt to insert a row with tenant_b's tenant_id
    from sqlalchemy.exc import DBAPIError
    try:
        db.execute(
            text("""
                INSERT INTO patients (
                    tenant_id, hc_number, doc_type, doc_number,
                    first_surname, first_name, birth_date, biological_sex,
                    marital_status, occupation, address, municipality_dane,
                    zone, phone, payer_type, consent_signed_at, consent_ip
                ) VALUES (
                    :tenant_id, 'HC-2026-HACK', 'CC', '99999999',
                    'Malicioso', 'Actor', '2000-01-01', 'M',
                    'S', 'Hacker', 'Dirección falsa', '11001',
                    'U', '3000000000', 'PA', NOW(), '1.2.3.4'
                )
            """),
            {"tenant_id": tenant_b_id},
        )
        db.flush()
        # If we get here, the insert succeeded — that's a failure
        assert False, (
            "RLS WITH CHECK violation not enforced: "
            "tenant A was able to insert a record for tenant B."
        )
    except DBAPIError:
        # Expected: PostgreSQL raised an error due to RLS WITH CHECK
        pass
```

- [ ] **Step 3: Correr los tests**

```bash
cd psicogest/backend
pytest tests/test_rls_isolation.py -v
```

Salida esperada:
```
tests/test_rls_isolation.py::test_tenant_a_cannot_read_tenant_b_patient PASSED
tests/test_rls_isolation.py::test_tenant_a_can_read_own_patient PASSED
tests/test_rls_isolation.py::test_tenant_b_cannot_read_tenant_a_patient PASSED
tests/test_rls_isolation.py::test_no_tenant_context_returns_empty PASSED
tests/test_rls_isolation.py::test_rls_prevents_cross_tenant_write PASSED

5 passed in X.XXs
```

- [ ] **Step 4: Commit Sprint 1 backend**

```bash
cd psicogest
git add backend/
git commit -m "feat(sprint-1): backend foundation — FastAPI, Alembic schema, RLS multitenant isolation tests passing"
```

---

## Task 7: Frontend — React + Vite + shadcn/ui

**Files:**
- Create: `psicogest/frontend/package.json`
- Create: `psicogest/frontend/vite.config.ts`
- Create: `psicogest/frontend/tsconfig.json`
- Create: `psicogest/frontend/tailwind.config.ts`
- Create: `psicogest/frontend/components.json`
- Create: `psicogest/frontend/index.html`

- [ ] **Step 1: Inicializar proyecto React con Vite**

```bash
cd psicogest
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

- [ ] **Step 2: Instalar dependencias del frontend**

```bash
cd psicogest/frontend
npm install @supabase/supabase-js react-router-dom@6 zod @hookform/resolvers react-hook-form
npm install -D tailwindcss postcss autoprefixer @types/node
npx tailwindcss init -p
```

- [ ] **Step 3: Instalar shadcn/ui**

```bash
cd psicogest/frontend
npx shadcn@latest init
```

Respuestas al wizard de shadcn/ui:
- Style: Default
- Base color: Slate
- CSS variables: Yes

Luego instalar componentes básicos:

```bash
npx shadcn@latest add button input label card form toast badge
```

- [ ] **Step 4: Actualizar `psicogest/frontend/src/lib/utils.ts`**

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

```bash
npm install clsx tailwind-merge
```

- [ ] **Step 5: Crear `psicogest/frontend/src/lib/supabase.ts`**

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Copy .env.example to .env and fill in the values."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
```

- [ ] **Step 6: Crear `psicogest/frontend/src/hooks/useAuth.ts`**

```typescript
import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({
        user: session?.user ?? null,
        session,
        loading: false,
      });
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        user: session?.user ?? null,
        session,
        loading: false,
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  return state;
}
```

---

## Task 8: Frontend — Auth pages (Login + Register)

**Files:**
- Create: `psicogest/frontend/src/pages/auth/LoginPage.tsx`
- Create: `psicogest/frontend/src/pages/auth/RegisterPage.tsx`

- [ ] **Step 1: Crear `psicogest/frontend/src/pages/auth/LoginPage.tsx`**

```tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const loginSchema = z.object({
  email: z.string().email("Ingresa un email válido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) {
      setServerError("Email o contraseña incorrectos. Verifica tus datos e intenta de nuevo.");
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
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-[#1E3A5F]">
            psyque app
          </CardTitle>
          <CardDescription>Ingresa a tu cuenta para continuar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                {...register("email")}
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p className="text-sm text-[#E74C3C]">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register("password")}
                aria-invalid={!!errors.password}
              />
              {errors.password && (
                <p className="text-sm text-[#E74C3C]">{errors.password.message}</p>
              )}
            </div>
            {serverError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-[#E74C3C]">
                {serverError}
              </div>
            )}
            <Button
              type="submit"
              className="w-full bg-[#2E86AB] hover:bg-[#1E3A5F]"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">o continúa con</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <Link to="/register" className="text-[#2E86AB] hover:underline font-medium">
              Regístrate aquí
            </Link>
          </p>
          <p className="text-center text-sm">
            <Link to="/forgot-password" className="text-[#2E86AB] hover:underline text-xs">
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Crear `psicogest/frontend/src/pages/auth/RegisterPage.tsx`**

```tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const registerSchema = z.object({
  fullName: z.string().min(3, "Nombre completo requerido"),
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
    .regex(/[0-9]/, "Debe contener al menos un número"),
  colpsicNumber: z.string().min(4, "Número de tarjeta profesional requerido"),
  repsCode: z.string().optional(),
  city: z.string().min(2, "Ciudad requerida"),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

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
      setServerError(
        error.message === "User already registered"
          ? "Ya existe una cuenta con este email. Intenta iniciar sesión."
          : "Error al crear la cuenta. Intenta de nuevo."
      );
      return;
    }
    setEmailSent(true);
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-[#27AE60]">¡Revisa tu email!</CardTitle>
            <CardDescription>
              Te enviamos un enlace de verificación. Debes verificar tu email antes
              de poder ingresar al sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate("/login")} className="mt-4">
              Ir al inicio de sesión
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
            psyque app — gestión clínica para psicólogos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input id="fullName" placeholder="Dra. María García López" {...register("fullName")} />
              {errors.fullName && <p className="text-sm text-[#E74C3C]">{errors.fullName.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email profesional</Label>
              <Input id="email" type="email" placeholder="dra.garcia@consulta.com" {...register("email")} />
              {errors.email && <p className="text-sm text-[#E74C3C]">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" placeholder="Mín. 8 caracteres, 1 mayúscula, 1 número" {...register("password")} />
              {errors.password && <p className="text-sm text-[#E74C3C]">{errors.password.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="colpsicNumber">
                Tarjeta profesional Colpsic <span className="text-[#E74C3C]">*</span>
              </Label>
              <Input id="colpsicNumber" placeholder="COL-XXXXX" {...register("colpsicNumber")} />
              {errors.colpsicNumber && <p className="text-sm text-[#E74C3C]">{errors.colpsicNumber.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="repsCode">Código REPS (opcional)</Label>
              <Input id="repsCode" placeholder="Si tienes habilitación REPS" {...register("repsCode")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">Ciudad de la consulta</Label>
              <Input id="city" placeholder="Bogotá" {...register("city")} />
              {errors.city && <p className="text-sm text-[#E74C3C]">{errors.city.message}</p>}
            </div>

            {serverError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-[#E74C3C]">{serverError}</div>
            )}

            <Button
              type="submit"
              className="w-full bg-[#2E86AB] hover:bg-[#1E3A5F]"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creando cuenta..." : "Crear cuenta gratuita"}
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
```

---

## Task 9: Frontend — App layout + sidebar + router

**Files:**
- Create: `psicogest/frontend/src/components/layout/Sidebar.tsx`
- Create: `psicogest/frontend/src/components/layout/AppLayout.tsx`
- Create: `psicogest/frontend/src/pages/DashboardPage.tsx`
- Create: `psicogest/frontend/src/App.tsx`
- Modify: `psicogest/frontend/src/main.tsx`

- [ ] **Step 1: Crear `psicogest/frontend/src/components/layout/Sidebar.tsx`**

```tsx
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: "⬛" },
  { to: "/agenda", label: "Agenda", icon: "📅" },
  { to: "/patients", label: "Pacientes", icon: "👤" },
  { to: "/sessions", label: "Sesiones activas", icon: "🩺" },
  { to: "/rips", label: "RIPS", icon: "📋" },
  { to: "/settings", label: "Configuración", icon: "⚙️" },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-[#1E3A5F] text-white flex flex-col z-40">
      <div className="p-6 border-b border-white/10">
        <h1 className="text-xl font-bold tracking-tight">psyque app</h1>
        <p className="text-xs text-white/60 mt-1">Colombia</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#2E86AB] text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )
            }
          >
            <span className="text-base" aria-hidden="true">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Crear `psicogest/frontend/src/components/layout/AppLayout.tsx`**

```tsx
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <main className="ml-60 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Crear `psicogest/frontend/src/pages/DashboardPage.tsx`**

```tsx
export function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#1E3A5F]">Dashboard</h1>
      <p className="text-muted-foreground mt-2">
        Sprint 2 implementará los indicadores del dashboard.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Crear `psicogest/frontend/src/App.tsx`**

```tsx
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { DashboardPage } from "@/pages/DashboardPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 5: Actualizar `psicogest/frontend/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
```

- [ ] **Step 6: Instalar react-router-dom si no está instalado**

```bash
cd psicogest/frontend
npm install react-router-dom
```

- [ ] **Step 7: Arrancar frontend y verificar visualmente**

```bash
cd psicogest/frontend
npm run dev
```

Verificar en http://localhost:5173:
- [ ] Redirige a `/login` sin autenticación
- [ ] Login page renderiza con campos email/contraseña y botón Google
- [ ] Register page renderiza con todos los campos del formulario
- [ ] Post-login: sidebar aparece con los 6 items de navegación
- [ ] Dashboard page muestra placeholder correcto

- [ ] **Step 8: Commit final Sprint 1**

```bash
cd psicogest
git add frontend/
git commit -m "feat(sprint-1): frontend — React + Vite + shadcn/ui, auth pages, sidebar layout"
git tag sprint-1-complete
```

---

## Verificación final Sprint 1

Antes de reportar Sprint 1 como completo, verificar todos los criterios:

- [ ] `pytest tests/test_rls_isolation.py -v` → 5 tests pasando
- [ ] `curl http://localhost:8000/api/v1/health` → `{"status": "ok", "database": "ok", ...}`
- [ ] `alembic current` → muestra `0001 (head)`
- [ ] Frontend en localhost:5173 → Login page carga sin errores de consola
- [ ] Sidebar visible tras login con 6 items de navegación
- [ ] No hay valores hardcodeados de credenciales en ningún archivo commiteado

---

## Notas técnicas tomadas del PRD

1. **RLS policy usa `current_setting('app.tenant_id', true)`** en lugar de `auth.jwt()` porque el backend es FastAPI (no Supabase Edge Functions). El segundo parámetro `true` hace que devuelva `NULL` en lugar de error si la variable no está seteada.

2. **Supabase Database URL** se agrega como variable de entorno adicional al `.env.example`. El PRD menciona `SUPABASE_URL` (URL del proyecto) pero para conexión directa PostgreSQL se necesita el DSN completo. Esto es documentado en el `.env.example`.

3. **tenant_id en JWT**: El PRD describe que el JWT lleva `tenant_id` en `app_metadata`. Esto requiere un trigger de PostgreSQL o función de Supabase Auth que setee ese claim al crear el tenant. Esa lógica se implementará en Sprint 2 junto con el endpoint de creación de tenant post-registro.
