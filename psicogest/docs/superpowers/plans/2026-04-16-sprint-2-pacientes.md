# Sprint 2 — Módulo Pacientes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el módulo completo de gestión de pacientes: CRUD, número HC autogenerado, búsqueda global Ctrl+K con debounce 300ms, listado paginado, y perfil con pestañas — cumpliendo RF-PAC-01, RF-PAC-02, RF-PAC-03 del PRD.

**Architecture:** El backend expone 6 endpoints REST en `/api/v1/patients` con RLS implícito (el `TenantDB` dependency inyecta `tenant_id` en cada sesión de DB). El frontend usa React Query para fetching con caché local, y un `CommandPalette` component para la búsqueda global. El perfil del paciente usa un sistema de tabs con React Router nested routes.

**Tech Stack:** FastAPI / SQLAlchemy 2 / Pydantic v2 / pytest (backend) — React Query (@tanstack/react-query) / React Hook Form / Zod / shadcn/ui (frontend)

---

## Contexto del codebase (Sprint 1)

Archivos relevantes ya creados:
- `backend/app/core/security.py` — `CurrentTenant`, `TenantContext` (tenant_id, user_id)
- `backend/app/core/database.py` — `get_db()`, `set_tenant_context(db, tenant_id)`
- `backend/app/models/base.py` — `Base`, `TimestampMixin`, `TenantMixin`, `UUIDPrimaryKey`
- `backend/alembic/versions/0001_initial_schema.py` — tabla `patients` ya creada con RLS
- `backend/tests/conftest.py` — fixtures `db`, `db_engine`, `two_tenants`, `_create_tenant`, `_insert_patient`
- `frontend/src/lib/supabase.ts` — cliente Supabase con sesión activa
- `frontend/src/hooks/useAuth.ts` — `useAuth()` retorna `{ user, session, loading }`

---

## File Map

```
backend/
├── app/
│   ├── core/
│   │   └── deps.py                      NEW — TenantDB dependency (tenant + DB + set_tenant_context)
│   ├── models/
│   │   └── patient.py                   NEW — Patient SQLAlchemy model
│   ├── schemas/
│   │   └── patient.py                   NEW — PatientCreate, PatientUpdate, PatientSummary, PatientDetail
│   ├── services/
│   │   ├── __init__.py                  NEW (vacío)
│   │   └── patient_service.py           NEW — CRUD, HC generation, search, pagination
│   └── api/v1/
│       └── patients.py                  NEW — 6 endpoints per PRD §7.1
│   main.py                              MODIFY — registrar patients router
├── tests/
│   └── test_patients.py                 NEW — 8 tests de negocio

frontend/
├── src/
│   ├── lib/
│   │   └── api.ts                       NEW — typed fetch wrapper con auth JWT
│   ├── hooks/
│   │   └── usePatients.ts               NEW — React Query hooks (list, detail, create, update, search)
│   ├── components/patients/
│   │   ├── PatientCard.tsx              NEW — PRD §8.4 spec exacta
│   │   ├── PatientForm.tsx              NEW — formulario completo RF-PAC-01
│   │   └── PatientSearch.tsx            NEW — Ctrl+K global search con debounce 300ms
│   └── pages/patients/
│       ├── PatientsPage.tsx             NEW — listado + filtros + paginación 20/página
│       └── PatientDetailPage.tsx        NEW — perfil con 5 pestañas
│   App.tsx                              MODIFY — agregar rutas /patients y /patients/:id
```

---

## Task 1: Backend — `deps.py` (TenantDB dependency)

Este es el patrón central que todos los endpoints usan. Combina auth + DB + RLS context en una sola dependencia.

**Files:**
- Create: `psicogest/backend/app/core/deps.py`

- [ ] **Step 1: Crear `psicogest/backend/app/core/deps.py`**

```python
"""Combined FastAPI dependencies for authenticated, tenant-scoped DB access."""
from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db, set_tenant_context
from app.core.security import CurrentTenant, TenantContext


class TenantDB:
    """Container holding both the DB session and the authenticated tenant context.

    Usage in endpoints:
        def my_endpoint(ctx: Annotated[TenantDB, Depends(get_tenant_db)]):
            ctx.db   # Session with RLS context active
            ctx.tenant  # TenantContext with tenant_id and user_id
    """

    def __init__(self, db: Session, tenant: TenantContext) -> None:
        self.db = db
        self.tenant = tenant


def get_tenant_db(
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(CurrentTenant.__class_getitem__(None)),  # type: ignore[attr-defined]
) -> TenantDB:
    """FastAPI dependency: provides DB session with RLS tenant context active.

    Sets app.tenant_id on the PostgreSQL session so all queries in this
    request are automatically filtered by the authenticated tenant's RLS policies.

    Args:
        db: SQLAlchemy session from get_db.
        tenant: Authenticated tenant extracted from JWT.

    Returns:
        TenantDB with session and tenant context.
    """
    set_tenant_context(db, tenant.tenant_id)
    return TenantDB(db=db, tenant=tenant)
```

Wait — `CurrentTenant` is an `Annotated` alias, not a class. Fix:

```python
"""Combined FastAPI dependencies for authenticated, tenant-scoped DB access."""
from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db, set_tenant_context
from app.core.security import TenantContext, get_current_tenant


class TenantDB:
    """Container holding both the DB session and the authenticated tenant context.

    Usage in endpoints:
        def my_endpoint(ctx: Annotated[TenantDB, Depends(get_tenant_db)]):
            ctx.db      # Session with RLS context active for this tenant
            ctx.tenant  # TenantContext with .tenant_id and .user_id
    """

    def __init__(self, db: Session, tenant: TenantContext) -> None:
        self.db = db
        self.tenant = tenant


def get_tenant_db(
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant),
) -> TenantDB:
    """FastAPI dependency: DB session with RLS tenant context active.

    Sets current_setting('app.tenant_id') on the PostgreSQL connection so
    all queries automatically obey RLS policies for the authenticated tenant.
    """
    set_tenant_context(db, tenant.tenant_id)
    return TenantDB(db=db, tenant=tenant)


# Shorthand annotation for use in endpoint signatures
AuthDB = Annotated[TenantDB, Depends(get_tenant_db)]
```

- [ ] **Step 2: Commit**

```bash
cd psicogest
git add backend/app/core/deps.py
git commit -m "feat(sprint-2): add TenantDB dependency combining auth + DB + RLS context"
```

---

## Task 2: Backend — Patient SQLAlchemy model

**Files:**
- Create: `psicogest/backend/app/models/patient.py`
- Modify: `psicogest/backend/app/models/__init__.py`

- [ ] **Step 1: Crear `psicogest/backend/app/models/patient.py`**

```python
"""Patient SQLAlchemy model — ficha de identificación Res. 1995/1999."""
import uuid
from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import INET, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, TenantMixin, UUIDPrimaryKey


class Patient(Base, UUIDPrimaryKey, TenantMixin, TimestampMixin):
    """Patient record. One row per patient per tenant.

    hc_number format: HC-YYYY-NNNN (auto-generated, unique per tenant).
    consent_signed_at and consent_ip are immutable after creation (Ley 1581/2012).
    """

    __tablename__ = "patients"

    hc_number: Mapped[str] = mapped_column(sa.String(20), nullable=False)
    doc_type: Mapped[str] = mapped_column(
        sa.Enum("CC", "TI", "CE", "PA", "RC", "MS", name="doc_type"),
        nullable=False,
    )
    doc_number: Mapped[str] = mapped_column(sa.String(20), nullable=False)
    first_surname: Mapped[str] = mapped_column(sa.String(100), nullable=False)
    second_surname: Mapped[str | None] = mapped_column(sa.String(100), nullable=True)
    first_name: Mapped[str] = mapped_column(sa.String(100), nullable=False)
    second_name: Mapped[str | None] = mapped_column(sa.String(100), nullable=True)
    birth_date: Mapped[date] = mapped_column(sa.Date(), nullable=False)
    biological_sex: Mapped[str] = mapped_column(
        sa.Enum("M", "F", "I", name="biological_sex"),
        nullable=False,
    )
    gender_identity: Mapped[str | None] = mapped_column(sa.String(50), nullable=True)
    marital_status: Mapped[str] = mapped_column(
        sa.Enum("S", "C", "U", "D", "V", "SE", name="marital_status"),
        nullable=False,
    )
    occupation: Mapped[str] = mapped_column(sa.String(150), nullable=False)
    address: Mapped[str] = mapped_column(sa.Text(), nullable=False)
    municipality_dane: Mapped[str] = mapped_column(sa.String(10), nullable=False)
    zone: Mapped[str] = mapped_column(
        sa.Enum("U", "R", name="zone"),
        nullable=False,
    )
    phone: Mapped[str] = mapped_column(sa.String(20), nullable=False)
    email: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    emergency_contact_name: Mapped[str | None] = mapped_column(sa.String(200), nullable=True)
    emergency_contact_phone: Mapped[str | None] = mapped_column(sa.String(20), nullable=True)
    payer_type: Mapped[str] = mapped_column(
        sa.Enum("PA", "CC", "SS", "PE", "SE", name="payer_type"),
        nullable=False,
    )
    eps_name: Mapped[str | None] = mapped_column(sa.String(200), nullable=True)
    eps_code: Mapped[str | None] = mapped_column(sa.String(10), nullable=True)
    authorization_number: Mapped[str | None] = mapped_column(sa.String(30), nullable=True)
    current_diagnosis_cie11: Mapped[str | None] = mapped_column(sa.String(20), nullable=True)
    # Consentimiento informado — inmutable tras creación (Ley 1581/2012)
    consent_signed_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False
    )
    consent_ip: Mapped[str] = mapped_column(INET(), nullable=False)
    is_active: Mapped[bool] = mapped_column(sa.Boolean(), nullable=False, default=True)

    @property
    def full_name(self) -> str:
        """Construct full name: APELLIDO1 [APELLIDO2] NOMBRE1 [NOMBRE2]."""
        parts = [self.first_surname]
        if self.second_surname:
            parts.append(self.second_surname)
        parts.append(self.first_name)
        if self.second_name:
            parts.append(self.second_name)
        return " ".join(parts)

    @property
    def age(self) -> int:
        """Calculate current age in years from birth_date."""
        from datetime import date as date_type
        today = date_type.today()
        return (
            today.year
            - self.birth_date.year
            - ((today.month, today.day) < (self.birth_date.month, self.birth_date.day))
        )
```

- [ ] **Step 2: Actualizar `psicogest/backend/app/models/__init__.py`**

```python
from app.models.patient import Patient

__all__ = ["Patient"]
```

- [ ] **Step 3: Commit**

```bash
cd psicogest
git add backend/app/models/
git commit -m "feat(sprint-2): Patient SQLAlchemy model"
```

---

## Task 3: Backend — Patient Pydantic schemas

**Files:**
- Create: `psicogest/backend/app/schemas/patient.py`

- [ ] **Step 1: Crear `psicogest/backend/app/schemas/patient.py`**

```python
"""Pydantic schemas for patient endpoints."""
import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------------------------------------------------------------------------
# Enums as Literals for strict validation
# ---------------------------------------------------------------------------
DocType = Literal["CC", "TI", "CE", "PA", "RC", "MS"]
BiologicalSex = Literal["M", "F", "I"]
MaritalStatus = Literal["S", "C", "U", "D", "V", "SE"]
Zone = Literal["U", "R"]
PayerType = Literal["PA", "CC", "SS", "PE", "SE"]


# ---------------------------------------------------------------------------
# PatientCreate — used in POST /patients
# The client IP is injected by the endpoint from the HTTP request, not the body
# ---------------------------------------------------------------------------
class PatientCreate(BaseModel):
    doc_type: DocType
    doc_number: str = Field(..., min_length=4, max_length=20)
    first_surname: str = Field(..., min_length=1, max_length=100)
    second_surname: str | None = Field(None, max_length=100)
    first_name: str = Field(..., min_length=1, max_length=100)
    second_name: str | None = Field(None, max_length=100)
    birth_date: date
    biological_sex: BiologicalSex
    gender_identity: str | None = Field(None, max_length=50)
    marital_status: MaritalStatus
    occupation: str = Field(..., min_length=1, max_length=150)
    address: str = Field(..., min_length=5)
    municipality_dane: str = Field(..., min_length=5, max_length=10)
    zone: Zone
    phone: str = Field(..., min_length=7, max_length=20)
    email: EmailStr | None = None
    emergency_contact_name: str | None = Field(None, max_length=200)
    emergency_contact_phone: str | None = Field(None, max_length=20)
    payer_type: PayerType
    eps_name: str | None = Field(None, max_length=200)
    eps_code: str | None = Field(None, max_length=10)
    authorization_number: str | None = Field(None, max_length=30)
    # Consentimiento informado explícito — checkbox en el frontend
    consent_accepted: bool = Field(..., description="Paciente aceptó el tratamiento de datos (Ley 1581/2012)")

    @field_validator("consent_accepted")
    @classmethod
    def consent_must_be_true(cls, v: bool) -> bool:
        """Consent must be explicitly accepted — cannot create patient without it."""
        if not v:
            raise ValueError(
                "El consentimiento informado es obligatorio para registrar el paciente (Ley 1581/2012)."
            )
        return v

    @field_validator("birth_date")
    @classmethod
    def birth_date_in_past(cls, v: date) -> date:
        from datetime import date as date_type
        if v >= date_type.today():
            raise ValueError("La fecha de nacimiento debe ser en el pasado.")
        return v


# ---------------------------------------------------------------------------
# PatientUpdate — used in PUT /patients/{id}
# All fields optional — only provided fields are updated
# ---------------------------------------------------------------------------
class PatientUpdate(BaseModel):
    first_surname: str | None = Field(None, min_length=1, max_length=100)
    second_surname: str | None = Field(None, max_length=100)
    first_name: str | None = Field(None, min_length=1, max_length=100)
    second_name: str | None = Field(None, max_length=100)
    gender_identity: str | None = Field(None, max_length=50)
    marital_status: MaritalStatus | None = None
    occupation: str | None = Field(None, min_length=1, max_length=150)
    address: str | None = Field(None, min_length=5)
    municipality_dane: str | None = Field(None, min_length=5, max_length=10)
    zone: Zone | None = None
    phone: str | None = Field(None, min_length=7, max_length=20)
    email: EmailStr | None = None
    emergency_contact_name: str | None = Field(None, max_length=200)
    emergency_contact_phone: str | None = Field(None, max_length=20)
    payer_type: PayerType | None = None
    eps_name: str | None = Field(None, max_length=200)
    eps_code: str | None = Field(None, max_length=10)
    authorization_number: str | None = Field(None, max_length=30)
    current_diagnosis_cie11: str | None = Field(None, max_length=20)
    is_active: bool | None = None


# ---------------------------------------------------------------------------
# PatientSummary — used in GET /patients (list) and global search
# PRD §8.4: PatientCard fields
# ---------------------------------------------------------------------------
class PatientSummary(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    hc_number: str
    first_surname: str
    second_surname: str | None
    first_name: str
    second_name: str | None
    doc_type: str
    doc_number: str
    current_diagnosis_cie11: str | None
    payer_type: str
    is_active: bool
    created_at: datetime


# ---------------------------------------------------------------------------
# PatientDetail — used in GET /patients/{id}
# Full record for profile page
# ---------------------------------------------------------------------------
class PatientDetail(PatientSummary):
    birth_date: date
    biological_sex: str
    gender_identity: str | None
    marital_status: str
    occupation: str
    address: str
    municipality_dane: str
    zone: str
    phone: str
    email: str | None
    emergency_contact_name: str | None
    emergency_contact_phone: str | None
    eps_name: str | None
    eps_code: str | None
    authorization_number: str | None
    consent_signed_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# PaginatedPatients — used in GET /patients response
# ---------------------------------------------------------------------------
class PaginatedPatients(BaseModel):
    items: list[PatientSummary]
    total: int
    page: int
    page_size: int
    pages: int
```

- [ ] **Step 2: Commit**

```bash
cd psicogest
git add backend/app/schemas/patient.py
git commit -m "feat(sprint-2): Patient Pydantic schemas"
```

---

## Task 4: Backend — Patient service (business logic + tests)

TDD: tests primero, luego implementación.

**Files:**
- Create: `psicogest/backend/app/services/__init__.py`
- Create: `psicogest/backend/app/services/patient_service.py`
- Create: `psicogest/backend/tests/test_patients.py`

- [ ] **Step 1: Escribir `psicogest/backend/tests/test_patients.py` (tests primero)**

```python
"""Tests for patient service — business logic including HC number generation."""
import uuid
from datetime import date

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.patient_service import (
    PatientService,
    DuplicateDocumentError,
    PatientNotFoundError,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _tenant(db: Session) -> str:
    """Create a tenant and return its UUID string."""
    auth_id = str(uuid.uuid4())
    result = db.execute(
        text("""
            INSERT INTO tenants (auth_user_id, full_name, colpsic_number, plan,
                                 plan_expires_at, city)
            VALUES (:auth_id, 'Test Psicólogo', 'TEST-001', 'starter',
                    NOW() + INTERVAL '30 days', 'Bogotá')
            RETURNING id
        """),
        {"auth_id": auth_id},
    )
    tenant_id = str(result.mappings().one()["id"])
    db.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": tenant_id})
    return tenant_id


PATIENT_DATA = {
    "doc_type": "CC",
    "doc_number": "12345678",
    "first_surname": "García",
    "second_surname": "López",
    "first_name": "Ana",
    "second_name": None,
    "birth_date": date(1990, 6, 15),
    "biological_sex": "F",
    "gender_identity": None,
    "marital_status": "S",
    "occupation": "Profesora",
    "address": "Calle 1 # 2-3, Bogotá",
    "municipality_dane": "11001",
    "zone": "U",
    "phone": "3001234567",
    "email": "ana.garcia@test.com",
    "emergency_contact_name": None,
    "emergency_contact_phone": None,
    "payer_type": "PA",
    "eps_name": None,
    "eps_code": None,
    "authorization_number": None,
    "consent_accepted": True,
}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
def test_create_patient_generates_hc_number(db: Session) -> None:
    """First patient for a tenant gets HC-YYYY-0001."""
    from datetime import date as date_type
    tenant_id = _tenant(db)
    service = PatientService(db, tenant_id)

    patient = service.create(PATIENT_DATA, client_ip="127.0.0.1")

    year = date_type.today().year
    assert patient.hc_number == f"HC-{year}-0001"


def test_second_patient_gets_sequential_hc(db: Session) -> None:
    """Second patient for the same tenant gets HC-YYYY-0002."""
    from datetime import date as date_type
    tenant_id = _tenant(db)
    service = PatientService(db, tenant_id)

    service.create(PATIENT_DATA, client_ip="127.0.0.1")
    second_data = {**PATIENT_DATA, "doc_number": "99999999"}
    patient2 = service.create(second_data, client_ip="127.0.0.1")

    year = date_type.today().year
    assert patient2.hc_number == f"HC-{year}-0002"


def test_duplicate_doc_number_raises_error(db: Session) -> None:
    """Creating two patients with the same doc_number raises DuplicateDocumentError."""
    tenant_id = _tenant(db)
    service = PatientService(db, tenant_id)

    service.create(PATIENT_DATA, client_ip="127.0.0.1")

    with pytest.raises(DuplicateDocumentError):
        service.create(PATIENT_DATA, client_ip="127.0.0.1")


def test_consent_ip_stored_immutably(db: Session) -> None:
    """consent_ip and consent_signed_at are stored from creation, never null."""
    tenant_id = _tenant(db)
    service = PatientService(db, tenant_id)

    patient = service.create(PATIENT_DATA, client_ip="192.168.1.1")

    assert str(patient.consent_ip) == "192.168.1.1"
    assert patient.consent_signed_at is not None


def test_get_existing_patient(db: Session) -> None:
    """get_by_id returns the patient when it exists for the tenant."""
    tenant_id = _tenant(db)
    service = PatientService(db, tenant_id)

    created = service.create(PATIENT_DATA, client_ip="127.0.0.1")
    fetched = service.get_by_id(str(created.id))

    assert fetched.id == created.id
    assert fetched.first_name == "Ana"


def test_get_nonexistent_patient_raises_not_found(db: Session) -> None:
    """get_by_id raises PatientNotFoundError for an unknown UUID."""
    tenant_id = _tenant(db)
    service = PatientService(db, tenant_id)

    with pytest.raises(PatientNotFoundError):
        service.get_by_id(str(uuid.uuid4()))


def test_search_by_surname(db: Session) -> None:
    """search() returns patients whose first_surname starts with the query."""
    tenant_id = _tenant(db)
    service = PatientService(db, tenant_id)

    service.create(PATIENT_DATA, client_ip="127.0.0.1")
    other = {**PATIENT_DATA, "doc_number": "00000001", "first_surname": "Martínez", "first_name": "Carlos"}
    service.create(other, client_ip="127.0.0.1")

    results = service.search("gar")
    assert len(results) == 1
    assert results[0].first_surname == "García"


def test_list_paginated(db: Session) -> None:
    """list() returns paginated results with correct total count."""
    tenant_id = _tenant(db)
    service = PatientService(db, tenant_id)

    for i in range(5):
        service.create({**PATIENT_DATA, "doc_number": f"1000000{i}"}, client_ip="127.0.0.1")

    page1 = service.list(page=1, page_size=3)
    assert len(page1.items) == 3
    assert page1.total == 5
    assert page1.pages == 2


def test_update_patient(db: Session) -> None:
    """update() modifies only provided fields."""
    tenant_id = _tenant(db)
    service = PatientService(db, tenant_id)

    patient = service.create(PATIENT_DATA, client_ip="127.0.0.1")
    updated = service.update(str(patient.id), {"phone": "3009999999"})

    assert updated.phone == "3009999999"
    assert updated.first_name == "Ana"  # unchanged
```

- [ ] **Step 2: Correr tests para verificar que fallan**

```bash
cd psicogest/backend
pytest tests/test_patients.py -v 2>&1 | head -20
```

Salida esperada: `ImportError: cannot import name 'PatientService'`

- [ ] **Step 3: Crear `psicogest/backend/app/services/__init__.py`**

```python
```
(vacío)

- [ ] **Step 4: Crear `psicogest/backend/app/services/patient_service.py`**

```python
"""Patient business logic: CRUD, HC number generation, search, pagination."""
from __future__ import annotations

import math
from datetime import date, datetime, timezone

from sqlalchemy import func, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.patient import Patient
from app.schemas.patient import (
    PaginatedPatients,
    PatientDetail,
    PatientSummary,
)


# ---------------------------------------------------------------------------
# Domain exceptions
# ---------------------------------------------------------------------------
class PatientNotFoundError(Exception):
    """Raised when a patient UUID doesn't exist for the current tenant."""
    pass


class DuplicateDocumentError(Exception):
    """Raised when doc_type + doc_number already exists for the current tenant."""
    pass


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------
class PatientService:
    """All patient operations for a single authenticated tenant.

    Args:
        db: SQLAlchemy session with tenant context already set via set_tenant_context().
        tenant_id: UUID string of the authenticated tenant.
    """

    def __init__(self, db: Session, tenant_id: str) -> None:
        self.db = db
        self.tenant_id = tenant_id

    # ------------------------------------------------------------------
    # HC Number generation — HC-YYYY-NNNN, sequential per tenant per year
    # ------------------------------------------------------------------
    def _next_hc_number(self) -> str:
        """Generate the next HC number for this tenant in the current year.

        Uses MAX on the numeric suffix to avoid collisions. Safe within a
        single transaction because INSERT is atomic and RLS prevents other
        tenants from affecting the count.

        Returns:
            HC number string in format HC-YYYY-NNNN.
        """
        year = date.today().year
        prefix = f"HC-{year}-"

        result = self.db.execute(
            text("""
                SELECT COALESCE(
                    MAX(CAST(SPLIT_PART(hc_number, '-', 3) AS INTEGER)),
                    0
                ) + 1 AS next_num
                FROM patients
                WHERE tenant_id = :tid
                  AND hc_number LIKE :prefix
            """),
            {"tid": self.tenant_id, "prefix": f"{prefix}%"},
        ).scalar()

        return f"{prefix}{result:04d}"

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------
    def create(self, data: dict, *, client_ip: str) -> Patient:
        """Create a new patient record.

        Args:
            data: Dict matching PatientCreate fields (consent_accepted already validated).
            client_ip: Client IP address from HTTP request (stored for Ley 1581/2012).

        Returns:
            Newly created Patient ORM instance.

        Raises:
            DuplicateDocumentError: If doc_type + doc_number already exists for tenant.
        """
        # Check for duplicate doc_number within tenant
        existing = self.db.execute(
            text("""
                SELECT id FROM patients
                WHERE tenant_id = :tid
                  AND doc_type = :doc_type
                  AND doc_number = :doc_number
            """),
            {
                "tid": self.tenant_id,
                "doc_type": data["doc_type"],
                "doc_number": data["doc_number"],
            },
        ).fetchone()

        if existing:
            raise DuplicateDocumentError(
                f"Ya existe un paciente con {data['doc_type']} {data['doc_number']}."
            )

        hc_number = self._next_hc_number()
        patient = Patient(
            tenant_id=self.tenant_id,
            hc_number=hc_number,
            doc_type=data["doc_type"],
            doc_number=data["doc_number"],
            first_surname=data["first_surname"],
            second_surname=data.get("second_surname"),
            first_name=data["first_name"],
            second_name=data.get("second_name"),
            birth_date=data["birth_date"],
            biological_sex=data["biological_sex"],
            gender_identity=data.get("gender_identity"),
            marital_status=data["marital_status"],
            occupation=data["occupation"],
            address=data["address"],
            municipality_dane=data["municipality_dane"],
            zone=data["zone"],
            phone=data["phone"],
            email=data.get("email"),
            emergency_contact_name=data.get("emergency_contact_name"),
            emergency_contact_phone=data.get("emergency_contact_phone"),
            payer_type=data["payer_type"],
            eps_name=data.get("eps_name"),
            eps_code=data.get("eps_code"),
            authorization_number=data.get("authorization_number"),
            consent_signed_at=datetime.now(tz=timezone.utc),
            consent_ip=client_ip,
        )
        self.db.add(patient)
        self.db.flush()  # Get the generated UUID without committing
        self.db.refresh(patient)
        return patient

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------
    def get_by_id(self, patient_id: str) -> Patient:
        """Fetch a single patient by UUID.

        RLS ensures only this tenant's patients are visible — a different
        tenant's patient UUID returns NotFound, never Forbidden.

        Args:
            patient_id: UUID string.

        Returns:
            Patient ORM instance.

        Raises:
            PatientNotFoundError: If not found (including cross-tenant access attempts).
        """
        result = self.db.execute(
            text("SELECT * FROM patients WHERE id = :pid"),
            {"pid": patient_id},
        ).mappings().fetchone()

        if not result:
            raise PatientNotFoundError(f"Paciente {patient_id} no encontrado.")

        # Reconstruct ORM object for property access
        patient = self.db.get(Patient, patient_id)
        if not patient:
            raise PatientNotFoundError(f"Paciente {patient_id} no encontrado.")
        return patient

    def list(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        active_only: bool | None = None,
        has_eps: bool | None = None,
    ) -> PaginatedPatients:
        """Return paginated patient list for the current tenant.

        Args:
            page: 1-based page number.
            page_size: Results per page (max 100).
            active_only: If True, only active patients; if False, only inactive; None = all.
            has_eps: If True, only patients with EPS; if False, only without; None = all.

        Returns:
            PaginatedPatients with items, total, page, page_size, pages.
        """
        page_size = min(page_size, 100)
        offset = (page - 1) * page_size

        conditions = ["tenant_id = :tid"]
        params: dict = {"tid": self.tenant_id}

        if active_only is True:
            conditions.append("is_active = true")
        elif active_only is False:
            conditions.append("is_active = false")

        if has_eps is True:
            conditions.append("eps_code IS NOT NULL")
        elif has_eps is False:
            conditions.append("eps_code IS NULL")

        where = " AND ".join(conditions)

        total = self.db.execute(
            text(f"SELECT COUNT(*) FROM patients WHERE {where}"),
            params,
        ).scalar() or 0

        rows = self.db.execute(
            text(f"""
                SELECT * FROM patients
                WHERE {where}
                ORDER BY first_surname, first_name
                LIMIT :limit OFFSET :offset
            """),
            {**params, "limit": page_size, "offset": offset},
        ).mappings().fetchall()

        items = [PatientSummary.model_validate(dict(r)) for r in rows]
        return PaginatedPatients(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            pages=math.ceil(total / page_size) if total > 0 else 1,
        )

    def search(self, query: str, *, limit: int = 10) -> list[PatientSummary]:
        """Full-text search on name, surname, and document number.

        Args:
            query: Search string (case-insensitive prefix match).
            limit: Maximum number of results.

        Returns:
            List of PatientSummary ordered by relevance (surname, name).
        """
        q = f"%{query.lower()}%"
        rows = self.db.execute(
            text("""
                SELECT * FROM patients
                WHERE tenant_id = :tid
                  AND (
                      LOWER(first_surname) LIKE :q
                   OR LOWER(second_surname) LIKE :q
                   OR LOWER(first_name) LIKE :q
                   OR LOWER(doc_number) LIKE :q
                  )
                ORDER BY first_surname, first_name
                LIMIT :limit
            """),
            {"tid": self.tenant_id, "q": q, "limit": limit},
        ).mappings().fetchall()
        return [PatientSummary.model_validate(dict(r)) for r in rows]

    # ------------------------------------------------------------------
    # Update
    # ------------------------------------------------------------------
    def update(self, patient_id: str, data: dict) -> Patient:
        """Partial update of a patient record.

        Only fields present in data (non-None) are updated. doc_type,
        doc_number, birth_date, consent_*, and hc_number cannot be changed
        after creation.

        Args:
            patient_id: UUID string.
            data: Dict of fields to update (from PatientUpdate schema).

        Returns:
            Updated Patient ORM instance.

        Raises:
            PatientNotFoundError: If patient doesn't exist for this tenant.
        """
        # Immutable fields — never allow update
        immutable = {
            "doc_type", "doc_number", "birth_date",
            "consent_signed_at", "consent_ip", "hc_number", "tenant_id",
        }
        update_data = {k: v for k, v in data.items() if v is not None and k not in immutable}

        if not update_data:
            return self.get_by_id(patient_id)

        set_clause = ", ".join(f"{k} = :{k}" for k in update_data)
        result = self.db.execute(
            text(f"""
                UPDATE patients
                SET {set_clause}
                WHERE id = :pid AND tenant_id = :tid
                RETURNING id
            """),
            {**update_data, "pid": patient_id, "tid": self.tenant_id},
        ).fetchone()

        if not result:
            raise PatientNotFoundError(f"Paciente {patient_id} no encontrado.")

        self.db.expire_all()
        return self.get_by_id(patient_id)
```

- [ ] **Step 5: Correr los tests**

```bash
cd psicogest/backend
pytest tests/test_patients.py -v
```

Salida esperada:
```
tests/test_patients.py::test_create_patient_generates_hc_number PASSED
tests/test_patients.py::test_second_patient_gets_sequential_hc PASSED
tests/test_patients.py::test_duplicate_doc_number_raises_error PASSED
tests/test_patients.py::test_consent_ip_stored_immutably PASSED
tests/test_patients.py::test_get_existing_patient PASSED
tests/test_patients.py::test_get_nonexistent_patient_raises_not_found PASSED
tests/test_patients.py::test_search_by_surname PASSED
tests/test_patients.py::test_list_paginated PASSED
tests/test_patients.py::test_update_patient PASSED

9 passed in X.XXs
```

- [ ] **Step 6: Commit**

```bash
cd psicogest
git add backend/app/services/ backend/tests/test_patients.py
git commit -m "feat(sprint-2): PatientService with TDD — HC generation, CRUD, search, pagination — 9 tests passing"
```

---

## Task 5: Backend — Patients API router

**Files:**
- Create: `psicogest/backend/app/api/v1/patients.py`
- Modify: `psicogest/backend/app/main.py`

- [ ] **Step 1: Crear `psicogest/backend/app/api/v1/patients.py`**

```python
"""Patients router — RF-PAC-01, RF-PAC-02, RF-PAC-03 from PRD §7.1."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.core.deps import AuthDB, get_tenant_db, TenantDB
from app.schemas.patient import (
    PaginatedPatients,
    PatientCreate,
    PatientDetail,
    PatientSummary,
    PatientUpdate,
)
from app.services.patient_service import (
    DuplicateDocumentError,
    PatientNotFoundError,
    PatientService,
)

router = APIRouter(prefix="/patients", tags=["patients"])


def _service(ctx: TenantDB) -> PatientService:
    """Create PatientService from TenantDB context."""
    return PatientService(ctx.db, ctx.tenant.tenant_id)


@router.get("", response_model=PaginatedPatients)
def list_patients(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    active: bool | None = Query(None, description="Filter by active status"),
    has_eps: bool | None = Query(None, description="Filter patients with EPS"),
    search: str | None = Query(None, description="Search by name or document"),
) -> PaginatedPatients:
    """List patients with pagination and optional filters.

    Returns:
        Paginated list of PatientSummary. If search is provided, returns
        matching patients regardless of pagination params.
    """
    svc = _service(ctx)
    if search and search.strip():
        items = svc.search(search.strip(), limit=page_size)
        return PaginatedPatients(
            items=items,
            total=len(items),
            page=1,
            page_size=page_size,
            pages=1,
        )
    return svc.list(page=page, page_size=page_size, active_only=active, has_eps=has_eps)


@router.post("", response_model=PatientDetail, status_code=status.HTTP_201_CREATED)
def create_patient(
    body: PatientCreate,
    request: Request,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> PatientDetail:
    """Register a new patient.

    The client IP is extracted from the HTTP request and stored immutably
    for Ley 1581/2012 compliance (Habeas Data).

    Returns:
        PatientDetail of the created patient.

    Raises:
        422: If consent_accepted is False or required fields missing.
        409: If doc_type + doc_number already exists for this tenant.
    """
    client_ip = request.client.host if request.client else "unknown"
    try:
        patient = _service(ctx).create(body.model_dump(), client_ip=client_ip)
        ctx.db.commit()
        ctx.db.refresh(patient)
        return PatientDetail.model_validate(patient)
    except DuplicateDocumentError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.get("/{patient_id}", response_model=PatientDetail)
def get_patient(
    patient_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> PatientDetail:
    """Get full patient detail by UUID.

    Returns:
        PatientDetail.

    Raises:
        404: If patient not found (or belongs to another tenant — perfect isolation).
    """
    try:
        patient = _service(ctx).get_by_id(patient_id)
        return PatientDetail.model_validate(patient)
    except PatientNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado.")


@router.put("/{patient_id}", response_model=PatientDetail)
def update_patient(
    patient_id: str,
    body: PatientUpdate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> PatientDetail:
    """Partial update of a patient record.

    Immutable fields (doc_type, doc_number, birth_date, consent_*, hc_number)
    are silently ignored even if provided.

    Returns:
        Updated PatientDetail.

    Raises:
        404: If patient not found.
    """
    try:
        patient = _service(ctx).update(patient_id, body.model_dump(exclude_none=True))
        ctx.db.commit()
        ctx.db.refresh(patient)
        return PatientDetail.model_validate(patient)
    except PatientNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado.")


@router.get("/{patient_id}/sessions", response_model=list[dict])
def get_patient_sessions(
    patient_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    page: int = Query(1, ge=1),
) -> list[dict]:
    """List clinical sessions for a patient.

    Sessions module (Sprint 5) will replace this stub with full SessionSummary.
    """
    # Verify patient belongs to this tenant
    try:
        _service(ctx).get_by_id(patient_id)
    except PatientNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado.")
    # Sprint 5 will populate this
    return []


@router.get("/{patient_id}/appointments", response_model=list[dict])
def get_patient_appointments(
    patient_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> list[dict]:
    """List appointments for a patient.

    Appointments module (Sprint 3) will replace this stub.
    """
    try:
        _service(ctx).get_by_id(patient_id)
    except PatientNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado.")
    return []
```

- [ ] **Step 2: Modificar `psicogest/backend/app/main.py` para registrar el router**

Reemplazar el contenido completo:

```python
"""FastAPI application factory for psyque app backend."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.health import router as health_router
from app.api.v1.patients import router as patients_router
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
    allow_origins=[
        settings.app_url,
        "http://localhost:3000",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api/v1")
app.include_router(patients_router, prefix="/api/v1")
```

- [ ] **Step 3: Verificar que el servidor arranca y los endpoints aparecen**

```bash
cd psicogest/backend
uvicorn app.main:app --reload --port 8000
```

Abrir http://localhost:8000/docs — deben aparecer:
- `GET /api/v1/patients`
- `POST /api/v1/patients`
- `GET /api/v1/patients/{patient_id}`
- `PUT /api/v1/patients/{patient_id}`
- `GET /api/v1/patients/{patient_id}/sessions`
- `GET /api/v1/patients/{patient_id}/appointments`

- [ ] **Step 4: Correr todos los tests del backend**

```bash
pytest tests/ -v
```

Salida esperada: 14 tests pasando (5 RLS + 9 patients)

- [ ] **Step 5: Commit**

```bash
cd psicogest
git add backend/app/api/v1/patients.py backend/app/main.py backend/app/core/deps.py
git commit -m "feat(sprint-2): patients router — 6 endpoints, POST creates with HC number and consent IP"
```

---

## Task 6: Frontend — API client + React Query setup

**Files:**
- Create: `psicogest/frontend/src/lib/api.ts`
- Modify: `psicogest/frontend/src/main.tsx`

- [ ] **Step 1: Instalar React Query**

```bash
cd psicogest/frontend
npm install @tanstack/react-query
```

- [ ] **Step 2: Crear `psicogest/frontend/src/lib/api.ts`**

```typescript
/**
 * Typed API client for psyque app backend.
 * Automatically attaches the Supabase JWT to every request.
 */
import { supabase } from "./supabase";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("No autenticado");
  return { Authorization: `Bearer ${token}` };
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, err.detail ?? "Error desconocido");
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Typed API surface
// ---------------------------------------------------------------------------
export interface PatientSummary {
  id: string;
  hc_number: string;
  first_surname: string;
  second_surname: string | null;
  first_name: string;
  second_name: string | null;
  doc_type: string;
  doc_number: string;
  current_diagnosis_cie11: string | null;
  payer_type: string;
  is_active: boolean;
  created_at: string;
}

export interface PatientDetail extends PatientSummary {
  birth_date: string;
  biological_sex: string;
  gender_identity: string | null;
  marital_status: string;
  occupation: string;
  address: string;
  municipality_dane: string;
  zone: string;
  phone: string;
  email: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  eps_name: string | null;
  eps_code: string | null;
  authorization_number: string | null;
  consent_signed_at: string;
  updated_at: string;
}

export interface PaginatedPatients {
  items: PatientSummary[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface PatientCreatePayload {
  doc_type: string;
  doc_number: string;
  first_surname: string;
  second_surname?: string;
  first_name: string;
  second_name?: string;
  birth_date: string;
  biological_sex: string;
  gender_identity?: string;
  marital_status: string;
  occupation: string;
  address: string;
  municipality_dane: string;
  zone: string;
  phone: string;
  email?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  payer_type: string;
  eps_name?: string;
  eps_code?: string;
  authorization_number?: string;
  consent_accepted: boolean;
}

export const api = {
  patients: {
    list: (params?: {
      page?: number;
      page_size?: number;
      active?: boolean;
      has_eps?: boolean;
      search?: string;
    }) => {
      const q = new URLSearchParams();
      if (params?.page) q.set("page", String(params.page));
      if (params?.page_size) q.set("page_size", String(params.page_size));
      if (params?.active !== undefined) q.set("active", String(params.active));
      if (params?.has_eps !== undefined) q.set("has_eps", String(params.has_eps));
      if (params?.search) q.set("search", params.search);
      return request<PaginatedPatients>("GET", `/patients?${q}`);
    },
    create: (body: PatientCreatePayload) =>
      request<PatientDetail>("POST", "/patients", body),
    get: (id: string) =>
      request<PatientDetail>("GET", `/patients/${id}`),
    update: (id: string, body: Partial<PatientCreatePayload>) =>
      request<PatientDetail>("PUT", `/patients/${id}`, body),
  },
};
```

- [ ] **Step 3: Actualizar `psicogest/frontend/.env.example`**

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=http://localhost:8000/api/v1
```

- [ ] **Step 4: Actualizar `psicogest/frontend/src/main.tsx` para agregar QueryClientProvider**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
```

- [ ] **Step 5: Commit**

```bash
cd psicogest
git add frontend/src/lib/api.ts frontend/src/main.tsx frontend/.env.example
git commit -m "feat(sprint-2): API client + React Query setup"
```

---

## Task 7: Frontend — PatientCard component (PRD §8.4)

**Files:**
- Create: `psicogest/frontend/src/components/patients/PatientCard.tsx`

- [ ] **Step 1: Crear `psicogest/frontend/src/components/patients/PatientCard.tsx`**

```tsx
/**
 * PatientCard — PRD §8.4 spec
 * Used in patient list and global search results.
 */
import type { PatientSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

const PAYER_LABELS: Record<string, string> = {
  PA: "Particular",
  CC: "Contributivo",
  SS: "Subsidiado",
  PE: "Especial",
  SE: "Excepción",
};

interface PatientCardProps {
  patient: PatientSummary;
  onClick?: () => void;
  className?: string;
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const letters = parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="h-10 w-10 rounded-full bg-[#2E86AB] text-white flex items-center justify-center text-sm font-semibold shrink-0">
      {letters}
    </div>
  );
}

export function PatientCard({ patient, onClick, className }: PatientCardProps) {
  const fullName = [
    patient.first_surname,
    patient.second_surname,
    patient.first_name,
    patient.second_name,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-lg border bg-white hover:bg-slate-50 transition-colors text-left",
        !patient.is_active && "opacity-60",
        className
      )}
    >
      <Initials name={fullName} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[#1E3A5F] truncate">{fullName}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {patient.current_diagnosis_cie11 && (
            <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono">
              {patient.current_diagnosis_cie11}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {PAYER_LABELS[patient.payer_type] ?? patient.payer_type}
          </span>
          {!patient.is_active && (
            <span className="text-xs text-[#E74C3C]">Inactivo</span>
          )}
        </div>
      </div>
      <span className="text-xs text-muted-foreground shrink-0 font-mono">
        {patient.hc_number}
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd psicogest
git add frontend/src/components/patients/PatientCard.tsx
git commit -m "feat(sprint-2): PatientCard component — PRD §8.4 spec"
```

---

## Task 8: Frontend — PatientForm (create/edit)

**Files:**
- Create: `psicogest/frontend/src/components/patients/PatientForm.tsx`

- [ ] **Step 1: Crear `psicogest/frontend/src/components/patients/PatientForm.tsx`**

```tsx
/**
 * PatientForm — RF-PAC-01 complete patient registration form.
 * Used for both create and edit. In edit mode, immutable fields are readonly.
 */
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PatientCreatePayload, PatientDetail } from "@/lib/api";

// ---------------------------------------------------------------------------
// Validation schema — mirrors backend PatientCreate
// ---------------------------------------------------------------------------
const patientSchema = z.object({
  doc_type: z.enum(["CC", "TI", "CE", "PA", "RC", "MS"]),
  doc_number: z.string().min(4, "Mínimo 4 dígitos").max(20),
  first_surname: z.string().min(1, "Requerido").max(100),
  second_surname: z.string().max(100).optional(),
  first_name: z.string().min(1, "Requerido").max(100),
  second_name: z.string().max(100).optional(),
  birth_date: z.string().min(1, "Requerido"),
  biological_sex: z.enum(["M", "F", "I"]),
  gender_identity: z.string().max(50).optional(),
  marital_status: z.enum(["S", "C", "U", "D", "V", "SE"]),
  occupation: z.string().min(1, "Requerido").max(150),
  address: z.string().min(5, "Dirección completa requerida"),
  municipality_dane: z.string().min(5, "Código DANE requerido").max(10),
  zone: z.enum(["U", "R"]),
  phone: z.string().min(7, "Teléfono inválido").max(20),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  emergency_contact_name: z.string().max(200).optional(),
  emergency_contact_phone: z.string().max(20).optional(),
  payer_type: z.enum(["PA", "CC", "SS", "PE", "SE"]),
  eps_name: z.string().max(200).optional(),
  eps_code: z.string().max(10).optional(),
  authorization_number: z.string().max(30).optional(),
  consent_accepted: z.literal(true, {
    errorMap: () => ({ message: "Debe aceptar el consentimiento informado (Ley 1581/2012)" }),
  }),
});

type PatientFormData = z.infer<typeof patientSchema>;

interface PatientFormProps {
  onSubmit: (data: PatientCreatePayload) => Promise<void>;
  defaultValues?: Partial<PatientDetail>;
  isEdit?: boolean;
  isSubmitting?: boolean;
}

function Field({
  label,
  error,
  children,
  required,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label>
        {label}
        {required && <span className="text-[#E74C3C] ml-0.5">*</span>}
      </Label>
      {children}
      {error && (
        <p className="text-xs text-[#E74C3C]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Select({
  options,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[];
}) {
  return (
    <select
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      {...props}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function PatientForm({
  onSubmit,
  defaultValues,
  isEdit = false,
  isSubmitting = false,
}: PatientFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      doc_type: (defaultValues?.doc_type as PatientFormData["doc_type"]) ?? "CC",
      doc_number: defaultValues?.doc_number ?? "",
      first_surname: defaultValues?.first_surname ?? "",
      second_surname: defaultValues?.second_surname ?? "",
      first_name: defaultValues?.first_name ?? "",
      second_name: defaultValues?.second_name ?? "",
      birth_date: defaultValues?.birth_date ?? "",
      biological_sex: (defaultValues?.biological_sex as PatientFormData["biological_sex"]) ?? "F",
      gender_identity: defaultValues?.gender_identity ?? "",
      marital_status: (defaultValues?.marital_status as PatientFormData["marital_status"]) ?? "S",
      occupation: defaultValues?.occupation ?? "",
      address: defaultValues?.address ?? "",
      municipality_dane: defaultValues?.municipality_dane ?? "",
      zone: (defaultValues?.zone as PatientFormData["zone"]) ?? "U",
      phone: defaultValues?.phone ?? "",
      email: defaultValues?.email ?? "",
      emergency_contact_name: defaultValues?.emergency_contact_name ?? "",
      emergency_contact_phone: defaultValues?.emergency_contact_phone ?? "",
      payer_type: (defaultValues?.payer_type as PatientFormData["payer_type"]) ?? "PA",
      eps_name: defaultValues?.eps_name ?? "",
      eps_code: defaultValues?.eps_code ?? "",
      authorization_number: defaultValues?.authorization_number ?? "",
    },
  });

  const payerType = watch("payer_type");

  const handleFormSubmit = async (data: PatientFormData) => {
    await onSubmit({
      ...data,
      second_surname: data.second_surname || undefined,
      second_name: data.second_name || undefined,
      email: data.email || undefined,
      gender_identity: data.gender_identity || undefined,
      emergency_contact_name: data.emergency_contact_name || undefined,
      emergency_contact_phone: data.emergency_contact_phone || undefined,
      eps_name: data.eps_name || undefined,
      eps_code: data.eps_code || undefined,
      authorization_number: data.authorization_number || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6" noValidate>
      {/* Identificación */}
      <section>
        <h3 className="text-sm font-semibold text-[#1E3A5F] uppercase tracking-wide mb-3">
          Identificación
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tipo de documento" error={errors.doc_type?.message} required>
            <Select
              {...register("doc_type")}
              disabled={isEdit}
              options={[
                { value: "CC", label: "Cédula de Ciudadanía" },
                { value: "TI", label: "Tarjeta de Identidad" },
                { value: "CE", label: "Cédula de Extranjería" },
                { value: "PA", label: "Pasaporte" },
                { value: "RC", label: "Registro Civil" },
                { value: "MS", label: "Menor sin identificación" },
              ]}
            />
          </Field>
          <Field label="Número de documento" error={errors.doc_number?.message} required>
            <Input
              {...register("doc_number")}
              disabled={isEdit}
              placeholder="12345678"
            />
          </Field>
        </div>
      </section>

      {/* Nombres y apellidos */}
      <section>
        <h3 className="text-sm font-semibold text-[#1E3A5F] uppercase tracking-wide mb-3">
          Nombre completo
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Primer apellido" error={errors.first_surname?.message} required>
            <Input {...register("first_surname")} placeholder="García" />
          </Field>
          <Field label="Segundo apellido" error={errors.second_surname?.message}>
            <Input {...register("second_surname")} placeholder="López" />
          </Field>
          <Field label="Primer nombre" error={errors.first_name?.message} required>
            <Input {...register("first_name")} placeholder="Ana" />
          </Field>
          <Field label="Segundo nombre" error={errors.second_name?.message}>
            <Input {...register("second_name")} placeholder="María" />
          </Field>
        </div>
      </section>

      {/* Datos demográficos */}
      <section>
        <h3 className="text-sm font-semibold text-[#1E3A5F] uppercase tracking-wide mb-3">
          Datos personales
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Fecha de nacimiento" error={errors.birth_date?.message} required>
            <Input type="date" {...register("birth_date")} disabled={isEdit} />
          </Field>
          <Field label="Sexo biológico (RIPS)" error={errors.biological_sex?.message} required>
            <Select
              {...register("biological_sex")}
              disabled={isEdit}
              options={[
                { value: "F", label: "Femenino" },
                { value: "M", label: "Masculino" },
                { value: "I", label: "Indeterminado" },
              ]}
            />
          </Field>
          <Field label="Género de identidad" error={errors.gender_identity?.message}>
            <Input {...register("gender_identity")} placeholder="Opcional" />
          </Field>
          <Field label="Estado civil" error={errors.marital_status?.message} required>
            <Select
              {...register("marital_status")}
              options={[
                { value: "S", label: "Soltero/a" },
                { value: "C", label: "Casado/a" },
                { value: "U", label: "Unión libre" },
                { value: "D", label: "Divorciado/a" },
                { value: "V", label: "Viudo/a" },
                { value: "SE", label: "Separado/a" },
              ]}
            />
          </Field>
          <Field label="Ocupación" error={errors.occupation?.message} required>
            <Input {...register("occupation")} placeholder="Profesora, Ingeniero..." />
          </Field>
        </div>
      </section>

      {/* Ubicación y contacto */}
      <section>
        <h3 className="text-sm font-semibold text-[#1E3A5F] uppercase tracking-wide mb-3">
          Contacto y ubicación
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Dirección completa" error={errors.address?.message} required>
            <Input {...register("address")} placeholder="Calle 1 # 2-3, Bogotá" className="col-span-2" />
          </Field>
          <Field label="Código DANE del municipio" error={errors.municipality_dane?.message} required>
            <Input {...register("municipality_dane")} placeholder="11001 (Bogotá)" />
          </Field>
          <Field label="Zona" error={errors.zone?.message} required>
            <Select
              {...register("zone")}
              options={[
                { value: "U", label: "Urbana" },
                { value: "R", label: "Rural" },
              ]}
            />
          </Field>
          <Field label="Teléfono" error={errors.phone?.message} required>
            <Input {...register("phone")} placeholder="3001234567" type="tel" />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <Input {...register("email")} placeholder="paciente@email.com" type="email" />
          </Field>
          <Field label="Contacto de emergencia" error={errors.emergency_contact_name?.message}>
            <Input {...register("emergency_contact_name")} placeholder="Nombre" />
          </Field>
          <Field label="Teléfono emergencia" error={errors.emergency_contact_phone?.message}>
            <Input {...register("emergency_contact_phone")} placeholder="3009999999" />
          </Field>
        </div>
      </section>

      {/* Vinculación / RIPS */}
      <section>
        <h3 className="text-sm font-semibold text-[#1E3A5F] uppercase tracking-wide mb-3">
          Vinculación (RIPS)
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tipo de vinculación" error={errors.payer_type?.message} required>
            <Select
              {...register("payer_type")}
              options={[
                { value: "PA", label: "Particular" },
                { value: "CC", label: "Contributivo (EPS)" },
                { value: "SS", label: "Subsidiado (EPS)" },
                { value: "PE", label: "Especial" },
                { value: "SE", label: "Excepción" },
              ]}
            />
          </Field>
          {(payerType === "CC" || payerType === "SS") && (
            <>
              <Field label="Nombre de la EPS" error={errors.eps_name?.message}>
                <Input {...register("eps_name")} placeholder="Sura, Compensar..." />
              </Field>
              <Field label="Código EPS (DANE)" error={errors.eps_code?.message}>
                <Input {...register("eps_code")} placeholder="EPS001" />
              </Field>
              <Field label="Número de autorización" error={errors.authorization_number?.message}>
                <Input {...register("authorization_number")} placeholder="Si aplica" />
              </Field>
            </>
          )}
        </div>
      </section>

      {/* Consentimiento informado — solo en creación */}
      {!isEdit && (
        <section className="rounded-lg border border-[#E67E22] bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-[#E67E22] mb-2">
            Consentimiento informado — Ley 1581/2012
          </h3>
          <p className="text-xs text-slate-600 mb-3">
            El paciente autoriza el tratamiento de sus datos personales de salud para fines
            exclusivamente clínicos y administrativos. Esta autorización quedará registrada
            con fecha, hora e IP del dispositivo de forma permanente.
          </p>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              {...register("consent_accepted")}
            />
            <span className="text-sm">
              El paciente ha leído y acepta el tratamiento de sus datos personales de salud
            </span>
          </label>
          {errors.consent_accepted && (
            <p className="text-xs text-[#E74C3C] mt-1" role="alert">
              {errors.consent_accepted.message}
            </p>
          )}
        </section>
      )}

      <Button
        type="submit"
        className="w-full bg-[#2E86AB] hover:bg-[#1E3A5F]"
        disabled={isSubmitting}
      >
        {isSubmitting
          ? isEdit ? "Guardando..." : "Registrando paciente..."
          : isEdit ? "Guardar cambios" : "Registrar paciente"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd psicogest
git add frontend/src/components/patients/PatientForm.tsx
git commit -m "feat(sprint-2): PatientForm — RF-PAC-01 complete form with consent checkbox"
```

---

## Task 9: Frontend — PatientsPage (list + pagination + filters)

**Files:**
- Create: `psicogest/frontend/src/hooks/usePatients.ts`
- Create: `psicogest/frontend/src/pages/patients/PatientsPage.tsx`

- [ ] **Step 1: Crear `psicogest/frontend/src/hooks/usePatients.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type PatientCreatePayload } from "@/lib/api";

export function usePatients(params?: {
  page?: number;
  active?: boolean;
  has_eps?: boolean;
  search?: string;
}) {
  return useQuery({
    queryKey: ["patients", params],
    queryFn: () => api.patients.list(params),
  });
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: ["patient", id],
    queryFn: () => api.patients.get(id),
    enabled: !!id,
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PatientCreatePayload) => api.patients.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patients"] }),
  });
}

export function useUpdatePatient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PatientCreatePayload>) => api.patients.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["patient", id] });
    },
  });
}
```

- [ ] **Step 2: Crear `psicogest/frontend/src/pages/patients/PatientsPage.tsx`**

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePatients, useCreatePatient } from "@/hooks/usePatients";
import { PatientCard } from "@/components/patients/PatientCard";
import { PatientForm } from "@/components/patients/PatientForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PatientCreatePayload } from "@/lib/api";
import { ApiError } from "@/lib/api";

const PAGE_SIZE = 20;

export function PatientsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined);
  const [filterEps, setFilterEps] = useState<boolean | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isError } = usePatients({
    page,
    page_size: PAGE_SIZE,
    search: search.length >= 2 ? search : undefined,
    active: filterActive,
    has_eps: filterEps,
  });

  const createMutation = useCreatePatient();

  const handleCreate = async (payload: PatientCreatePayload) => {
    setFormError(null);
    try {
      const patient = await createMutation.mutateAsync(payload);
      setShowForm(false);
      navigate(`/patients/${patient.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError(err.message);
      } else {
        setFormError("Error al registrar el paciente. Intenta de nuevo.");
      }
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Pacientes</h1>
          {data && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {data.total} paciente{data.total !== 1 ? "s" : ""} registrado{data.total !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <Button
          className="bg-[#2E86AB] hover:bg-[#1E3A5F]"
          onClick={() => { setShowForm(true); setFormError(null); }}
        >
          + Nuevo paciente
        </Button>
      </div>

      {/* New patient form (inline modal) */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-[#1E3A5F]">Registrar nuevo paciente</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            {formError && (
              <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-[#E74C3C]" role="alert">
                {formError}
              </div>
            )}
            <PatientForm
              onSubmit={handleCreate}
              isSubmitting={createMutation.isPending}
            />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <Input
          placeholder="Buscar por nombre, apellido o documento..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
        <select
          className="h-10 rounded-md border border-input px-3 text-sm"
          value={filterActive === undefined ? "" : String(filterActive)}
          onChange={(e) => {
            setFilterActive(e.target.value === "" ? undefined : e.target.value === "true");
            setPage(1);
          }}
        >
          <option value="">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
        <select
          className="h-10 rounded-md border border-input px-3 text-sm"
          value={filterEps === undefined ? "" : String(filterEps)}
          onChange={(e) => {
            setFilterEps(e.target.value === "" ? undefined : e.target.value === "true");
            setPage(1);
          }}
        >
          <option value="">Con y sin EPS</option>
          <option value="true">Con EPS</option>
          <option value="false">Sin EPS</option>
        </select>
      </div>

      {/* Patient list */}
      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">Cargando pacientes...</div>
      )}
      {isError && (
        <div className="text-center py-12 text-[#E74C3C]">
          Error al cargar pacientes. Verifica tu conexión.
        </div>
      )}
      {data && data.items.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {search ? "No se encontraron pacientes con esa búsqueda." : "Aún no tienes pacientes registrados."}
        </div>
      )}
      {data && data.items.length > 0 && (
        <>
          <div className="space-y-2">
            {data.items.map((patient) => (
              <PatientCard
                key={patient.id}
                patient={patient}
                onClick={() => navigate(`/patients/${patient.id}`)}
              />
            ))}
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-muted-foreground">
                Página {data.page} de {data.pages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ← Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente →
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd psicogest
git add frontend/src/hooks/usePatients.ts frontend/src/pages/patients/PatientsPage.tsx
git commit -m "feat(sprint-2): PatientsPage — list, pagination, filters, new patient modal"
```

---

## Task 10: Frontend — PatientDetailPage (5 tabs)

**Files:**
- Create: `psicogest/frontend/src/pages/patients/PatientDetailPage.tsx`

- [ ] **Step 1: Crear `psicogest/frontend/src/pages/patients/PatientDetailPage.tsx`**

```tsx
/**
 * Patient profile page — RF-PAC-03
 * 5 tabs: Información general, Historia clínica, Sesiones, Documentos, RIPS
 */
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePatient, useUpdatePatient } from "@/hooks/usePatients";
import { PatientForm } from "@/components/patients/PatientForm";
import { Button } from "@/components/ui/button";
import type { PatientCreatePayload } from "@/lib/api";

type Tab = "info" | "historia" | "sesiones" | "documentos" | "rips";

const TABS: { id: Tab; label: string }[] = [
  { id: "info", label: "Información general" },
  { id: "historia", label: "Historia clínica" },
  { id: "sesiones", label: "Sesiones" },
  { id: "documentos", label: "Documentos" },
  { id: "rips", label: "RIPS" },
];

const DOC_TYPE_LABELS: Record<string, string> = {
  CC: "Cédula de Ciudadanía", TI: "Tarjeta de Identidad",
  CE: "Cédula de Extranjería", PA: "Pasaporte",
  RC: "Registro Civil", MS: "Menor sin identificación",
};
const SEX_LABELS: Record<string, string> = { M: "Masculino", F: "Femenino", I: "Indeterminado" };
const MARITAL_LABELS: Record<string, string> = {
  S: "Soltero/a", C: "Casado/a", U: "Unión libre",
  D: "Divorciado/a", V: "Viudo/a", SE: "Separado/a",
};
const ZONE_LABELS: Record<string, string> = { U: "Urbana", R: "Rural" };
const PAYER_LABELS: Record<string, string> = {
  PA: "Particular", CC: "Contributivo", SS: "Subsidiado", PE: "Especial", SE: "Excepción",
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="py-2 border-b last:border-0">
      <dt className="text-xs text-muted-foreground uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [isEditing, setIsEditing] = useState(false);

  const { data: patient, isLoading, isError } = usePatient(id ?? "");
  const updateMutation = useUpdatePatient(id ?? "");

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Cargando paciente...</div>;
  }
  if (isError || !patient) {
    return (
      <div className="p-8">
        <p className="text-[#E74C3C]">Paciente no encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/patients")}>
          ← Volver a pacientes
        </Button>
      </div>
    );
  }

  const fullName = [patient.first_surname, patient.second_surname, patient.first_name, patient.second_name]
    .filter(Boolean).join(" ");

  const handleUpdate = async (data: PatientCreatePayload) => {
    await updateMutation.mutateAsync(data);
    setIsEditing(false);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/patients")}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            ← Pacientes
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#1E3A5F]">{fullName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                {patient.hc_number}
              </span>
              {patient.current_diagnosis_cie11 && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono">
                  {patient.current_diagnosis_cie11}
                </span>
              )}
              {!patient.is_active && (
                <span className="text-xs bg-red-50 text-[#E74C3C] px-2 py-0.5 rounded">
                  Inactivo
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? "Cancelar edición" : "Editar"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6">
        <nav className="flex gap-1 -mb-px" aria-label="Pestañas del perfil">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id); setIsEditing(false); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-[#2E86AB] text-[#2E86AB]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "info" && (
        isEditing ? (
          <div className="max-w-2xl">
            <PatientForm
              onSubmit={handleUpdate}
              defaultValues={patient}
              isEdit
              isSubmitting={updateMutation.isPending}
            />
          </div>
        ) : (
          <div className="max-w-xl">
            <dl className="divide-y">
              <InfoRow label="Documento" value={`${DOC_TYPE_LABELS[patient.doc_type] ?? patient.doc_type} ${patient.doc_number}`} />
              <InfoRow label="Fecha de nacimiento" value={`${patient.birth_date} (${calcAge(patient.birth_date)} años)`} />
              <InfoRow label="Sexo biológico" value={SEX_LABELS[patient.biological_sex] ?? patient.biological_sex} />
              <InfoRow label="Género de identidad" value={patient.gender_identity} />
              <InfoRow label="Estado civil" value={MARITAL_LABELS[patient.marital_status] ?? patient.marital_status} />
              <InfoRow label="Ocupación" value={patient.occupation} />
              <InfoRow label="Dirección" value={patient.address} />
              <InfoRow label="Municipio (DANE)" value={patient.municipality_dane} />
              <InfoRow label="Zona" value={ZONE_LABELS[patient.zone] ?? patient.zone} />
              <InfoRow label="Teléfono" value={patient.phone} />
              <InfoRow label="Email" value={patient.email} />
              <InfoRow label="Contacto de emergencia" value={patient.emergency_contact_name} />
              <InfoRow label="Teléfono emergencia" value={patient.emergency_contact_phone} />
              <InfoRow label="Vinculación" value={PAYER_LABELS[patient.payer_type] ?? patient.payer_type} />
              <InfoRow label="EPS" value={patient.eps_name} />
              <InfoRow label="Consentimiento" value={`Firmado el ${new Date(patient.consent_signed_at).toLocaleString("es-CO")}`} />
            </dl>
          </div>
        )
      )}

      {activeTab === "historia" && (
        <div className="max-w-xl">
          <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-800">
            El módulo de Historia Clínica se implementará en Sprint 5 (Panel de Sesión).
            Las notas firmadas aparecerán aquí en orden cronológico inverso.
          </div>
        </div>
      )}

      {activeTab === "sesiones" && (
        <div className="max-w-xl">
          <div className="rounded-lg border bg-slate-50 p-4 text-sm text-muted-foreground">
            El historial de sesiones estará disponible en Sprint 5.
          </div>
        </div>
      )}

      {activeTab === "documentos" && (
        <div className="max-w-xl">
          <div className="rounded-lg border bg-slate-50 p-4 text-sm text-muted-foreground">
            Documentos clínicos (consentimientos PDF, adjuntos) — Sprint 7.
          </div>
        </div>
      )}

      {activeTab === "rips" && (
        <div className="max-w-xl">
          <div className="rounded-lg border bg-slate-50 p-4 text-sm text-muted-foreground">
            Historial de RIPS generados para este paciente — Sprint 6.
          </div>
        </div>
      )}
    </div>
  );
}

function calcAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) {
    age--;
  }
  return age;
}
```

- [ ] **Step 2: Commit**

```bash
cd psicogest
git add frontend/src/pages/patients/PatientDetailPage.tsx
git commit -m "feat(sprint-2): PatientDetailPage — 5 tabs, info display + edit form — RF-PAC-03"
```

---

## Task 11: Frontend — Global search Ctrl+K (RF-PAC-02)

**Files:**
- Create: `psicogest/frontend/src/components/patients/PatientSearch.tsx`
- Modify: `psicogest/frontend/src/components/layout/AppLayout.tsx`

- [ ] **Step 1: Crear `psicogest/frontend/src/components/patients/PatientSearch.tsx`**

```tsx
/**
 * Global patient search — RF-PAC-02
 * Triggered with Ctrl+K / Cmd+K from anywhere in the app.
 * Debounced 300ms per PRD spec.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PatientCard } from "./PatientCard";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

interface PatientSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PatientSearch({ isOpen, onClose }: PatientSearchProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  const { data, isFetching } = useQuery({
    queryKey: ["patient-search", debouncedQuery],
    queryFn: () => api.patients.list({ search: debouncedQuery, page_size: 8 }),
    enabled: debouncedQuery.length >= 2,
  });

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSelect = useCallback(
    (patientId: string) => {
      navigate(`/patients/${patientId}`);
      onClose();
    },
    [navigate, onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Búsqueda global de pacientes"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <span className="text-muted-foreground">🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar paciente por nombre, apellido o documento..."
            className="flex-1 outline-none text-sm bg-transparent"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {isFetching && (
            <span className="text-xs text-muted-foreground">Buscando...</span>
          )}
          <kbd className="text-xs bg-slate-100 px-1.5 py-0.5 rounded border text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {debouncedQuery.length < 2 && (
            <p className="text-center text-sm text-muted-foreground py-6">
              Escribe al menos 2 caracteres para buscar
            </p>
          )}
          {debouncedQuery.length >= 2 && data?.items.length === 0 && !isFetching && (
            <p className="text-center text-sm text-muted-foreground py-6">
              No se encontraron pacientes con "{debouncedQuery}"
            </p>
          )}
          {data?.items.map((patient) => (
            <PatientCard
              key={patient.id}
              patient={patient}
              onClick={() => handleSelect(patient.id)}
              className="mb-1"
            />
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t bg-slate-50 text-xs text-muted-foreground">
          ↵ para abrir · ESC para cerrar
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Modificar `psicogest/frontend/src/components/layout/AppLayout.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { PatientSearch } from "@/components/patients/PatientSearch";

export function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false);

  // Ctrl+K / Cmd+K opens global search — RF-PAC-02
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const closeSearch = useCallback(() => setSearchOpen(false), []);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar onSearchClick={() => setSearchOpen(true)} />
      <main className="ml-60 min-h-screen p-0">
        <Outlet />
      </main>
      <PatientSearch isOpen={searchOpen} onClose={closeSearch} />
    </div>
  );
}
```

- [ ] **Step 3: Modificar `psicogest/frontend/src/components/layout/Sidebar.tsx`** para añadir el botón de búsqueda

Reemplazar el archivo:

```tsx
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

interface NavItem { to: string; label: string; icon: string; }

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: "📊" },
  { to: "/agenda", label: "Agenda", icon: "📅" },
  { to: "/patients", label: "Pacientes", icon: "👤" },
  { to: "/sessions", label: "Sesiones activas", icon: "🩺" },
  { to: "/rips", label: "RIPS", icon: "📋" },
  { to: "/settings", label: "Configuración", icon: "⚙️" },
];

interface SidebarProps { onSearchClick?: () => void; }

export function Sidebar({ onSearchClick }: SidebarProps) {
  return (
    <aside
      className="fixed left-0 top-0 h-full w-60 bg-[#1E3A5F] text-white flex flex-col z-40"
      aria-label="Navegación principal"
    >
      <div className="p-6 border-b border-white/10">
        <h1 className="text-xl font-bold tracking-tight">psyque app</h1>
        <p className="text-xs text-white/50 mt-0.5">Colombia</p>
      </div>

      {/* Búsqueda global — Ctrl+K */}
      <div className="px-4 pt-4">
        <button
          type="button"
          onClick={onSearchClick}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white/60 text-sm hover:bg-white/15 transition-colors"
        >
          <span>🔍</span>
          <span className="flex-1 text-left">Buscar paciente...</span>
          <kbd className="text-xs bg-white/10 px-1.5 py-0.5 rounded">⌘K</kbd>
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1 pt-3" aria-label="Menú principal">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#2E86AB] text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )
            }
          >
            <span className="text-base w-5 text-center" aria-hidden="true">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <p className="text-xs text-white/40 text-center">v1.0.0 — Sprint 2</p>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd psicogest
git add frontend/src/components/patients/ frontend/src/components/layout/
git commit -m "feat(sprint-2): global search Ctrl+K — PatientSearch with 300ms debounce — RF-PAC-02"
```

---

## Task 12: Wire up routes + mkdir

**Files:**
- Create: `psicogest/frontend/src/pages/patients/` (directory)
- Modify: `psicogest/frontend/src/App.tsx`

- [ ] **Step 1: Agregar rutas de pacientes en `App.tsx`**

Reemplazar el contenido completo:

```tsx
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PatientsPage } from "@/pages/patients/PatientsPage";
import { PatientDetailPage } from "@/pages/patients/PatientDetailPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-[#1E3A5F] text-sm">Cargando...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/patients/:id" element={<PatientDetailPage />} />
        <Route path="/agenda" element={<div className="p-8"><h1 className="text-2xl font-bold text-[#1E3A5F]">Agenda</h1><p className="text-muted-foreground mt-2">Sprint 3</p></div>} />
        <Route path="/sessions" element={<div className="p-8"><h1 className="text-2xl font-bold text-[#1E3A5F]">Sesiones activas</h1><p className="text-muted-foreground mt-2">Sprint 5</p></div>} />
        <Route path="/rips" element={<div className="p-8"><h1 className="text-2xl font-bold text-[#1E3A5F]">RIPS</h1><p className="text-muted-foreground mt-2">Sprint 6</p></div>} />
        <Route path="/settings" element={<div className="p-8"><h1 className="text-2xl font-bold text-[#1E3A5F]">Configuración</h1><p className="text-muted-foreground mt-2">Sprint 7</p></div>} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 2: Correr frontend y verificar golden path**

```bash
cd psicogest/frontend
npm run dev
```

Verificar manualmente:
- [ ] `/patients` carga la lista (vacía inicialmente)
- [ ] Click "+ Nuevo paciente" abre el formulario modal
- [ ] Registrar un paciente → redirige a `/patients/{id}`
- [ ] Perfil del paciente muestra 5 pestañas
- [ ] Ctrl+K abre el buscador
- [ ] Escribir 2+ caracteres en buscador muestra resultados
- [ ] Click en resultado navega al perfil

- [ ] **Step 3: Commit final Sprint 2**

```bash
cd psicogest
git add frontend/src/App.tsx
git commit -m "feat(sprint-2): wire patient routes /patients and /patients/:id"
git tag sprint-2-complete
```

---

## Self-Review

### 1. Spec coverage

| Requerimiento PRD | Tarea |
|---|---|
| RF-PAC-01: formulario con todos los campos obligatorios | Task 8 PatientForm |
| RF-PAC-01: tipo documento con validación | Task 3 Pydantic + Task 8 Zod |
| RF-PAC-01: HC-YYYY-NNNN autogenerado | Task 4 PatientService._next_hc_number |
| RF-PAC-01: consentimiento con IP y timestamp | Task 5 endpoint (Request.client.host) + Task 8 form |
| RF-PAC-02: búsqueda Ctrl+K | Task 11 PatientSearch |
| RF-PAC-02: debounce 300ms | Task 11 useDebounce hook |
| RF-PAC-02: paginación 20 por página | Task 9 PatientsPage PAGE_SIZE=20 |
| RF-PAC-02: filtros activos/inactivos, con/sin EPS | Task 9 + Task 5 list endpoint |
| RF-PAC-03: perfil con 5 pestañas | Task 10 PatientDetailPage |
| RF-PAC-03: notas cerradas con candado | Sprint 5 (pendiente — stub en tab Historia) |
| PRD §7.1 endpoints GET/POST/PUT/GET sessions/GET appointments | Task 5 router |

### 2. Placeholder scan

Ningún placeholder encontrado. Las pestañas "Historia clínica", "Sesiones", "Documentos", "RIPS" tienen stubs claros que indican el sprint en que se implementarán.

### 3. Type consistency

- `PatientSummary` definido en `api.ts` y usado en `PatientCard`, `PatientSearch`, `usePatients`
- `PatientDetail` extendido de `PatientSummary` en ambos `api.ts` y `schemas/patient.py`
- `PatientCreatePayload` usado en `PatientForm.onSubmit`, `useCreatePatient`, y `api.patients.create`
- `PatientService` métodos: `create(data, client_ip)`, `get_by_id(id)`, `list(...)`, `search(query)`, `update(id, data)` — consistentes entre tests y implementación
