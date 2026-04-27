# Bloque 7 — QR / Magic Link de Agendamiento: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que el psicólogo comparta un enlace/QR público para que sus pacientes soliciten citas directamente, con confirmación/rechazo desde la agenda.

**Architecture:** El backend expone rutas públicas (sin JWT) bajo `/api/v1/public/booking/{slug}` para consultar slots y crear solicitudes. Las solicitudes se guardan en una tabla `booking_requests` separada de `appointments` (sin RLS). Rutas autenticadas en `/api/v1/booking-requests` permiten confirmar o rechazar. El frontend añade una página pública `/book/:slug` sin `AppLayout`, un tab "Agendamiento" en Settings, y muestra las solicitudes pendientes como eventos en la agenda.

**Tech Stack:** FastAPI sin auth dependency para rutas públicas, SQLAlchemy directo a `SessionLocal`, `react-qr-code` (npm), Resend para email de notificación al psicólogo.

---

## Archivos a tocar

| Archivo | Acción | Responsabilidad |
|---------|--------|----------------|
| `psicogest/backend/alembic/versions/0021_add_booking_to_tenants.py` | Crear | Columnas `booking_slug`, `booking_enabled`, `booking_welcome_message` en `tenants` |
| `psicogest/backend/alembic/versions/0022_create_booking_requests.py` | Crear | Tabla `booking_requests` |
| `psicogest/backend/app/models/tenant.py` | Modificar | Agregar 3 nuevos campos |
| `psicogest/backend/app/models/booking_request.py` | Crear | Modelo `BookingRequest` |
| `psicogest/backend/app/models/__init__.py` | Modificar | Registrar `BookingRequest` |
| `psicogest/backend/app/schemas/booking.py` | Crear | Schemas Pydantic para booking |
| `psicogest/backend/app/schemas/profile.py` | Modificar | Agregar campos booking a `TenantProfileRead/Update` |
| `psicogest/backend/app/services/profile_service.py` | Modificar | Ampliar `allowed` + auto-generate slug |
| `psicogest/backend/app/services/booking_service.py` | Crear | Slot generation, create/confirm/reject |
| `psicogest/backend/app/services/email_service.py` | Modificar | Agregar `send_booking_notification` |
| `psicogest/backend/app/api/v1/booking.py` | Crear | Router público (no auth) |
| `psicogest/backend/app/api/v1/booking_requests.py` | Crear | Router autenticado (confirm/reject/list) |
| `psicogest/backend/app/main.py` | Modificar | Registrar ambos routers |
| `psicogest/frontend/src/lib/api.ts` | Modificar | `publicRequest` helper, booking types, `api.booking.*`, `api.bookingRequests.*` |
| `psicogest/frontend/src/hooks/useBooking.ts` | Crear | `useBookingInfo`, `useBookingRequests`, `useConfirmRequest`, `useRejectRequest` |
| `psicogest/frontend/src/pages/booking/BookingPage.tsx` | Crear | Página pública `/book/:slug` |
| `psicogest/frontend/src/components/settings/BookingSettings.tsx` | Crear | Tab "Agendamiento" en Settings |
| `psicogest/frontend/src/pages/settings/SettingsPage.tsx` | Modificar | Agregar tab "Agendamiento" |
| `psicogest/frontend/src/pages/agenda/AgendaPage.tsx` | Modificar | Mostrar booking requests como eventos |
| `psicogest/frontend/src/App.tsx` | Modificar | Agregar ruta pública `/book/:slug` |

**No hay cambios al modelo `Appointment` ni al enum `appointment_status`.**

---

## Task 1 — Migrations

**Files:**
- Create: `psicogest/backend/alembic/versions/0021_add_booking_to_tenants.py`
- Create: `psicogest/backend/alembic/versions/0022_create_booking_requests.py`

- [ ] **Paso 1: Crear `0021_add_booking_to_tenants.py`**

```python
"""Add booking fields to tenants.

Revision ID: 0021
Revises: 0020
Create Date: 2026-04-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("booking_slug", sa.String(50), nullable=True))
    op.add_column("tenants", sa.Column("booking_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("tenants", sa.Column("booking_welcome_message", sa.Text(), nullable=True))
    op.create_index("ix_tenants_booking_slug", "tenants", ["booking_slug"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_tenants_booking_slug", table_name="tenants")
    op.drop_column("tenants", "booking_welcome_message")
    op.drop_column("tenants", "booking_enabled")
    op.drop_column("tenants", "booking_slug")
```

- [ ] **Paso 2: Crear `0022_create_booking_requests.py`**

```python
"""Create booking_requests table.

Revision ID: 0022
Revises: 0021
Create Date: 2026-04-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "booking_requests",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("patient_name", sa.String(200), nullable=False),
        sa.Column("patient_email", sa.String(200), nullable=False),
        sa.Column("patient_phone", sa.String(20), nullable=True),
        sa.Column("session_type", sa.String(20), nullable=False, server_default="individual"),
        sa.Column("requested_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("requested_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("pending", "confirmed", "rejected", name="booking_request_status"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_booking_requests_tenant_id", "booking_requests", ["tenant_id"])
    op.create_index("ix_booking_requests_status", "booking_requests", ["status"])


def downgrade() -> None:
    op.drop_index("ix_booking_requests_status", table_name="booking_requests")
    op.drop_index("ix_booking_requests_tenant_id", table_name="booking_requests")
    op.drop_table("booking_requests")
    op.execute("DROP TYPE IF EXISTS booking_request_status")
```

- [ ] **Paso 3: Correr las migraciones**

```bash
cd psicogest/backend && alembic upgrade head
```

Resultado esperado: `Running upgrade 0020 -> 0021, Running upgrade 0021 -> 0022`

- [ ] **Paso 4: Commit**

```bash
git add psicogest/backend/alembic/versions/0021_add_booking_to_tenants.py \
        psicogest/backend/alembic/versions/0022_create_booking_requests.py
git commit -m "feat: add booking fields to tenants and booking_requests table"
```

---

## Task 2 — Backend: modelos + perfil

**Files:**
- Modify: `psicogest/backend/app/models/tenant.py`
- Create: `psicogest/backend/app/models/booking_request.py`
- Modify: `psicogest/backend/app/models/__init__.py`
- Modify: `psicogest/backend/app/schemas/profile.py`
- Modify: `psicogest/backend/app/services/profile_service.py`

- [ ] **Paso 1: Agregar campos booking al modelo `Tenant`**

En `psicogest/backend/app/models/tenant.py`, añadir al final de la clase `Tenant`, después de `dian_resolution_date`:

```python
    # --- Agendamiento público ---
    booking_slug: Mapped[str | None] = mapped_column(sa.String(50), nullable=True, unique=True)
    booking_enabled: Mapped[bool] = mapped_column(
        sa.Boolean(), nullable=False, server_default=sa.text("false")
    )
    booking_welcome_message: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
```

- [ ] **Paso 2: Crear `booking_request.py`**

Crear `psicogest/backend/app/models/booking_request.py`:

```python
"""BookingRequest model — solicitudes de cita desde el enlace público."""
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import DateTime, func

from app.models.base import Base, UUIDPrimaryKey


class BookingRequest(Base, UUIDPrimaryKey):
    """Public booking request created by a patient via the booking link.

    Not RLS-protected — filtered by tenant_id in service queries.
    """

    __tablename__ = "booking_requests"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    patient_name: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    patient_email: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    patient_phone: Mapped[str | None] = mapped_column(sa.String(20), nullable=True)
    session_type: Mapped[str] = mapped_column(sa.String(20), nullable=False, server_default="individual")
    requested_start: Mapped[datetime] = mapped_column(sa.TIMESTAMP(timezone=True), nullable=False)
    requested_end: Mapped[datetime] = mapped_column(sa.TIMESTAMP(timezone=True), nullable=False)
    notes: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    status: Mapped[str] = mapped_column(
        sa.Enum("pending", "confirmed", "rejected", name="booking_request_status"),
        nullable=False,
        server_default=sa.text("'pending'"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
```

- [ ] **Paso 3: Registrar `BookingRequest` en `models/__init__.py`**

Agregar al final del `__init__.py`:

```python
from app.models.booking_request import BookingRequest

__all__ = [
    "Base",
    "Patient",
    "Appointment",
    "Session",
    "SessionNote",
    "AvailabilityBlock",
    "ClinicalDocument",
    "Invoice",
    "CashSession",
    "CashTransaction",
    "ClinicalRecord",
    "TherapyIndicator",
    "TherapyMeasurement",
    "Referral",
    "BookingRequest",
]
```

- [ ] **Paso 4: Actualizar `schemas/profile.py` — agregar campos booking**

Reemplazar el contenido de `psicogest/backend/app/schemas/profile.py` con:

```python
"""Pydantic schemas for tenant profile."""
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class TenantProfileRead(BaseModel):
    id: uuid.UUID
    full_name: str
    colpsic_number: str
    reps_code: str | None
    nit: str | None
    city: str
    session_duration_min: int
    plan: Literal["starter", "pro", "clinic"]
    plan_expires_at: datetime
    booking_enabled: bool
    booking_slug: str | None
    booking_welcome_message: str | None

    model_config = {"from_attributes": True}


class TenantProfileUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=200)
    colpsic_number: str | None = Field(None, max_length=20)
    reps_code: str | None = Field(None, max_length=30)
    nit: str | None = Field(None, max_length=15)
    city: str | None = Field(None, max_length=100)
    session_duration_min: int | None = Field(None, ge=30, le=120)
    booking_enabled: bool | None = None
    booking_welcome_message: str | None = Field(None, max_length=500)
```

- [ ] **Paso 5: Actualizar `profile_service.py` — ampliar `allowed` y auto-generar slug**

Reemplazar el contenido de `psicogest/backend/app/services/profile_service.py` con:

```python
"""Profile service — tenant profile management."""
import secrets
import string
import uuid

from sqlalchemy.orm import Session as DBSession

from app.models.tenant import Tenant


def _generate_booking_slug() -> str:
    """Generate a random 10-char alphanumeric slug, URL-safe."""
    alphabet = string.ascii_lowercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(10))


class ProfileService:
    def __init__(self, db: DBSession, tenant_id: str) -> None:
        self.db = db
        self._tenant_id = uuid.UUID(tenant_id)

    def get_profile(self) -> Tenant:
        tenant = self.db.get(Tenant, self._tenant_id)
        if not tenant:
            raise ValueError("Perfil no encontrado")
        return tenant

    def update_profile(self, data: dict) -> Tenant:
        tenant = self.get_profile()
        allowed = {
            "full_name",
            "colpsic_number",
            "reps_code",
            "nit",
            "city",
            "session_duration_min",
            "booking_enabled",
            "booking_welcome_message",
        }
        for field, value in data.items():
            if field in allowed and value is not None:
                setattr(tenant, field, value)

        if tenant.booking_enabled and not tenant.booking_slug:
            tenant.booking_slug = _generate_booking_slug()

        self.db.commit()
        self.db.refresh(tenant)
        return tenant
```

- [ ] **Paso 6: Commit**

```bash
git add psicogest/backend/app/models/tenant.py \
        psicogest/backend/app/models/booking_request.py \
        psicogest/backend/app/models/__init__.py \
        psicogest/backend/app/schemas/profile.py \
        psicogest/backend/app/services/profile_service.py
git commit -m "feat: add booking model, update tenant model and profile schema"
```

---

## Task 3 — Backend: schemas, BookingService, email

**Files:**
- Create: `psicogest/backend/app/schemas/booking.py`
- Create: `psicogest/backend/app/services/booking_service.py`
- Modify: `psicogest/backend/app/services/email_service.py`

- [ ] **Paso 1: Crear `schemas/booking.py`**

```python
"""Pydantic schemas for public booking endpoints."""
from datetime import datetime

from pydantic import BaseModel, Field


class BookingInfo(BaseModel):
    """Public booking page info — returned without auth."""
    tenant_name: str
    welcome_message: str
    session_duration_min: int
    slots: list[str]  # ISO8601 datetimes in Bogotá TZ (e.g. "2026-05-01T09:00:00-05:00")


class BookingRequestCreate(BaseModel):
    patient_name: str = Field(..., min_length=2, max_length=200)
    patient_email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    patient_phone: str | None = Field(None, max_length=20)
    session_type: str = Field("individual", pattern="^(individual|couple|family|followup)$")
    requested_start: datetime
    notes: str | None = Field(None, max_length=500)


class BookingRequestCreated(BaseModel):
    id: str
    status: str


class BookingRequestSummary(BaseModel):
    id: str
    patient_name: str
    patient_email: str
    patient_phone: str | None
    session_type: str
    requested_start: datetime
    requested_end: datetime
    status: str
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Paso 2: Crear `services/booking_service.py`**

```python
"""BookingService — slot generation and booking request management."""
import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.availability import AvailabilityBlock
from app.models.booking_request import BookingRequest
from app.models.tenant import Tenant

BOGOTA_TZ = ZoneInfo("America/Bogota")


class BookingNotFoundError(Exception):
    pass


class BookingService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_tenant_by_slug(self, slug: str) -> Tenant:
        tenant = (
            self.db.query(Tenant)
            .filter(Tenant.booking_slug == slug, Tenant.booking_enabled.is_(True))
            .first()
        )
        if not tenant:
            raise BookingNotFoundError(slug)
        return tenant

    def get_available_slots(self, tenant: Tenant, days_ahead: int = 14) -> list[str]:
        """Return ISO8601 datetimes (Bogotá TZ) of free booking slots."""
        tenant_uuid = tenant.id

        blocks = (
            self.db.query(AvailabilityBlock)
            .filter(
                AvailabilityBlock.tenant_id == tenant_uuid,
                AvailabilityBlock.is_active.is_(True),
            )
            .all()
        )
        if not blocks:
            return []

        now_utc = datetime.now(tz=timezone.utc)
        future_cutoff = now_utc + timedelta(days=days_ahead + 1)

        existing_appts = (
            self.db.query(Appointment)
            .filter(
                Appointment.tenant_id == tenant_uuid,
                Appointment.status == "scheduled",
                Appointment.scheduled_start >= now_utc,
                Appointment.scheduled_start < future_cutoff,
            )
            .all()
        )

        pending_requests = (
            self.db.query(BookingRequest)
            .filter(
                BookingRequest.tenant_id == tenant_uuid,
                BookingRequest.status == "pending",
                BookingRequest.requested_start >= now_utc,
            )
            .all()
        )

        session_min = tenant.session_duration_min
        today = datetime.now(tz=BOGOTA_TZ).date()

        slots: list[str] = []
        for delta in range(1, days_ahead + 1):
            day = today + timedelta(days=delta)
            weekday = day.weekday()  # Monday=0, Sunday=6

            for block in blocks:
                if block.day_of_week != weekday:
                    continue

                slot_dt = datetime.combine(day, block.start_time).replace(tzinfo=BOGOTA_TZ)
                block_end_dt = datetime.combine(day, block.end_time).replace(tzinfo=BOGOTA_TZ)

                while slot_dt + timedelta(minutes=session_min) <= block_end_dt:
                    slot_end = slot_dt + timedelta(minutes=session_min)
                    slot_utc = slot_dt.astimezone(timezone.utc)
                    slot_end_utc = slot_end.astimezone(timezone.utc)

                    busy = any(
                        a.scheduled_start < slot_end_utc and a.scheduled_end > slot_utc
                        for a in existing_appts
                    ) or any(
                        r.requested_start < slot_end_utc and r.requested_end > slot_utc
                        for r in pending_requests
                    )

                    if not busy:
                        slots.append(slot_dt.isoformat())

                    slot_dt += timedelta(minutes=session_min)

        return slots

    def create_request(
        self,
        *,
        tenant: Tenant,
        patient_name: str,
        patient_email: str,
        patient_phone: str | None,
        session_type: str,
        requested_start: datetime,
        notes: str | None,
    ) -> BookingRequest:
        session_min = tenant.session_duration_min
        requested_end = requested_start + timedelta(minutes=session_min)

        req = BookingRequest(
            tenant_id=tenant.id,
            patient_name=patient_name,
            patient_email=patient_email,
            patient_phone=patient_phone,
            session_type=session_type,
            requested_start=requested_start,
            requested_end=requested_end,
            notes=notes,
        )
        self.db.add(req)
        self.db.commit()
        self.db.refresh(req)
        return req

    def list_by_tenant(
        self, tenant_id: uuid.UUID, status: str | None = None
    ) -> list[BookingRequest]:
        q = self.db.query(BookingRequest).filter(BookingRequest.tenant_id == tenant_id)
        if status:
            q = q.filter(BookingRequest.status == status)
        return q.order_by(BookingRequest.requested_start).all()

    def confirm(self, request_id: uuid.UUID, tenant_id: uuid.UUID) -> BookingRequest:
        req = self._get(request_id, tenant_id)
        req.status = "confirmed"
        self.db.commit()
        self.db.refresh(req)
        return req

    def reject(self, request_id: uuid.UUID, tenant_id: uuid.UUID) -> BookingRequest:
        req = self._get(request_id, tenant_id)
        req.status = "rejected"
        self.db.commit()
        self.db.refresh(req)
        return req

    def _get(self, request_id: uuid.UUID, tenant_id: uuid.UUID) -> BookingRequest:
        req = self.db.get(BookingRequest, request_id)
        if not req or req.tenant_id != tenant_id:
            raise BookingNotFoundError(str(request_id))
        return req
```

- [ ] **Paso 3: Agregar `send_booking_notification` a `email_service.py`**

Al final de la clase `EmailService`, agregar:

```python
    def send_booking_notification(
        self,
        *,
        to_email: str,
        tenant_name: str,
        patient_name: str,
        patient_email: str,
        patient_phone: str | None,
        requested_start: datetime,
        session_type: str,
        notes: str | None,
    ) -> bool:
        """Send booking request notification to the psychologist. Returns True if sent."""
        if not settings.resend_api_key:
            return False

        session_labels = {
            "individual": "Individual",
            "couple": "Pareja",
            "family": "Familia",
            "followup": "Seguimiento",
        }
        session_label = session_labels.get(session_type, session_type)
        date_str = requested_start.strftime("%A %d de %B de %Y")
        time_str = requested_start.strftime("%H:%M")
        phone_line = f"<br><strong>Teléfono:</strong> {patient_phone}" if patient_phone else ""
        notes_line = f"<p><strong>Notas:</strong> {notes}</p>" if notes else ""

        payload = {
            "from": settings.resend_from_email,
            "to": [to_email],
            "subject": f"Nueva solicitud de cita — {patient_name}",
            "html": (
                f"<p>Hola {tenant_name},</p>"
                f"<p>Tienes una nueva solicitud de cita:</p>"
                f"<p><strong>Paciente:</strong> {patient_name}<br>"
                f"<strong>Email:</strong> {patient_email}{phone_line}<br>"
                f"<strong>Tipo:</strong> {session_label}<br>"
                f"<strong>Fecha solicitada:</strong> {date_str}<br>"
                f"<strong>Hora:</strong> {time_str}</p>"
                f"{notes_line}"
                f"<p>Ingresa a psyque app para confirmar o rechazar.</p>"
            ),
        }

        response = httpx.post(
            self.RESEND_URL,
            json=payload,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            timeout=10.0,
        )
        response.raise_for_status()
        return True
```

- [ ] **Paso 4: Commit**

```bash
git add psicogest/backend/app/schemas/booking.py \
        psicogest/backend/app/services/booking_service.py \
        psicogest/backend/app/services/email_service.py
git commit -m "feat: add booking schemas, service, and email notification"
```

---

## Task 4 — Backend: routers + main.py

**Files:**
- Create: `psicogest/backend/app/api/v1/booking.py`
- Create: `psicogest/backend/app/api/v1/booking_requests.py`
- Modify: `psicogest/backend/app/main.py`

- [ ] **Paso 1: Crear `api/v1/booking.py` (rutas públicas, sin auth)**

```python
"""Public booking router — no authentication required."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.booking import BookingInfo, BookingRequestCreate, BookingRequestCreated
from app.services.booking_service import BookingNotFoundError, BookingService
from app.services.email_service import EmailService

router = APIRouter(prefix="/public/booking", tags=["booking-public"])


@router.get("/{slug}", response_model=BookingInfo)
def get_booking_info(slug: str, db: Annotated[Session, Depends(get_db)]):
    svc = BookingService(db)
    try:
        tenant = svc.get_tenant_by_slug(slug)
    except BookingNotFoundError:
        raise HTTPException(status_code=404, detail="Página de agendamiento no disponible.")

    slots = svc.get_available_slots(tenant)
    return BookingInfo(
        tenant_name=tenant.full_name,
        welcome_message=tenant.booking_welcome_message or "",
        session_duration_min=tenant.session_duration_min,
        slots=slots,
    )


@router.post("/{slug}/request", response_model=BookingRequestCreated, status_code=status.HTTP_201_CREATED)
def create_booking_request(
    slug: str,
    body: BookingRequestCreate,
    db: Annotated[Session, Depends(get_db)],
):
    svc = BookingService(db)
    try:
        tenant = svc.get_tenant_by_slug(slug)
    except BookingNotFoundError:
        raise HTTPException(status_code=404, detail="Página de agendamiento no disponible.")

    req = svc.create_request(
        tenant=tenant,
        patient_name=body.patient_name,
        patient_email=body.patient_email,
        patient_phone=body.patient_phone,
        session_type=body.session_type,
        requested_start=body.requested_start,
        notes=body.notes,
    )

    if tenant.email:
        try:
            EmailService().send_booking_notification(
                to_email=tenant.email,
                tenant_name=tenant.full_name,
                patient_name=body.patient_name,
                patient_email=body.patient_email,
                patient_phone=body.patient_phone,
                requested_start=body.requested_start,
                session_type=body.session_type,
                notes=body.notes,
            )
        except Exception:
            pass  # Email failure must not block the booking confirmation

    return BookingRequestCreated(id=str(req.id), status=req.status)
```

- [ ] **Paso 2: Crear `api/v1/booking_requests.py` (rutas autenticadas)**

```python
"""Booking requests router — authenticated endpoint for psychologists."""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import get_tenant_db, TenantDB
from app.schemas.booking import BookingRequestSummary
from app.services.booking_service import BookingNotFoundError, BookingService

router = APIRouter(prefix="/booking-requests", tags=["booking-requests"])


def _svc(ctx: TenantDB) -> BookingService:
    return BookingService(ctx.db)


@router.get("", response_model=list[BookingRequestSummary])
def list_booking_requests(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    status: str | None = None,
):
    tenant_uuid = uuid.UUID(ctx.tenant.tenant_id)
    return _svc(ctx).list_by_tenant(tenant_uuid, status)


@router.post("/{request_id}/confirm", response_model=BookingRequestSummary)
def confirm_request(
    request_id: uuid.UUID,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
):
    try:
        return _svc(ctx).confirm(request_id, uuid.UUID(ctx.tenant.tenant_id))
    except BookingNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")


@router.post("/{request_id}/reject", response_model=BookingRequestSummary)
def reject_request(
    request_id: uuid.UUID,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
):
    try:
        return _svc(ctx).reject(request_id, uuid.UUID(ctx.tenant.tenant_id))
    except BookingNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")
```

- [ ] **Paso 3: Registrar ambos routers en `main.py`**

Agregar los imports al bloque de routers:

```python
from app.api.v1.booking import router as booking_public_router
from app.api.v1.booking_requests import router as booking_requests_router
```

Agregar al final de las llamadas `app.include_router`:

```python
app.include_router(booking_public_router, prefix="/api/v1")
app.include_router(booking_requests_router, prefix="/api/v1")
```

- [ ] **Paso 4: Verificar en FastAPI docs**

Reiniciar el backend. Navegar a `http://localhost:8000/docs`. Verificar:
- `GET /api/v1/public/booking/{slug}` — visible sin candado
- `POST /api/v1/public/booking/{slug}/request` — visible sin candado
- `GET /api/v1/booking-requests` — con candado (requiere JWT)
- `POST /api/v1/booking-requests/{request_id}/confirm` — con candado

- [ ] **Paso 5: Commit**

```bash
git add psicogest/backend/app/api/v1/booking.py \
        psicogest/backend/app/api/v1/booking_requests.py \
        psicogest/backend/app/main.py
git commit -m "feat: add public booking router and authenticated booking-requests router"
```

---

## Task 5 — Frontend: tipos + api.ts

**Files:**
- Modify: `psicogest/frontend/src/lib/api.ts`

- [ ] **Paso 1: Agregar `publicRequest` helper al inicio de `api.ts`**

Después de la función `downloadBlob` (línea ~61) y antes de `export class ApiError`, agregar:

```ts
async function publicRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, err.detail ?? "Error desconocido");
  }
  return res.json() as Promise<T>;
}
```

- [ ] **Paso 2: Agregar interfaces de booking en `api.ts`**

Después del bloque `// --- Dashboard` (alrededor de línea 205), agregar:

```ts
// --- Booking -----------------------------------------------------------------

export interface BookingInfo {
  tenant_name: string;
  welcome_message: string;
  session_duration_min: number;
  slots: string[];
}

export interface BookingRequestCreate {
  patient_name: string;
  patient_email: string;
  patient_phone?: string;
  session_type: "individual" | "couple" | "family" | "followup";
  requested_start: string; // ISO8601
  notes?: string;
}

export interface BookingRequestCreated {
  id: string;
  status: string;
}

export interface BookingRequestSummary {
  id: string;
  patient_name: string;
  patient_email: string;
  patient_phone: string | null;
  session_type: string;
  requested_start: string;
  requested_end: string;
  status: "pending" | "confirmed" | "rejected";
  notes: string | null;
  created_at: string;
}
```

- [ ] **Paso 3: Actualizar la interfaz `TenantProfile` para incluir campos booking**

Buscar la interfaz `TenantProfile` (o `TenantProfileRead`) en `api.ts`. Agregar los campos booking:

```ts
export interface TenantProfile {
  id: string;
  full_name: string;
  colpsic_number: string;
  reps_code: string | null;
  nit: string | null;
  city: string;
  session_duration_min: number;
  plan: "starter" | "pro" | "clinic";
  plan_expires_at: string;
  booking_enabled: boolean;
  booking_slug: string | null;
  booking_welcome_message: string | null;
}
```

- [ ] **Paso 4: Agregar namespace `booking` y `bookingRequests` al objeto `api`**

Al final del objeto `api`, antes del cierre `}`, agregar:

```ts
  booking: {
    getInfo: (slug: string): Promise<BookingInfo> =>
      publicRequest<BookingInfo>("GET", `/public/booking/${slug}`),
    createRequest: (slug: string, body: BookingRequestCreate): Promise<BookingRequestCreated> =>
      publicRequest<BookingRequestCreated>("POST", `/public/booking/${slug}/request`, body),
  },
  bookingRequests: {
    list: (status?: string): Promise<BookingRequestSummary[]> => {
      const q = status ? `?status=${status}` : "";
      return request<BookingRequestSummary[]>("GET", `/booking-requests${q}`);
    },
    confirm: (id: string): Promise<BookingRequestSummary> =>
      request<BookingRequestSummary>("POST", `/booking-requests/${id}/confirm`),
    reject: (id: string): Promise<BookingRequestSummary> =>
      request<BookingRequestSummary>("POST", `/booking-requests/${id}/reject`),
  },
```

- [ ] **Paso 5: Commit**

```bash
git add psicogest/frontend/src/lib/api.ts
git commit -m "feat: add booking types and api methods"
```

---

## Task 6 — Frontend: página pública `/book/:slug`

**Files:**
- Create: `psicogest/frontend/src/pages/booking/BookingPage.tsx`
- Modify: `psicogest/frontend/src/App.tsx`

- [ ] **Paso 1: Crear `BookingPage.tsx`**

Crear `psicogest/frontend/src/pages/booking/BookingPage.tsx`:

```tsx
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BookingRequestCreate } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SESSION_TYPE_OPTIONS = [
  { value: "individual", label: "Individual" },
  { value: "couple", label: "Pareja" },
  { value: "family", label: "Familia" },
  { value: "followup", label: "Seguimiento" },
] as const;

function formatSlot(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-CO", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function groupSlotsByDate(slots: string[]): Record<string, string[]> {
  return slots.reduce<Record<string, string[]>>((acc, slot) => {
    const date = slot.split("T")[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(slot);
    return acc;
  }, {});
}

export function BookingPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: info, isLoading, isError } = useQuery({
    queryKey: ["booking", slug],
    queryFn: () => api.booking.getInfo(slug!),
    enabled: !!slug,
    retry: false,
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sessionType, setSessionType] = useState<BookingRequestCreate["session_type"]>("individual");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: (body: BookingRequestCreate) => api.booking.createRequest(slug!, body),
    onSuccess: () => setSuccess(true),
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Error al enviar solicitud."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) {
      setFormError("Selecciona un horario disponible.");
      return;
    }
    setFormError(null);
    mutation.mutate({
      patient_name: name,
      patient_email: email,
      patient_phone: phone || undefined,
      session_type: sessionType,
      requested_start: selectedSlot,
      notes: notes || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <p className="text-muted-foreground text-sm">Cargando...</p>
      </div>
    );
  }

  if (isError || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-[#1E3A5F]">Enlace no disponible</p>
          <p className="text-sm text-muted-foreground">Esta página de agendamiento no existe o no está activa.</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-center space-y-3 max-w-sm">
          <div className="text-4xl">✓</div>
          <p className="text-lg font-semibold text-[#1E3A5F]">¡Solicitud enviada!</p>
          <p className="text-sm text-muted-foreground">
            {info.tenant_name} revisará tu solicitud y se pondrá en contacto contigo.
          </p>
        </div>
      </div>
    );
  }

  const slotsByDate = groupSlotsByDate(info.slots);

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-10 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-[#1E3A5F]">{info.tenant_name}</h1>
          {info.welcome_message && (
            <p className="text-sm text-muted-foreground">{info.welcome_message}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-100 shadow-sm p-6 space-y-4">
          {formError && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="name">Nombre completo *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tipo de sesión</Label>
            <Select value={sessionType} onValueChange={(v) => setSessionType(v as typeof sessionType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SESSION_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Horario disponible *</Label>
            {info.slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay horarios disponibles en los próximos 14 días.</p>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto border rounded-md p-3">
                {Object.entries(slotsByDate).map(([date, dateSlots]) => (
                  <div key={date}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                      {new Date(date + "T12:00:00").toLocaleDateString("es-CO", { weekday: "long", month: "long", day: "numeric" })}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {dateSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                            selectedSlot === slot
                              ? "bg-[#1E3A5F] text-white border-[#1E3A5F]"
                              : "border-gray-200 hover:border-[#2E86AB] hover:text-[#2E86AB]"
                          }`}
                        >
                          {new Date(slot).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Motivo / Notas (opcional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Enviando..." : "Solicitar cita"}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Paso 2: Registrar la ruta pública en `App.tsx`**

Agregar el import:

```tsx
import { BookingPage } from "@/pages/booking/BookingPage";
```

En el bloque de `<Routes>`, antes del `/* Rutas protegidas */`, agregar:

```tsx
      {/* Agendamiento público */}
      <Route path="/book/:slug" element={<BookingPage />} />
```

El archivo debe quedar así:

```tsx
    <Routes>
      {/* Rutas públicas */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Agendamiento público */}
      <Route path="/book/:slug" element={<BookingPage />} />

      {/* Rutas protegidas */}
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        {/* ... resto sin cambios ... */}
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
```

- [ ] **Paso 3: Verificar en el navegador**

Navegar a `http://localhost:5173/book/sluginexistente`. Verificar que aparece el mensaje "Enlace no disponible". Esto confirma que la ruta pública funciona sin requerir login.

- [ ] **Paso 4: Commit**

```bash
git add psicogest/frontend/src/pages/booking/BookingPage.tsx \
        psicogest/frontend/src/App.tsx
git commit -m "feat: add public booking page /book/:slug"
```

---

## Task 7 — Frontend: Settings tab "Agendamiento" + QR

**Files:**
- Create: `psicogest/frontend/src/components/settings/BookingSettings.tsx`
- Modify: `psicogest/frontend/src/pages/settings/SettingsPage.tsx`
- Install: `react-qr-code`

- [ ] **Paso 1: Instalar `react-qr-code`**

```bash
cd psicogest/frontend && npm install react-qr-code
```

Verificar que aparece en `package.json` en `dependencies`.

- [ ] **Paso 2: Crear `BookingSettings.tsx`**

Crear `psicogest/frontend/src/components/settings/BookingSettings.tsx`:

```tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import QRCode from "react-qr-code";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function BookingSettings() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.profile.get(),
  });

  const [welcomeMsg, setWelcomeMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: { booking_enabled?: boolean; booking_welcome_message?: string }) =>
      api.profile.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2000);
    },
    onError: () => setSaveError("Error al guardar cambios."),
  });

  if (isLoading || !profile) {
    return <div className="text-sm text-muted-foreground">Cargando...</div>;
  }

  const bookingUrl = profile.booking_slug
    ? `${window.location.origin}/book/${profile.booking_slug}`
    : null;

  const handleToggle = () => {
    setSaveError(null);
    updateMutation.mutate({ booking_enabled: !profile.booking_enabled });
  };

  const handleSaveMessage = () => {
    setSaveError(null);
    updateMutation.mutate({
      booking_welcome_message: welcomeMsg ?? profile.booking_welcome_message ?? "",
    });
  };

  const effectiveMsg = welcomeMsg ?? profile.booking_welcome_message ?? "";

  return (
    <div className="space-y-6">
      {/* Toggle */}
      <div className="rounded-lg border p-4 bg-white flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#1E3A5F]">Agendamiento público</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Activa para compartir un enlace donde los pacientes pueden solicitar citas.
          </p>
        </div>
        <Button
          variant={profile.booking_enabled ? "default" : "outline"}
          size="sm"
          onClick={handleToggle}
          disabled={updateMutation.isPending}
          className={profile.booking_enabled ? "bg-[#27AE60] hover:bg-green-700 text-white" : ""}
        >
          {profile.booking_enabled ? "Activo" : "Inactivo"}
        </Button>
      </div>

      {profile.booking_enabled && bookingUrl && (
        <>
          {/* URL */}
          <div className="rounded-lg border p-4 bg-white space-y-2">
            <p className="text-sm font-semibold text-[#1E3A5F]">Enlace de agendamiento</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-gray-50 border rounded px-2 py-1 flex-1 break-all">
                {bookingUrl}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(bookingUrl)}
              >
                Copiar
              </Button>
            </div>
          </div>

          {/* QR */}
          <div className="rounded-lg border p-4 bg-white space-y-3">
            <p className="text-sm font-semibold text-[#1E3A5F]">Código QR</p>
            <div className="flex justify-center p-4 bg-white border rounded-lg">
              <QRCode value={bookingUrl} size={160} />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Comparte este QR en tu consultorio o redes sociales.
            </p>
          </div>

          {/* Welcome message */}
          <div className="rounded-lg border p-4 bg-white space-y-3">
            <p className="text-sm font-semibold text-[#1E3A5F]">Mensaje de bienvenida</p>
            <Label htmlFor="welcome_msg" className="sr-only">Mensaje de bienvenida</Label>
            <Textarea
              id="welcome_msg"
              value={effectiveMsg}
              onChange={(e) => setWelcomeMsg(e.target.value)}
              rows={3}
              placeholder="Ej: Bienvenido/a. Por favor completa el formulario para solicitar una cita."
            />
            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
            <div className="flex justify-end gap-2">
              {saveOk && <span className="text-xs text-green-600 self-center">✓ Guardado</span>}
              <Button size="sm" onClick={handleSaveMessage} disabled={updateMutation.isPending}>
                Guardar mensaje
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Paso 3: Verificar que `api.profile.get()` y `api.profile.update()` existen en `api.ts`**

Buscar en `api.ts` el namespace `profile`. Debe tener `get` y `update`. Si los métodos se llaman diferente, ajustar los nombres en `BookingSettings.tsx`.

- [ ] **Paso 4: Agregar tab "Agendamiento" a `SettingsPage.tsx`**

Reemplazar el contenido de `SettingsPage.tsx` con:

```tsx
import { useState } from "react";

import { ProfileForm } from "@/components/settings/ProfileForm";
import { AvailabilityGrid } from "@/components/settings/AvailabilityGrid";
import { BookingSettings } from "@/components/settings/BookingSettings";

const TABS = [
  { id: "perfil", label: "Perfil profesional" },
  { id: "disponibilidad", label: "Disponibilidad" },
  { id: "recordatorios", label: "Recordatorios" },
  { id: "agendamiento", label: "Agendamiento" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function SettingsPage() {
  const [active, setActive] = useState<TabId>("perfil");

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-[#1E3A5F]">Configuración</h1>

      <div className="flex border-b gap-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              active === tab.id
                ? "border-[#2E86AB] text-[#1E3A5F]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === "perfil" && (
        <section className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Esta información aparece en los encabezados de RIPS, facturas y notas de sesión.
          </p>
          <ProfileForm />
        </section>
      )}

      {active === "disponibilidad" && (
        <section className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Define los bloques horarios en que atiendes. El sistema los usa como referencia al agendar citas.
          </p>
          <AvailabilityGrid />
        </section>
      )}

      {active === "recordatorios" && (
        <section className="space-y-4">
          <div className="rounded-lg border p-4 bg-white space-y-2">
            <h3 className="text-sm font-semibold text-[#1E3A5F]">Recordatorios automáticos por email</h3>
            <p className="text-sm text-muted-foreground">
              El sistema envía automáticamente dos recordatorios por cita:
            </p>
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li>48 horas antes de la cita</li>
              <li>2 horas antes de la cita</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Los recordatorios se envían al email registrado del paciente.
            </p>
            <div className="rounded-md bg-green-50 border border-green-200 p-3 text-xs text-green-800 mt-2">
              ✓ Recordatorios activos — el sistema revisa citas pendientes cada 15 minutos.
            </div>
          </div>
        </section>
      )}

      {active === "agendamiento" && (
        <section className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Permite que tus pacientes soliciten citas a través de un enlace público o código QR.
          </p>
          <BookingSettings />
        </section>
      )}
    </div>
  );
}
```

- [ ] **Paso 5: Verificar en el navegador**

Navegar a `http://localhost:5173/settings` → tab "Agendamiento". Verificar:
1. Toggle "Inactivo" visible. Al hacer clic → cambia a "Activo" y aparecen URL, QR y campo de mensaje.
2. URL copiable. QR visible.
3. Guardar mensaje → muestra "✓ Guardado" por 2 segundos.

- [ ] **Paso 6: Commit**

```bash
git add psicogest/frontend/src/components/settings/BookingSettings.tsx \
        psicogest/frontend/src/pages/settings/SettingsPage.tsx \
        psicogest/frontend/package.json
git commit -m "feat: add Agendamiento tab in Settings with QR and booking URL"
```

---

## Task 8 — Frontend: agenda muestra solicitudes pendientes

**Files:**
- Create: `psicogest/frontend/src/hooks/useBooking.ts`
- Modify: `psicogest/frontend/src/pages/agenda/AgendaPage.tsx`

- [ ] **Paso 1: Crear `hooks/useBooking.ts`**

Crear `psicogest/frontend/src/hooks/useBooking.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useBookingRequests(status?: string) {
  return useQuery({
    queryKey: ["booking-requests", status ?? "all"],
    queryFn: () => api.bookingRequests.list(status),
    staleTime: 60_000,
    retry: 2,
  });
}

export function useConfirmBookingRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.bookingRequests.confirm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
    },
  });
}

export function useRejectBookingRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.bookingRequests.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
    },
  });
}
```

- [ ] **Paso 2: Importar hooks y tipos en `AgendaPage.tsx`**

Agregar al bloque de imports en `AgendaPage.tsx`:

```tsx
import { useBookingRequests, useConfirmBookingRequest, useRejectBookingRequest } from "@/hooks/useBooking";
import type { BookingRequestSummary } from "@/lib/api";
```

- [ ] **Paso 3: Agregar estado para sidebar de booking request en `AgendaPage`**

En el cuerpo de `AgendaPage`, junto a `selectedAppointmentId`, agregar:

```tsx
const [selectedBookingRequest, setSelectedBookingRequest] = useState<BookingRequestSummary | null>(null);
```

También agregar los hooks:

```tsx
const { data: bookingRequests = [] } = useBookingRequests("pending");
const confirmMutation = useConfirmBookingRequest();
const rejectMutation = useRejectBookingRequest();
```

- [ ] **Paso 4: Añadir booking requests como eventos en el calendario**

Localizar la línea donde se define `calendarEvents` (alrededor de línea 72). Cambiarla para incluir booking requests:

```tsx
const calendarEvents = [
  ...appointments.map((appt) => ({
    id: appt.id,
    title: SESSION_TYPE_LABELS[appt.session_type] ?? appt.session_type,
    start: appt.scheduled_start,
    end: appt.scheduled_end,
    backgroundColor: STATUS_COLORS[appt.status] ?? "#2E86AB",
    borderColor: STATUS_COLORS[appt.status] ?? "#2E86AB",
    textColor: "#fff",
    extendedProps: { type: "appointment", status: appt.status, modality: appt.modality },
  })),
  ...bookingRequests.map((req) => ({
    id: `br-${req.id}`,
    title: `⏳ ${req.patient_name}`,
    start: req.requested_start,
    end: req.requested_end,
    backgroundColor: "#F39C12",
    borderColor: "#d68910",
    textColor: "#fff",
    extendedProps: { type: "booking_request", requestId: req.id },
  })),
];
```

- [ ] **Paso 5: Manejar click en eventos de booking request**

Reemplazar `handleEventClick` para distinguir entre tipo `appointment` y `booking_request`:

```tsx
const handleEventClick = useCallback((info: EventClickArg) => {
  const { type, requestId } = info.event.extendedProps;
  if (type === "booking_request") {
    const req = bookingRequests.find((r) => r.id === requestId) ?? null;
    setSelectedBookingRequest(req);
    setSelectedAppointmentId(null);
  } else {
    setSelectedAppointmentId(info.event.id);
    setSelectedBookingRequest(null);
  }
}, [bookingRequests]);
```

- [ ] **Paso 6: Agregar sidebar de booking request en el JSX de `AgendaPage`**

En el JSX de `AgendaPage`, donde está el `{selectedAppointmentId && <AppointmentSidebar ... />}`, agregar justo al lado:

```tsx
{selectedBookingRequest && (
  <div className="w-80 border-l bg-white flex-shrink-0 overflow-y-auto">
    <div className="flex items-center justify-between p-4 border-b">
      <h2 className="font-semibold text-[#1E3A5F]">Solicitud de cita</h2>
      <button
        type="button"
        onClick={() => setSelectedBookingRequest(null)}
        className="text-muted-foreground hover:text-foreground text-xl"
      >
        ✕
      </button>
    </div>
    <div className="p-4 space-y-4">
      <span className="inline-block text-xs px-2 py-0.5 rounded font-medium bg-amber-100 text-amber-800">
        Pendiente de confirmación
      </span>
      <dl className="space-y-3">
        <div>
          <dt className="text-xs text-muted-foreground uppercase tracking-wide">Paciente</dt>
          <dd className="text-sm font-medium">{selectedBookingRequest.patient_name}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground uppercase tracking-wide">Email</dt>
          <dd className="text-sm">{selectedBookingRequest.patient_email}</dd>
        </div>
        {selectedBookingRequest.patient_phone && (
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-wide">Teléfono</dt>
            <dd className="text-sm">{selectedBookingRequest.patient_phone}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-muted-foreground uppercase tracking-wide">Fecha solicitada</dt>
          <dd className="text-sm">
            {new Date(selectedBookingRequest.requested_start).toLocaleString("es-CO", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground uppercase tracking-wide">Tipo</dt>
          <dd className="text-sm capitalize">{selectedBookingRequest.session_type}</dd>
        </div>
        {selectedBookingRequest.notes && (
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-wide">Notas</dt>
            <dd className="text-sm">{selectedBookingRequest.notes}</dd>
          </div>
        )}
      </dl>
      <div className="flex flex-col gap-2 pt-2">
        <button
          type="button"
          disabled={confirmMutation.isPending}
          onClick={() =>
            confirmMutation.mutate(selectedBookingRequest.id, {
              onSuccess: () => setSelectedBookingRequest(null),
            })
          }
          className="w-full text-sm py-2 rounded bg-[#27AE60] hover:bg-green-700 text-white font-medium disabled:opacity-50"
        >
          {confirmMutation.isPending ? "Confirmando..." : "✓ Confirmar solicitud"}
        </button>
        <button
          type="button"
          disabled={rejectMutation.isPending}
          onClick={() =>
            rejectMutation.mutate(selectedBookingRequest.id, {
              onSuccess: () => setSelectedBookingRequest(null),
            })
          }
          className="w-full text-sm py-2 rounded border border-red-300 hover:bg-red-50 text-red-600 font-medium disabled:opacity-50"
        >
          {rejectMutation.isPending ? "Rechazando..." : "✕ Rechazar"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Al confirmar, notifícale al paciente por email o teléfono y crea la cita manualmente en la agenda.
      </p>
    </div>
  </div>
)}
```

- [ ] **Paso 7: Verificar flujo completo**

1. En Settings → tab "Agendamiento": activar el agendamiento. Copiar la URL.
2. Abrir la URL en una pestaña privada (sin estar logueado). Verificar que aparece la página de booking con los slots disponibles.
3. Llenar el formulario y enviar.
4. En la Agenda: verificar que aparece un evento amarillo con `⏳ [nombre del paciente]`.
5. Hacer clic en el evento → sidebar muestra datos del paciente + botones Confirmar/Rechazar.
6. Al confirmar → evento desaparece de la agenda.

- [ ] **Paso 8: Commit**

```bash
git add psicogest/frontend/src/hooks/useBooking.ts \
        psicogest/frontend/src/pages/agenda/AgendaPage.tsx
git commit -m "feat: show pending booking requests in agenda with confirm/reject actions"
```

---

## Verificación final (criterios PRD §4.2 / Bloque 7)

- [ ] `/book/:slug` accesible sin autenticación — redirige a "no disponible" si slug inválido o booking desactivado
- [ ] Slots mostrados son del futuro, dentro de bloques de disponibilidad configurados, excluyendo citas ya agendadas
- [ ] Formulario de booking crea registro con `status=pending` en `booking_requests`
- [ ] Email enviado al psicólogo si `tenant.email` está configurado (Resend key requerida)
- [ ] En la agenda, eventos `⏳` visibles en color ámbar para solicitudes pendientes
- [ ] Sidebar de solicitud muestra nombre, email, teléfono, fecha, tipo, notas
- [ ] Confirmar → `status=confirmed`, evento desaparece de la agenda
- [ ] Rechazar → `status=rejected`, evento desaparece de la agenda
- [ ] Settings → tab "Agendamiento" permite toggle, muestra URL copiable, QR, y campo de bienvenida editable
