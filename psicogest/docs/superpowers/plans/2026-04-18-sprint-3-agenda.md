# Sprint 3 — Agenda / Citas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full appointment scheduling module (Agenda) — create, view, edit, and cancel appointments in a weekly FullCalendar view, with conflict detection.

**Architecture:** FastAPI service (`AppointmentService`) operates on the existing `appointments` table (already in DB via migration 0001). Frontend uses FullCalendar for the weekly grid plus a drawer form for create/edit. No new migration needed.

**Tech Stack:** FastAPI + SQLAlchemy 2 (raw SQL, same pattern as PatientService) / React 18 + FullCalendar 6 + React Query + shadcn/ui / PostgreSQL RLS (tenant isolation already configured)

---

## File Map

**Backend — create:**
- `backend/app/models/appointment.py` — SQLAlchemy ORM model
- `backend/app/schemas/appointment.py` — Pydantic schemas (Create, Update, Detail, Summary)
- `backend/app/services/appointment_service.py` — Business logic + conflict detection
- `backend/app/api/v1/appointments.py` — FastAPI router (7 endpoints)
- `backend/tests/test_appointments.py` — Pytest unit tests

**Backend — modify:**
- `backend/app/api/v1/router.py` — Register appointments router
- `backend/app/models/__init__.py` — Export Appointment model

**Frontend — create:**
- `frontend/src/lib/api.ts` — Add appointment types + API calls
- `frontend/src/hooks/useAppointments.ts` — React Query hooks
- `frontend/src/pages/agenda/AgendaPage.tsx` — Weekly calendar view
- `frontend/src/components/appointments/AppointmentForm.tsx` — Create/edit drawer form
- `frontend/src/components/appointments/AppointmentSidebar.tsx` — Appointment detail panel

**Frontend — modify:**
- `frontend/src/App.tsx` — Replace stub route with real AgendaPage

---

## Task 1: Appointment SQLAlchemy Model

**Files:**
- Create: `backend/app/models/appointment.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Write the model**

```python
# backend/app/models/appointment.py
"""Appointment model — citas agendadas."""
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, TenantMixin, UUIDPrimaryKey


class Appointment(Base, UUIDPrimaryKey, TenantMixin, TimestampMixin):
    """Scheduled appointment between psychologist and patient."""

    __tablename__ = "appointments"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    scheduled_start: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False
    )
    scheduled_end: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False
    )
    session_type: Mapped[str] = mapped_column(
        sa.Enum("individual", "couple", "family", "followup", name="session_type"),
        nullable=False,
    )
    modality: Mapped[str] = mapped_column(
        sa.Enum("presential", "virtual", name="modality"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        sa.Enum("scheduled", "completed", "cancelled", "noshow", name="appointment_status"),
        nullable=False,
        server_default="scheduled",
    )
    cancellation_reason: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    cancelled_by: Mapped[str | None] = mapped_column(
        sa.Enum("psychologist", "patient", name="cancelled_by"), nullable=True
    )
    reminder_sent_48h: Mapped[bool] = mapped_column(
        sa.Boolean(), nullable=False, server_default=sa.text("false")
    )
    reminder_sent_2h: Mapped[bool] = mapped_column(
        sa.Boolean(), nullable=False, server_default=sa.text("false")
    )
    notes: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
```

- [ ] **Step 2: Export from models __init__**

Read `backend/app/models/__init__.py`. If it doesn't exist, create it:

```python
# backend/app/models/__init__.py
from app.models.base import Base
from app.models.patient import Patient
from app.models.appointment import Appointment

__all__ = ["Base", "Patient", "Appointment"]
```

If it exists, add `from app.models.appointment import Appointment` and `"Appointment"` to `__all__`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/appointment.py backend/app/models/__init__.py
git commit -m "feat(sprint3): add Appointment SQLAlchemy model"
```

---

## Task 2: Appointment Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/appointment.py`

- [ ] **Step 1: Write the schemas**

```python
# backend/app/schemas/appointment.py
"""Pydantic schemas for appointment endpoints."""
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


SessionType = Literal["individual", "couple", "family", "followup"]
Modality = Literal["presential", "virtual"]
AppointmentStatus = Literal["scheduled", "completed", "cancelled", "noshow"]
CancelledBy = Literal["psychologist", "patient"]


class AppointmentCreate(BaseModel):
    patient_id: uuid.UUID
    scheduled_start: datetime
    scheduled_end: datetime
    session_type: SessionType
    modality: Modality
    notes: str | None = Field(None, max_length=1000)

    @model_validator(mode="after")
    def end_after_start(self) -> "AppointmentCreate":
        if self.scheduled_end <= self.scheduled_start:
            raise ValueError("scheduled_end must be after scheduled_start")
        duration = (self.scheduled_end - self.scheduled_start).total_seconds() / 60
        if duration < 15:
            raise ValueError("Appointment must be at least 15 minutes long")
        if duration > 180:
            raise ValueError("Appointment cannot exceed 3 hours")
        return self


class AppointmentUpdate(BaseModel):
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    session_type: SessionType | None = None
    modality: Modality | None = None
    notes: str | None = Field(None, max_length=1000)

    @model_validator(mode="after")
    def end_after_start(self) -> "AppointmentUpdate":
        if self.scheduled_start and self.scheduled_end:
            if self.scheduled_end <= self.scheduled_start:
                raise ValueError("scheduled_end must be after scheduled_start")
        return self


class CancelRequest(BaseModel):
    cancelled_by: CancelledBy
    cancellation_reason: str = Field(..., min_length=5, max_length=500)


class AppointmentSummary(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    patient_id: uuid.UUID
    scheduled_start: datetime
    scheduled_end: datetime
    session_type: str
    modality: str
    status: str
    notes: str | None
    created_at: datetime


class AppointmentDetail(AppointmentSummary):
    cancellation_reason: str | None
    cancelled_by: str | None
    reminder_sent_48h: bool
    reminder_sent_2h: bool
    updated_at: datetime


class PaginatedAppointments(BaseModel):
    items: list[AppointmentSummary]
    total: int
    page: int
    page_size: int
    pages: int
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/appointment.py
git commit -m "feat(sprint3): add appointment Pydantic schemas"
```

---

## Task 3: AppointmentService — Business Logic

**Files:**
- Create: `backend/app/services/appointment_service.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_appointments.py
"""Tests for AppointmentService — conflict detection and CRUD."""
import uuid
from datetime import datetime, timezone, timedelta

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.models.base import Base
from app.models.appointment import Appointment
from app.models.patient import Patient
from app.services.appointment_service import (
    AppointmentService,
    AppointmentConflictError,
    AppointmentNotFoundError,
)

# ---- Fixtures ----------------------------------------------------------------

TENANT_ID = str(uuid.uuid4())
PATIENT_ID = str(uuid.uuid4())


@pytest.fixture(scope="session")
def engine():
    """In-memory SQLite for unit tests — no RLS, pure service logic."""
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(eng)
    return eng


@pytest.fixture
def db(engine):
    """Fresh session per test, rolled back after."""
    with engine.connect() as conn:
        conn.execute(text("PRAGMA journal_mode=WAL"))
        with Session(bind=conn) as session:
            yield session
            session.rollback()


@pytest.fixture
def svc(db):
    return AppointmentService(db, TENANT_ID)


def _dt(hour: int, minute: int = 0) -> datetime:
    """Helper: today at given hour in UTC."""
    now = datetime.now(tz=timezone.utc)
    return now.replace(hour=hour, minute=minute, second=0, microsecond=0)


# ---- Tests -------------------------------------------------------------------

def test_create_appointment_returns_id(svc):
    appt = svc.create({
        "patient_id": PATIENT_ID,
        "scheduled_start": _dt(10),
        "scheduled_end": _dt(11),
        "session_type": "individual",
        "modality": "presential",
        "notes": None,
    })
    assert appt.id is not None
    assert appt.status == "scheduled"


def test_conflict_raises_when_overlapping(svc):
    svc.create({
        "patient_id": PATIENT_ID,
        "scheduled_start": _dt(9),
        "scheduled_end": _dt(10),
        "session_type": "individual",
        "modality": "presential",
        "notes": None,
    })
    with pytest.raises(AppointmentConflictError):
        svc.create({
            "patient_id": PATIENT_ID,
            "scheduled_start": _dt(9, 30),
            "scheduled_end": _dt(10, 30),
            "session_type": "individual",
            "modality": "virtual",
            "notes": None,
        })


def test_adjacent_slots_do_not_conflict(svc):
    svc.create({
        "patient_id": PATIENT_ID,
        "scheduled_start": _dt(14),
        "scheduled_end": _dt(15),
        "session_type": "individual",
        "modality": "presential",
        "notes": None,
    })
    appt2 = svc.create({
        "patient_id": PATIENT_ID,
        "scheduled_start": _dt(15),
        "scheduled_end": _dt(16),
        "session_type": "followup",
        "modality": "presential",
        "notes": None,
    })
    assert appt2.id is not None


def test_cancelled_appointment_does_not_block_slot(svc):
    appt = svc.create({
        "patient_id": PATIENT_ID,
        "scheduled_start": _dt(16),
        "scheduled_end": _dt(17),
        "session_type": "individual",
        "modality": "presential",
        "notes": None,
    })
    svc.cancel(str(appt.id), cancelled_by="psychologist", reason="Test cancel")
    # Same slot now available
    appt2 = svc.create({
        "patient_id": PATIENT_ID,
        "scheduled_start": _dt(16),
        "scheduled_end": _dt(17),
        "session_type": "individual",
        "modality": "virtual",
        "notes": None,
    })
    assert appt2.id is not None


def test_get_by_id_not_found_raises(svc):
    with pytest.raises(AppointmentNotFoundError):
        svc.get_by_id(str(uuid.uuid4()))


def test_cancel_already_cancelled_raises(svc):
    appt = svc.create({
        "patient_id": PATIENT_ID,
        "scheduled_start": _dt(7),
        "scheduled_end": _dt(8),
        "session_type": "couple",
        "modality": "virtual",
        "notes": None,
    })
    svc.cancel(str(appt.id), cancelled_by="patient", reason="First cancel")
    with pytest.raises(ValueError, match="ya está cancelada"):
        svc.cancel(str(appt.id), cancelled_by="patient", reason="Double cancel")


def test_list_by_range_returns_only_range(svc):
    tomorrow = datetime.now(tz=timezone.utc) + timedelta(days=1)
    tomorrow_start = tomorrow.replace(hour=10, minute=0, second=0, microsecond=0)
    tomorrow_end = tomorrow.replace(hour=11, minute=0, second=0, microsecond=0)
    svc.create({
        "patient_id": PATIENT_ID,
        "scheduled_start": tomorrow_start,
        "scheduled_end": tomorrow_end,
        "session_type": "individual",
        "modality": "presential",
        "notes": None,
    })
    results = svc.list_by_range(
        start=tomorrow.replace(hour=0),
        end=tomorrow.replace(hour=23, minute=59),
    )
    assert any(a.scheduled_start == tomorrow_start for a in results)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/test_appointments.py -v 2>&1 | head -30
```

Expected: `ImportError` — `appointment_service` doesn't exist yet.

- [ ] **Step 3: Write the AppointmentService**

```python
# backend/app/services/appointment_service.py
"""Appointment business logic: CRUD, conflict detection, cancellation."""
from __future__ import annotations

import math
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.schemas.appointment import AppointmentSummary, PaginatedAppointments


class AppointmentNotFoundError(Exception):
    pass


class AppointmentConflictError(Exception):
    pass


class AppointmentService:
    """All appointment operations for a single authenticated tenant."""

    def __init__(self, db: Session, tenant_id: str) -> None:
        self.db = db
        self.tenant_id = tenant_id

    def _check_conflict(
        self,
        start: datetime,
        end: datetime,
        exclude_id: str | None = None,
    ) -> None:
        """Raise AppointmentConflictError if any scheduled appointment overlaps [start, end).

        Cancelled and noshow appointments are excluded from conflict checks.
        Overlap condition: existing.start < new.end AND existing.end > new.start
        """
        params: dict = {
            "tid": self.tenant_id,
            "start": start,
            "end": end,
        }
        exclude_clause = ""
        if exclude_id:
            exclude_clause = "AND id != :exclude_id"
            params["exclude_id"] = exclude_id

        result = self.db.execute(
            text(f"""
                SELECT id FROM appointments
                WHERE tenant_id = :tid
                  AND status IN ('scheduled', 'completed')
                  AND scheduled_start < :end
                  AND scheduled_end > :start
                  {exclude_clause}
                LIMIT 1
            """),
            params,
        ).fetchone()

        if result:
            raise AppointmentConflictError(
                f"Ya existe una cita entre {start.strftime('%H:%M')} y {end.strftime('%H:%M')}."
            )

    def create(self, data: dict) -> Appointment:
        """Create appointment. Raises AppointmentConflictError on overlap."""
        self._check_conflict(data["scheduled_start"], data["scheduled_end"])
        appt = Appointment(
            tenant_id=self.tenant_id,
            patient_id=data["patient_id"],
            scheduled_start=data["scheduled_start"],
            scheduled_end=data["scheduled_end"],
            session_type=data["session_type"],
            modality=data["modality"],
            notes=data.get("notes"),
            status="scheduled",
        )
        self.db.add(appt)
        self.db.flush()
        self.db.refresh(appt)
        return appt

    def get_by_id(self, appointment_id: str) -> Appointment:
        """Fetch appointment by UUID. Raises AppointmentNotFoundError if missing."""
        appt = self.db.get(Appointment, appointment_id)
        if not appt:
            raise AppointmentNotFoundError(f"Cita {appointment_id} no encontrada.")
        return appt

    def list_by_range(self, *, start: datetime, end: datetime) -> list[Appointment]:
        """Return all appointments overlapping the given datetime range."""
        rows = self.db.execute(
            text("""
                SELECT * FROM appointments
                WHERE tenant_id = :tid
                  AND scheduled_start < :end
                  AND scheduled_end > :start
                ORDER BY scheduled_start
            """),
            {"tid": self.tenant_id, "start": start, "end": end},
        ).mappings().fetchall()
        return [self.db.get(Appointment, str(r["id"])) for r in rows]

    def list_paginated(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        patient_id: str | None = None,
        status: str | None = None,
    ) -> PaginatedAppointments:
        """Paginated appointment list, optionally filtered by patient or status."""
        page_size = min(page_size, 100)
        offset = (page - 1) * page_size

        conditions = ["tenant_id = :tid"]
        params: dict = {"tid": self.tenant_id}

        if patient_id:
            conditions.append("patient_id = :pid")
            params["pid"] = patient_id
        if status:
            conditions.append("status = :status")
            params["status"] = status

        where = " AND ".join(conditions)

        total = self.db.execute(
            text(f"SELECT COUNT(*) FROM appointments WHERE {where}"),
            params,
        ).scalar() or 0

        rows = self.db.execute(
            text(f"""
                SELECT * FROM appointments
                WHERE {where}
                ORDER BY scheduled_start DESC
                LIMIT :limit OFFSET :offset
            """),
            {**params, "limit": page_size, "offset": offset},
        ).mappings().fetchall()

        items = [AppointmentSummary.model_validate(dict(r)) for r in rows]
        return PaginatedAppointments(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            pages=math.ceil(total / page_size) if total > 0 else 1,
        )

    def update(self, appointment_id: str, data: dict) -> Appointment:
        """Partial update. Checks conflict if times change. Returns updated appointment."""
        appt = self.get_by_id(appointment_id)
        new_start = data.get("scheduled_start", appt.scheduled_start)
        new_end = data.get("scheduled_end", appt.scheduled_end)

        if "scheduled_start" in data or "scheduled_end" in data:
            self._check_conflict(new_start, new_end, exclude_id=appointment_id)

        allowed = {"scheduled_start", "scheduled_end", "session_type", "modality", "notes"}
        update_data = {k: v for k, v in data.items() if k in allowed and v is not None}

        if not update_data:
            return appt

        set_clause = ", ".join(f"{k} = :{k}" for k in update_data)
        self.db.execute(
            text(f"""
                UPDATE appointments
                SET {set_clause}
                WHERE id = :appt_id AND tenant_id = :tid
            """),
            {**update_data, "appt_id": appointment_id, "tid": self.tenant_id},
        )
        self.db.expire_all()
        return self.get_by_id(appointment_id)

    def cancel(
        self,
        appointment_id: str,
        *,
        cancelled_by: str,
        reason: str,
    ) -> Appointment:
        """Cancel appointment. Raises ValueError if already cancelled/noshow."""
        appt = self.get_by_id(appointment_id)
        if appt.status in ("cancelled", "noshow"):
            raise ValueError(f"La cita ya está cancelada o marcada como no-show.")
        self.db.execute(
            text("""
                UPDATE appointments
                SET status = 'cancelled',
                    cancelled_by = :cancelled_by,
                    cancellation_reason = :reason
                WHERE id = :appt_id AND tenant_id = :tid
            """),
            {
                "cancelled_by": cancelled_by,
                "reason": reason,
                "appt_id": appointment_id,
                "tid": self.tenant_id,
            },
        )
        self.db.expire_all()
        return self.get_by_id(appointment_id)
```

- [ ] **Step 4: Run tests**

```bash
cd backend && python -m pytest tests/test_appointments.py -v
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/appointment_service.py backend/tests/test_appointments.py
git commit -m "feat(sprint3): AppointmentService with conflict detection (all tests pass)"
```

---

## Task 4: Appointments FastAPI Router

**Files:**
- Create: `backend/app/api/v1/appointments.py`
- Modify: `backend/app/api/v1/router.py`

- [ ] **Step 1: Write the router**

```python
# backend/app/api/v1/appointments.py
"""Appointments router — RF-AGE-01 to RF-AGE-05."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.deps import get_tenant_db, TenantDB
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentDetail,
    AppointmentSummary,
    AppointmentUpdate,
    CancelRequest,
    PaginatedAppointments,
)
from app.services.appointment_service import (
    AppointmentConflictError,
    AppointmentNotFoundError,
    AppointmentService,
)

router = APIRouter(prefix="/appointments", tags=["appointments"])


def _service(ctx: TenantDB) -> AppointmentService:
    return AppointmentService(ctx.db, ctx.tenant.tenant_id)


@router.get("", response_model=PaginatedAppointments)
def list_appointments(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    patient_id: str | None = Query(None),
    status: str | None = Query(None),
) -> PaginatedAppointments:
    return _service(ctx).list_paginated(
        page=page, page_size=page_size, patient_id=patient_id, status=status
    )


@router.get("/range", response_model=list[AppointmentSummary])
def list_appointments_by_range(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    start: str = Query(..., description="ISO datetime (UTC)"),
    end: str = Query(..., description="ISO datetime (UTC)"),
) -> list[AppointmentSummary]:
    """Return appointments overlapping a datetime range. Used by FullCalendar."""
    from datetime import datetime
    try:
        dt_start = datetime.fromisoformat(start)
        dt_end = datetime.fromisoformat(end)
    except ValueError:
        raise HTTPException(status_code=422, detail="start and end must be ISO datetime strings")
    appts = _service(ctx).list_by_range(start=dt_start, end=dt_end)
    return [AppointmentSummary.model_validate(a) for a in appts]


@router.post("", response_model=AppointmentDetail, status_code=status.HTTP_201_CREATED)
def create_appointment(
    body: AppointmentCreate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> AppointmentDetail:
    try:
        appt = _service(ctx).create(body.model_dump())
        ctx.db.commit()
        ctx.db.refresh(appt)
        return AppointmentDetail.model_validate(appt)
    except AppointmentConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.get("/{appointment_id}", response_model=AppointmentDetail)
def get_appointment(
    appointment_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> AppointmentDetail:
    try:
        return AppointmentDetail.model_validate(_service(ctx).get_by_id(appointment_id))
    except AppointmentNotFoundError:
        raise HTTPException(status_code=404, detail="Cita no encontrada.")


@router.put("/{appointment_id}", response_model=AppointmentDetail)
def update_appointment(
    appointment_id: str,
    body: AppointmentUpdate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> AppointmentDetail:
    try:
        appt = _service(ctx).update(appointment_id, body.model_dump(exclude_none=True))
        ctx.db.commit()
        ctx.db.refresh(appt)
        return AppointmentDetail.model_validate(appt)
    except AppointmentNotFoundError:
        raise HTTPException(status_code=404, detail="Cita no encontrada.")
    except AppointmentConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.post("/{appointment_id}/cancel", response_model=AppointmentDetail)
def cancel_appointment(
    appointment_id: str,
    body: CancelRequest,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> AppointmentDetail:
    try:
        appt = _service(ctx).cancel(
            appointment_id,
            cancelled_by=body.cancelled_by,
            reason=body.cancellation_reason,
        )
        ctx.db.commit()
        ctx.db.refresh(appt)
        return AppointmentDetail.model_validate(appt)
    except AppointmentNotFoundError:
        raise HTTPException(status_code=404, detail="Cita no encontrada.")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
```

- [ ] **Step 2: Register the router**

Read `backend/app/api/v1/router.py`. Add the appointments router. The file likely looks like:

```python
from fastapi import APIRouter
from app.api.v1 import patients, auth_routes

router = APIRouter()
router.include_router(patients.router)
router.include_router(auth_routes.router)
```

Add after the existing includes:

```python
from app.api.v1 import appointments
router.include_router(appointments.router)
```

- [ ] **Step 3: Verify the backend starts**

```bash
cd backend && python -m uvicorn app.main:app --reload --port 8000
```

Expected: Server starts, no import errors. Check `http://localhost:8000/docs` — `/api/v1/appointments` endpoints appear.

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/appointments.py backend/app/api/v1/router.py
git commit -m "feat(sprint3): appointments FastAPI router — 6 endpoints"
```

---

## Task 5: Frontend API Types + React Query Hooks

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/hooks/useAppointments.ts`

- [ ] **Step 1: Add appointment types and API methods to api.ts**

In `frontend/src/lib/api.ts`, add after the existing patient types:

```typescript
// --- Appointments -----------------------------------------------------------

export type SessionType = "individual" | "couple" | "family" | "followup";
export type Modality = "presential" | "virtual";
export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "noshow";
export type CancelledBy = "psychologist" | "patient";

export interface AppointmentSummary {
  id: string;
  patient_id: string;
  scheduled_start: string;
  scheduled_end: string;
  session_type: SessionType;
  modality: Modality;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
}

export interface AppointmentDetail extends AppointmentSummary {
  cancellation_reason: string | null;
  cancelled_by: CancelledBy | null;
  reminder_sent_48h: boolean;
  reminder_sent_2h: boolean;
  updated_at: string;
}

export interface PaginatedAppointments {
  items: AppointmentSummary[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface AppointmentCreatePayload {
  patient_id: string;
  scheduled_start: string;
  scheduled_end: string;
  session_type: SessionType;
  modality: Modality;
  notes?: string;
}

export interface AppointmentUpdatePayload {
  scheduled_start?: string;
  scheduled_end?: string;
  session_type?: SessionType;
  modality?: Modality;
  notes?: string;
}

export interface CancelPayload {
  cancelled_by: CancelledBy;
  cancellation_reason: string;
}
```

Then inside the `api` object, add an `appointments` key after `patients`:

```typescript
  appointments: {
    listByRange: (start: string, end: string) =>
      request<AppointmentSummary[]>("GET", `/appointments/range?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
    list: (params?: { page?: number; page_size?: number; patient_id?: string; status?: string }) => {
      const q = new URLSearchParams();
      if (params?.page) q.set("page", String(params.page));
      if (params?.page_size) q.set("page_size", String(params.page_size));
      if (params?.patient_id) q.set("patient_id", params.patient_id);
      if (params?.status) q.set("status", params.status);
      return request<PaginatedAppointments>("GET", `/appointments?${q}`);
    },
    create: (body: AppointmentCreatePayload) =>
      request<AppointmentDetail>("POST", "/appointments", body),
    get: (id: string) =>
      request<AppointmentDetail>("GET", `/appointments/${id}`),
    update: (id: string, body: AppointmentUpdatePayload) =>
      request<AppointmentDetail>("PUT", `/appointments/${id}`, body),
    cancel: (id: string, body: CancelPayload) =>
      request<AppointmentDetail>("POST", `/appointments/${id}/cancel`, body),
  },
```

- [ ] **Step 2: Create useAppointments hooks**

```typescript
// frontend/src/hooks/useAppointments.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type AppointmentCreatePayload,
  type AppointmentUpdatePayload,
  type CancelPayload,
} from "@/lib/api";

export function useAppointmentsByRange(start: string, end: string) {
  return useQuery({
    queryKey: ["appointments", "range", start, end],
    queryFn: () => api.appointments.listByRange(start, end),
    enabled: !!start && !!end,
  });
}

export function useAppointment(id: string) {
  return useQuery({
    queryKey: ["appointment", id],
    queryFn: () => api.appointments.get(id),
    enabled: !!id,
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AppointmentCreatePayload) => api.appointments.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
}

export function useUpdateAppointment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AppointmentUpdatePayload) => api.appointments.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["appointment", id] });
    },
  });
}

export function useCancelAppointment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CancelPayload) => api.appointments.cancel(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["appointment", id] });
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/hooks/useAppointments.ts
git commit -m "feat(sprint3): appointment API types and React Query hooks"
```

---

## Task 6: Install FullCalendar

**Files:**
- Modify: `frontend/package.json` (via npm install)

- [ ] **Step 1: Install FullCalendar packages**

```bash
cd frontend && npm install @fullcalendar/react @fullcalendar/core @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction
```

- [ ] **Step 2: Verify install**

```bash
cd frontend && npm ls @fullcalendar/react
```

Expected: `@fullcalendar/react@6.x.x`

- [ ] **Step 3: Commit lockfile**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat(sprint3): install FullCalendar 6"
```

---

## Task 7: AppointmentForm Component

**Files:**
- Create: `frontend/src/components/appointments/AppointmentForm.tsx`

- [ ] **Step 1: Create the form component**

```tsx
// frontend/src/components/appointments/AppointmentForm.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AppointmentCreatePayload, SessionType, Modality } from "@/lib/api";

interface Props {
  defaultDate?: Date;
  defaultPatientId?: string;
  onSubmit: (payload: AppointmentCreatePayload) => void;
  isSubmitting: boolean;
  error?: string | null;
}

const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  individual: "Individual",
  couple: "Pareja",
  family: "Familia",
  followup: "Seguimiento",
};

const MODALITY_LABELS: Record<Modality, string> = {
  presential: "Presencial",
  virtual: "Virtual",
};

function toLocalDatetimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toISOWithOffset(localValue: string): string {
  return new Date(localValue).toISOString();
}

export function AppointmentForm({ defaultDate, defaultPatientId, onSubmit, isSubmitting, error }: Props) {
  const now = defaultDate ?? new Date();
  const endDefault = new Date(now.getTime() + 50 * 60 * 1000);

  const [patientId, setPatientId] = useState(defaultPatientId ?? "");
  const [start, setStart] = useState(toLocalDatetimeValue(now));
  const [end, setEnd] = useState(toLocalDatetimeValue(endDefault));
  const [sessionType, setSessionType] = useState<SessionType>("individual");
  const [modality, setModality] = useState<Modality>("presential");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      patient_id: patientId,
      scheduled_start: toISOWithOffset(start),
      scheduled_end: toISOWithOffset(end),
      session_type: sessionType,
      modality,
      notes: notes || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-[#E74C3C]" role="alert">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">ID del paciente</label>
        <Input
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          placeholder="UUID del paciente"
          required
          disabled={!!defaultPatientId}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Inicio</label>
          <Input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Fin</label>
          <Input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Tipo de sesión</label>
          <select
            className="h-10 w-full rounded-md border border-input px-3 text-sm"
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value as SessionType)}
          >
            {(Object.keys(SESSION_TYPE_LABELS) as SessionType[]).map((k) => (
              <option key={k} value={k}>{SESSION_TYPE_LABELS[k]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Modalidad</label>
          <select
            className="h-10 w-full rounded-md border border-input px-3 text-sm"
            value={modality}
            onChange={(e) => setModality(e.target.value as Modality)}
          >
            {(Object.keys(MODALITY_LABELS) as Modality[]).map((k) => (
              <option key={k} value={k}>{MODALITY_LABELS[k]}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Notas (opcional)</label>
        <textarea
          className="w-full rounded-md border border-input px-3 py-2 text-sm min-h-[80px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
          placeholder="Observaciones para la cita..."
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          className="bg-[#2E86AB] hover:bg-[#1E3A5F]"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Guardando..." : "Agendar cita"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/appointments/AppointmentForm.tsx
git commit -m "feat(sprint3): AppointmentForm component"
```

---

## Task 8: AppointmentSidebar Component

**Files:**
- Create: `frontend/src/components/appointments/AppointmentSidebar.tsx`

- [ ] **Step 1: Create the sidebar**

```tsx
// frontend/src/components/appointments/AppointmentSidebar.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAppointment, useCancelAppointment } from "@/hooks/useAppointments";
import type { CancelledBy } from "@/lib/api";
import { ApiError } from "@/lib/api";

interface Props {
  appointmentId: string;
  onClose: () => void;
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  individual: "Individual", couple: "Pareja", family: "Familia", followup: "Seguimiento",
};
const MODALITY_LABELS: Record<string, string> = { presential: "Presencial", virtual: "Virtual" };
const STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendada", completed: "Completada", cancelled: "Cancelada", noshow: "No asistió",
};
const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-[#E74C3C]",
  noshow: "bg-amber-50 text-amber-700",
};

export function AppointmentSidebar({ appointmentId, onClose }: Props) {
  const { data: appt, isLoading } = useAppointment(appointmentId);
  const cancelMutation = useCancelAppointment(appointmentId);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelledBy, setCancelledBy] = useState<CancelledBy>("psychologist");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);

  if (isLoading) return (
    <div className="p-6 text-muted-foreground text-sm">Cargando...</div>
  );
  if (!appt) return null;

  const start = new Date(appt.scheduled_start);
  const end = new Date(appt.scheduled_end);

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    setCancelError(null);
    try {
      await cancelMutation.mutateAsync({ cancelled_by: cancelledBy, cancellation_reason: cancelReason });
      setShowCancelForm(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setCancelError(err.message);
      } else {
        setCancelError("Error al cancelar la cita.");
      }
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold text-[#1E3A5F]">Detalle de cita</h2>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        <span className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[appt.status] ?? ""}`}>
          {STATUS_LABELS[appt.status] ?? appt.status}
        </span>

        <dl className="space-y-3">
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-wide">Fecha</dt>
            <dd className="text-sm">{start.toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-wide">Horario</dt>
            <dd className="text-sm">{start.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })} — {end.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-wide">Tipo</dt>
            <dd className="text-sm">{SESSION_TYPE_LABELS[appt.session_type] ?? appt.session_type}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-wide">Modalidad</dt>
            <dd className="text-sm">{MODALITY_LABELS[appt.modality] ?? appt.modality}</dd>
          </div>
          {appt.notes && (
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide">Notas</dt>
              <dd className="text-sm">{appt.notes}</dd>
            </div>
          )}
          {appt.cancellation_reason && (
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide">Motivo cancelación</dt>
              <dd className="text-sm text-[#E74C3C]">{appt.cancellation_reason}</dd>
            </div>
          )}
        </dl>

        {appt.status === "scheduled" && !showCancelForm && (
          <Button
            variant="outline"
            size="sm"
            className="text-[#E74C3C] border-[#E74C3C] hover:bg-red-50"
            onClick={() => setShowCancelForm(true)}
          >
            Cancelar cita
          </Button>
        )}

        {showCancelForm && (
          <form onSubmit={handleCancel} className="space-y-3 border rounded-lg p-4 bg-red-50">
            <p className="text-sm font-medium text-[#E74C3C]">Confirmar cancelación</p>
            {cancelError && <p className="text-xs text-[#E74C3C]">{cancelError}</p>}
            <div>
              <label className="block text-xs font-medium mb-1">Cancelada por</label>
              <select
                className="h-9 w-full rounded-md border border-input px-3 text-sm"
                value={cancelledBy}
                onChange={(e) => setCancelledBy(e.target.value as CancelledBy)}
              >
                <option value="psychologist">Psicólogo</option>
                <option value="patient">Paciente</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Motivo</label>
              <textarea
                className="w-full rounded-md border border-input px-3 py-2 text-sm min-h-[60px]"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                required
                minLength={5}
                maxLength={500}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="bg-[#E74C3C] hover:bg-red-700 text-white" disabled={cancelMutation.isPending}>
                {cancelMutation.isPending ? "Cancelando..." : "Confirmar"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowCancelForm(false)}>
                Volver
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/appointments/AppointmentSidebar.tsx
git commit -m "feat(sprint3): AppointmentSidebar with cancel flow"
```

---

## Task 9: AgendaPage — FullCalendar Weekly View

**Files:**
- Create: `frontend/src/pages/agenda/AgendaPage.tsx`

- [ ] **Step 1: Create AgendaPage**

```tsx
// frontend/src/pages/agenda/AgendaPage.tsx
import { useRef, useState, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, EventClickArg, DatesSetArg } from "@fullcalendar/core";
import { useAppointmentsByRange, useCreateAppointment } from "@/hooks/useAppointments";
import { AppointmentForm } from "@/components/appointments/AppointmentForm";
import { AppointmentSidebar } from "@/components/appointments/AppointmentSidebar";
import { ApiError, type AppointmentCreatePayload } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "#2E86AB",
  completed: "#27AE60",
  cancelled: "#E74C3C",
  noshow: "#F39C12",
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  individual: "Individual", couple: "Pareja", family: "Familia", followup: "Seguimiento",
};

export function AgendaPage() {
  const calendarRef = useRef<FullCalendar>(null);

  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  const { data: appointments = [], isLoading } = useAppointmentsByRange(rangeStart, rangeEnd);
  const createMutation = useCreateAppointment();

  const [showForm, setShowForm] = useState(false);
  const [formDefaultDate, setFormDefaultDate] = useState<Date | undefined>();
  const [formError, setFormError] = useState<string | null>(null);

  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  const handleDatesSet = useCallback((info: DatesSetArg) => {
    setRangeStart(info.start.toISOString());
    setRangeEnd(info.end.toISOString());
  }, []);

  const handleDateSelect = useCallback((info: DateSelectArg) => {
    setFormDefaultDate(info.start);
    setFormError(null);
    setShowForm(true);
  }, []);

  const handleEventClick = useCallback((info: EventClickArg) => {
    setSelectedAppointmentId(info.event.id);
  }, []);

  const handleCreate = async (payload: AppointmentCreatePayload) => {
    setFormError(null);
    try {
      await createMutation.mutateAsync(payload);
      setShowForm(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError(err.message);
      } else {
        setFormError("Error al crear la cita. Intenta de nuevo.");
      }
    }
  };

  const calendarEvents = appointments.map((appt) => ({
    id: appt.id,
    title: `${SESSION_TYPE_LABELS[appt.session_type] ?? appt.session_type}`,
    start: appt.scheduled_start,
    end: appt.scheduled_end,
    backgroundColor: STATUS_COLORS[appt.status] ?? "#2E86AB",
    borderColor: STATUS_COLORS[appt.status] ?? "#2E86AB",
    textColor: "#fff",
    extendedProps: { status: appt.status, modality: appt.modality },
  }));

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Calendar area */}
      <div className="flex-1 p-6 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Agenda</h1>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#2E86AB] hover:bg-[#1E3A5F] text-white text-sm font-medium px-4 py-2"
            onClick={() => { setFormDefaultDate(new Date()); setFormError(null); setShowForm(true); }}
          >
            + Nueva cita
          </button>
        </div>

        {isLoading && (
          <div className="text-sm text-muted-foreground mb-2">Cargando citas...</div>
        )}

        <div className="flex-1 overflow-hidden">
          <FullCalendar
            ref={calendarRef}
            plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            locale="es"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            buttonText={{
              today: "Hoy",
              month: "Mes",
              week: "Semana",
              day: "Día",
            }}
            slotMinTime="07:00:00"
            slotMaxTime="21:00:00"
            slotDuration="00:30:00"
            allDaySlot={false}
            selectable
            selectMirror
            events={calendarEvents}
            datesSet={handleDatesSet}
            select={handleDateSelect}
            eventClick={handleEventClick}
            height="100%"
            eventContent={(arg) => (
              <div className="px-1 py-0.5 overflow-hidden">
                <div className="text-xs font-semibold leading-tight truncate">{arg.event.title}</div>
                <div className="text-xs opacity-80 capitalize">{arg.event.extendedProps.modality}</div>
              </div>
            )}
          />
        </div>
      </div>

      {/* New appointment form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-8 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-[#1E3A5F]">Nueva cita</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
            </div>
            <AppointmentForm
              defaultDate={formDefaultDate}
              onSubmit={handleCreate}
              isSubmitting={createMutation.isPending}
              error={formError}
            />
          </div>
        </div>
      )}

      {/* Appointment detail sidebar */}
      {selectedAppointmentId && (
        <div className="w-80 border-l bg-white shadow-md flex-shrink-0">
          <AppointmentSidebar
            appointmentId={selectedAppointmentId}
            onClose={() => setSelectedAppointmentId(null)}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/agenda/AgendaPage.tsx
git commit -m "feat(sprint3): AgendaPage with FullCalendar weekly view"
```

---

## Task 10: Wire AgendaPage into the Router

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Replace the stub route**

In `frontend/src/App.tsx`, find:

```tsx
<Route path="/agenda" element={<div className="p-8"><h1 className="text-2xl font-bold text-[#1E3A5F]">Agenda</h1><p className="text-muted-foreground mt-2">Sprint 3</p></div>} />
```

Replace with:

```tsx
<Route path="/agenda" element={<AgendaPage />} />
```

And add the import at the top of the file with the other page imports:

```tsx
import { AgendaPage } from "@/pages/agenda/AgendaPage";
```

- [ ] **Step 2: Start dev server and verify**

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173`. Click "Agenda" in the sidebar. Expected:
- FullCalendar weekly view renders
- "Nueva cita" button opens the form modal
- Selecting a time slot opens the form with that time pre-filled

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(sprint3): wire AgendaPage into router — Sprint 3 complete"
```

---

## Task 11: Final Push to GitHub

- [ ] **Step 1: Verify all tests still pass**

```bash
cd backend && python -m pytest tests/ -v
```

Expected: All tests PASS (including existing patient tests + new appointment tests).

- [ ] **Step 2: Push**

```bash
git push origin main
```

- [ ] **Step 3: Confirm**

```bash
git log --oneline -10
```

Expected: Sprint 3 commits visible — model, schemas, service, router, hooks, components, AgendaPage.

---

## Spec Coverage Check

| PRD Requirement | Task |
|---|---|
| RF-AGE-01: Crear cita con hora y duración | Task 3 (service.create), Task 4 (POST /appointments), Task 7 (AppointmentForm) |
| RF-AGE-02: Detectar conflictos de horario | Task 3 (_check_conflict + tests) |
| RF-AGE-03: Vista semanal de citas | Task 9 (AgendaPage FullCalendar) |
| RF-AGE-04: Cancelar cita con motivo | Task 3 (service.cancel), Task 4 (POST /cancel), Task 8 (AppointmentSidebar) |
| RF-AGE-05: Filtrar por estado y paciente | Task 4 (GET /appointments?status=&patient_id=), Task 5 (hooks) |
| DB: appointments table | Already exists (migration 0001) — no new migration needed |
| RLS: tenant isolation | Already configured in migration 0001 for appointments table |
