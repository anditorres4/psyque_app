# Sprint 5 — Módulo de Sesiones Clínicas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el módulo de notas clínicas: marcar citas como completadas/no-show, crear borradores de sesión, firmar inmutablemente con SHA-256 (Res. 1995/1999), añadir notas aclaratorias append-only, y exponer todo en frontend con flujo completo desde la agenda y la ficha del paciente.

**Architecture:** Las tablas `sessions` y `session_notes` ya existen desde la migración 0001 — no se requiere nueva migración. `SessionService` usa ORM SQLAlchemy igual que `AppointmentService`. El firmado calcula `SHA-256(id + campos clínicos)` y marca el registro como inmutable: los `PUT` sobre sesiones firmadas son rechazados en la capa de servicio. Las `session_notes` son append-only por diseño normativo. El frontend conecta desde la `AppointmentSidebar` (botones Completar/No asistió) y desde la pestaña Sesiones del `PatientDetailPage`.

**Tech Stack:** FastAPI + SQLAlchemy 2 ORM + hashlib (stdlib) / React 18 + TypeScript + React Query + shadcn/ui

---

## Contexto crítico para el implementador

- **Sin nueva migración**: `sessions`, `session_notes`, y el enum `session_status = ('draft','signed')` ya existen en PostgreSQL desde `0001_initial_schema.py`.
- **FORCE ROW LEVEL SECURITY** está activo en `sessions` y `session_notes` — todas las queries necesitan `SET LOCAL app.tenant_id` (a través de `get_tenant_db`).
- **server_default en SQLite**: usar `sa.text("'draft'")` con comillas internas, igual que en `appointment.py`.
- **session_notes NO tiene updated_at** — no usa `TimestampMixin`, solo `created_at`.
- **Registros firmados son inmutables por ley** (Res. 1995/1999): el servicio rechaza `PUT` sobre sesiones con `status='signed'`.
- **appointment_id en SQLite tests**: SQLite no enforcea FKs por defecto — se puede insertar un UUID arbitrario.

---

## File Map

**Create:**
- `psicogest/backend/app/models/session.py` — ORM models Session + SessionNote
- `psicogest/backend/app/schemas/session.py` — Pydantic schemas
- `psicogest/backend/app/services/session_service.py` — CRUD + sign + notes
- `psicogest/backend/app/api/v1/sessions.py` — router sessions
- `psicogest/backend/tests/test_sessions.py`
- `psicogest/frontend/src/hooks/useSessions.ts`
- `psicogest/frontend/src/components/sessions/SessionForm.tsx`
- `psicogest/frontend/src/components/sessions/SessionDetail.tsx`
- `psicogest/frontend/src/pages/sessions/SessionsPage.tsx`

**Modify:**
- `psicogest/backend/app/models/__init__.py` — exportar Session, SessionNote
- `psicogest/backend/app/services/appointment_service.py` — añadir `complete()` y `mark_noshow()`
- `psicogest/backend/tests/test_appointments.py` — tests de complete/noshow
- `psicogest/backend/app/api/v1/appointments.py` — endpoints `POST /:id/complete` y `POST /:id/noshow`
- `psicogest/backend/app/main.py` — registrar sessions_router
- `psicogest/frontend/src/lib/api.ts` — tipos + métodos sessions
- `psicogest/frontend/src/components/appointments/AppointmentSidebar.tsx` — botones Completar/No asistió
- `psicogest/frontend/src/pages/patients/PatientDetailPage.tsx` — pestaña sesiones funcional
- `psicogest/frontend/src/App.tsx` — importar SessionsPage

---

### Task 1: Session + SessionNote SQLAlchemy models

**Files:**
- Create: `psicogest/backend/app/models/session.py`
- Modify: `psicogest/backend/app/models/__init__.py`

- [ ] **Step 1: Crear `app/models/session.py`**

```python
"""Session and SessionNote ORM models — clinical records (Res. 1995/1999).

Tables already exist from migration 0001 — no new migration needed.
Signed sessions are immutable by law; enforcement is in SessionService.
SessionNote is append-only: no updated_at column.
"""
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import DateTime, func

from app.models.base import Base, TimestampMixin, TenantMixin, UUIDPrimaryKey


class Session(Base, UUIDPrimaryKey, TenantMixin, TimestampMixin):
    """Clinical session note linked to one appointment."""

    __tablename__ = "sessions"

    appointment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    actual_start: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False
    )
    actual_end: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False
    )
    # CIE-11 obligatorio — Res. 1442/2024
    diagnosis_cie11: Mapped[str] = mapped_column(sa.String(20), nullable=False)
    diagnosis_description: Mapped[str] = mapped_column(sa.Text(), nullable=False)
    # CUPS code for the consultation type
    cups_code: Mapped[str] = mapped_column(sa.String(10), nullable=False)
    consultation_reason: Mapped[str] = mapped_column(sa.Text(), nullable=False)
    intervention: Mapped[str] = mapped_column(sa.Text(), nullable=False)
    evolution: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    next_session_plan: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    # Fee in COP integer — Res. 2275/2023
    session_fee: Mapped[int] = mapped_column(sa.Integer(), nullable=False)
    authorization_number: Mapped[str | None] = mapped_column(
        sa.String(30), nullable=True
    )
    status: Mapped[str] = mapped_column(
        sa.Enum("draft", "signed", name="session_status"),
        nullable=False,
        server_default=sa.text("'draft'"),
    )
    # SHA-256 of clinical content + timestamp — computed at signing
    session_hash: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)
    signed_at: Mapped[datetime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=True
    )
    rips_included: Mapped[bool] = mapped_column(
        sa.Boolean(), nullable=False, server_default=sa.text("false")
    )


class SessionNote(Base, UUIDPrimaryKey, TenantMixin):
    """Append-only clarification note added after a session is signed.

    No updated_at — modifications are forbidden by Res. 1995/1999.
    """

    __tablename__ = "session_notes"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    content: Mapped[str] = mapped_column(sa.Text(), nullable=False)
    # SHA-256(session_id + content + created_at.isoformat())
    note_hash: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
```

- [ ] **Step 2: Actualizar `app/models/__init__.py`**

```python
from app.models.base import Base
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.session import Session, SessionNote

__all__ = ["Base", "Patient", "Appointment", "Session", "SessionNote"]
```

- [ ] **Step 3: Verificar que los modelos importan sin error**

```bash
cd psicogest/backend
.venv/Scripts/python -c "from app.models.session import Session, SessionNote; print('OK')"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add psicogest/backend/app/models/session.py psicogest/backend/app/models/__init__.py
git commit -m "feat(sprint5): Session + SessionNote SQLAlchemy models"
```

---

### Task 2: Session Pydantic schemas

**Files:**
- Create: `psicogest/backend/app/schemas/session.py`

- [ ] **Step 1: Crear `app/schemas/session.py`**

```python
"""Pydantic schemas for session endpoints — clinical notes (Res. 1995/1999)."""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class SessionCreate(BaseModel):
    appointment_id: uuid.UUID
    patient_id: uuid.UUID
    actual_start: datetime
    actual_end: datetime
    diagnosis_cie11: str = Field(..., max_length=20)
    diagnosis_description: str = Field(..., min_length=5)
    cups_code: str = Field(..., max_length=10)
    consultation_reason: str = Field(..., min_length=10)
    intervention: str = Field(..., min_length=10)
    evolution: str | None = None
    next_session_plan: str | None = None
    session_fee: int = Field(..., ge=0)
    authorization_number: str | None = Field(None, max_length=30)

    @model_validator(mode="after")
    def end_after_start(self) -> "SessionCreate":
        if self.actual_end <= self.actual_start:
            raise ValueError("actual_end must be after actual_start")
        return self


class SessionUpdate(BaseModel):
    actual_start: datetime | None = None
    actual_end: datetime | None = None
    diagnosis_cie11: str | None = Field(None, max_length=20)
    diagnosis_description: str | None = Field(None, min_length=5)
    cups_code: str | None = Field(None, max_length=10)
    consultation_reason: str | None = Field(None, min_length=10)
    intervention: str | None = Field(None, min_length=10)
    evolution: str | None = None
    next_session_plan: str | None = None
    session_fee: int | None = Field(None, ge=0)
    authorization_number: str | None = Field(None, max_length=30)

    @model_validator(mode="after")
    def end_after_start(self) -> "SessionUpdate":
        if self.actual_start and self.actual_end:
            if self.actual_end <= self.actual_start:
                raise ValueError("actual_end must be after actual_start")
        return self


class SessionSummary(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    appointment_id: uuid.UUID
    patient_id: uuid.UUID
    actual_start: datetime
    actual_end: datetime
    diagnosis_cie11: str
    cups_code: str
    session_fee: int
    status: str
    created_at: datetime


class SessionDetail(SessionSummary):
    diagnosis_description: str
    consultation_reason: str
    intervention: str
    evolution: str | None
    next_session_plan: str | None
    authorization_number: str | None
    session_hash: str | None
    signed_at: datetime | None
    rips_included: bool
    updated_at: datetime


class PaginatedSessions(BaseModel):
    items: list[SessionSummary]
    total: int
    page: int
    page_size: int
    pages: int


class SessionNoteCreate(BaseModel):
    content: str = Field(..., min_length=5, max_length=5000)


class SessionNoteDetail(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    session_id: uuid.UUID
    content: str
    note_hash: str
    created_at: datetime
```

- [ ] **Step 2: Verificar que los schemas importan sin error**

```bash
.venv/Scripts/python -c "from app.schemas.session import SessionCreate, SessionDetail, SessionNoteDetail; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add psicogest/backend/app/schemas/session.py
git commit -m "feat(sprint5): Session Pydantic schemas"
```

---

### Task 3: AppointmentService — complete() y mark_noshow() + tests

**Files:**
- Modify: `psicogest/backend/app/services/appointment_service.py`
- Modify: `psicogest/backend/tests/test_appointments.py`

- [ ] **Step 1: Escribir los tests fallidos**

Abrir `psicogest/backend/tests/test_appointments.py` y añadir al final del archivo (después del último test existente):

```python
def test_complete_changes_status_to_completed(svc):
    appt = svc.create({
        "patient_id": PATIENT_ID,
        "scheduled_start": _dt(10),
        "scheduled_end": _dt(11),
        "session_type": "individual",
        "modality": "presential",
        "notes": None,
    })
    result = svc.complete(str(appt.id))
    assert result.status == "completed"


def test_complete_raises_if_not_scheduled(svc):
    appt = svc.create({
        "patient_id": PATIENT_ID,
        "scheduled_start": _dt(11),
        "scheduled_end": _dt(12),
        "session_type": "individual",
        "modality": "presential",
        "notes": None,
    })
    svc.cancel(str(appt.id), cancelled_by="psychologist", reason="Test cancel")
    with pytest.raises(ValueError, match="Solo se pueden completar"):
        svc.complete(str(appt.id))


def test_mark_noshow_changes_status(svc):
    appt = svc.create({
        "patient_id": PATIENT_ID,
        "scheduled_start": _dt(12),
        "scheduled_end": _dt(13),
        "session_type": "followup",
        "modality": "virtual",
        "notes": None,
    })
    result = svc.mark_noshow(str(appt.id))
    assert result.status == "noshow"


def test_mark_noshow_raises_if_not_scheduled(svc):
    appt = svc.create({
        "patient_id": PATIENT_ID,
        "scheduled_start": _dt(13),
        "scheduled_end": _dt(14),
        "session_type": "couple",
        "modality": "presential",
        "notes": None,
    })
    svc.complete(str(appt.id))
    with pytest.raises(ValueError, match="Solo se pueden marcar"):
        svc.mark_noshow(str(appt.id))
```

- [ ] **Step 2: Ejecutar tests para verificar que fallan**

```bash
cd psicogest/backend
.venv/Scripts/pytest tests/test_appointments.py -v -k "complete or noshow"
```
Expected: `FAILED` con `AttributeError: 'AppointmentService' object has no attribute 'complete'`

- [ ] **Step 3: Añadir complete() y mark_noshow() al servicio**

Abrir `psicogest/backend/app/services/appointment_service.py` y añadir al final de la clase `AppointmentService` (después del método `cancel`):

```python
    def complete(self, appointment_id: str) -> Appointment:
        """Mark appointment as completed. Raises ValueError if not scheduled."""
        appt = self.get_by_id(appointment_id)
        if appt.status != "scheduled":
            raise ValueError(
                f"Solo se pueden completar citas en estado 'scheduled'. Estado actual: {appt.status}"
            )
        appt.status = "completed"
        self.db.flush()
        self.db.refresh(appt)
        return appt

    def mark_noshow(self, appointment_id: str) -> Appointment:
        """Mark appointment as noshow. Raises ValueError if not scheduled."""
        appt = self.get_by_id(appointment_id)
        if appt.status != "scheduled":
            raise ValueError(
                f"Solo se pueden marcar como no-show citas en estado 'scheduled'. Estado actual: {appt.status}"
            )
        appt.status = "noshow"
        self.db.flush()
        self.db.refresh(appt)
        return appt
```

- [ ] **Step 4: Ejecutar tests para verificar que pasan**

```bash
.venv/Scripts/pytest tests/test_appointments.py -v
```
Expected: `11 passed` (7 originales + 4 nuevos)

- [ ] **Step 5: Commit**

```bash
git add psicogest/backend/app/services/appointment_service.py psicogest/backend/tests/test_appointments.py
git commit -m "feat(sprint5): AppointmentService.complete() + mark_noshow() with tests"
```

---

### Task 4: SessionService — CRUD + sign

**Files:**
- Create: `psicogest/backend/app/services/session_service.py`
- Create: `psicogest/backend/tests/test_sessions.py` (primera parte)

- [ ] **Step 1: Escribir los tests fallidos**

Crear `psicogest/backend/tests/test_sessions.py`:

```python
"""Tests for SessionService — CRUD, sign, immutability, append-only notes."""
import hashlib
import uuid
from datetime import datetime, timezone, timedelta

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session as DBSession

from app.models.session import Session, SessionNote
from app.services.session_service import (
    SessionService,
    SessionNotFoundError,
    SessionAlreadySignedError,
)


TENANT_ID = str(uuid.uuid4())
PATIENT_ID = str(uuid.uuid4())
APPOINTMENT_ID = str(uuid.uuid4())


@pytest.fixture(scope="session")
def engine():
    """SQLite in-memory — Session and SessionNote tables only (no FK enforcement)."""
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Session.__table__.create(eng, checkfirst=True)
    SessionNote.__table__.create(eng, checkfirst=True)
    return eng


@pytest.fixture
def db(engine):
    with engine.connect() as conn:
        conn.execute(text("PRAGMA journal_mode=WAL"))
        with DBSession(conn) as session:
            yield session
            session.rollback()


@pytest.fixture
def svc(db):
    return SessionService(db, TENANT_ID)


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _session_data(**kwargs) -> dict:
    start = kwargs.pop("start", _now() - timedelta(hours=1))
    end = kwargs.pop("end", start + timedelta(minutes=50))
    return {
        "appointment_id": APPOINTMENT_ID,
        "patient_id": PATIENT_ID,
        "actual_start": start,
        "actual_end": end,
        "diagnosis_cie11": "6A70",
        "diagnosis_description": "Trastorno depresivo recurrente",
        "cups_code": "890403",
        "consultation_reason": "Paciente refiere tristeza persistente",
        "intervention": "Terapia cognitivo-conductual, técnicas de activación conductual",
        "evolution": "Mejoría progresiva",
        "next_session_plan": "Continuar con exposición gradual",
        "session_fee": 150000,
        "authorization_number": None,
        **kwargs,
    }


# ---- CRUD tests ----

def test_create_returns_draft_session(svc):
    sess = svc.create(_session_data())
    assert sess.id is not None
    assert sess.status == "draft"
    assert sess.session_hash is None
    assert sess.signed_at is None


def test_get_by_id_returns_session(svc):
    sess = svc.create(_session_data())
    fetched = svc.get_by_id(str(sess.id))
    assert fetched.id == sess.id


def test_get_by_id_wrong_tenant_raises(db):
    other_svc = SessionService(db, str(uuid.uuid4()))
    svc = SessionService(db, TENANT_ID)
    sess = svc.create(_session_data())
    with pytest.raises(SessionNotFoundError):
        other_svc.get_by_id(str(sess.id))


def test_update_draft_changes_fields(svc):
    sess = svc.create(_session_data())
    updated = svc.update(str(sess.id), {"diagnosis_cie11": "6A71", "session_fee": 200000})
    assert updated.diagnosis_cie11 == "6A71"
    assert updated.session_fee == 200000


def test_update_signed_raises(svc):
    sess = svc.create(_session_data())
    svc.sign(str(sess.id))
    with pytest.raises(SessionAlreadySignedError):
        svc.update(str(sess.id), {"session_fee": 999})


# ---- Sign tests ----

def test_sign_sets_status_and_hash(svc):
    sess = svc.create(_session_data())
    signed = svc.sign(str(sess.id))
    assert signed.status == "signed"
    assert signed.session_hash is not None
    assert len(signed.session_hash) == 64  # SHA-256 hex
    assert signed.signed_at is not None


def test_sign_hash_is_reproducible(svc):
    """Same content must always produce the same hash."""
    data = _session_data()
    sess = svc.create(data)
    signed = svc.sign(str(sess.id))
    # Recompute the hash manually using the same algorithm
    content = "".join([
        str(signed.id),
        signed.actual_start.isoformat(),
        signed.actual_end.isoformat(),
        signed.diagnosis_cie11,
        signed.diagnosis_description,
        signed.cups_code,
        signed.consultation_reason,
        signed.intervention,
        signed.evolution or "",
        signed.next_session_plan or "",
        str(signed.session_fee),
        signed.authorization_number or "",
    ])
    expected_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
    assert signed.session_hash == expected_hash


def test_sign_already_signed_raises(svc):
    sess = svc.create(_session_data())
    svc.sign(str(sess.id))
    with pytest.raises(SessionAlreadySignedError):
        svc.sign(str(sess.id))


# ---- List tests ----

def test_list_by_patient_returns_sessions(svc):
    fresh_patient = str(uuid.uuid4())
    data = _session_data()
    data["patient_id"] = fresh_patient
    svc.create(data)
    results = svc.list_by_patient(fresh_patient)
    assert len(results) >= 1
    assert all(str(r.patient_id) == fresh_patient for r in results)


def test_list_paginated_filters_by_status(svc):
    fresh_patient = str(uuid.uuid4())
    data = _session_data()
    data["patient_id"] = fresh_patient
    sess = svc.create(data)
    svc.sign(str(sess.id))

    paginated = svc.list_paginated(status="signed")
    signed_ids = [str(r.id) for r in paginated.items]
    assert str(sess.id) in signed_ids


# ---- Notes tests ----

def test_add_note_creates_with_hash(svc):
    sess = svc.create(_session_data())
    note = svc.add_note(str(sess.id), "Aclaración adicional sobre la intervención")
    assert note.id is not None
    assert note.note_hash is not None
    assert len(note.note_hash) == 64


def test_list_notes_returns_notes_for_session(svc):
    sess = svc.create(_session_data())
    svc.add_note(str(sess.id), "Primera nota aclaratoria")
    svc.add_note(str(sess.id), "Segunda nota aclaratoria")
    notes = svc.list_notes(str(sess.id))
    assert len(notes) >= 2
```

- [ ] **Step 2: Ejecutar tests para verificar que fallan**

```bash
.venv/Scripts/pytest tests/test_sessions.py -v
```
Expected: `ERROR` con `ModuleNotFoundError: No module named 'app.services.session_service'`

- [ ] **Step 3: Implementar SessionService**

Crear `psicogest/backend/app/services/session_service.py`:

```python
"""Session business logic: CRUD, sign (immutable), append-only notes.

Signed sessions are immutable by law (Res. 1995/1999). The sign() method
computes a SHA-256 hash of all clinical fields and stores it with the
server timestamp. No field can be modified after signing.

SessionNote records are append-only — they can be added but never modified.
"""
from __future__ import annotations

import hashlib
import math
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session as DBSession

from app.models.session import Session, SessionNote
from app.schemas.session import PaginatedSessions, SessionSummary


class SessionNotFoundError(Exception):
    pass


class SessionAlreadySignedError(Exception):
    pass


class SessionService:
    """All session operations for a single authenticated tenant."""

    def __init__(self, db: DBSession, tenant_id: str) -> None:
        self.db = db
        self.tenant_id = tenant_id

    def _tenant_uuid(self) -> uuid.UUID:
        return uuid.UUID(self.tenant_id)

    def get_by_id(self, session_id: str) -> Session:
        """Fetch session. Raises SessionNotFoundError if missing or wrong tenant."""
        sess = self.db.get(Session, uuid.UUID(session_id))
        if not sess or sess.tenant_id != self._tenant_uuid():
            raise SessionNotFoundError(f"Sesión {session_id} no encontrada.")
        return sess

    def create(self, data: dict) -> Session:
        """Create a draft session."""
        appointment_id = data["appointment_id"]
        if isinstance(appointment_id, str):
            appointment_id = uuid.UUID(appointment_id)

        patient_id = data["patient_id"]
        if isinstance(patient_id, str):
            patient_id = uuid.UUID(patient_id)

        sess = Session(
            id=uuid.uuid4(),
            tenant_id=self._tenant_uuid(),
            appointment_id=appointment_id,
            patient_id=patient_id,
            actual_start=data["actual_start"],
            actual_end=data["actual_end"],
            diagnosis_cie11=data["diagnosis_cie11"],
            diagnosis_description=data["diagnosis_description"],
            cups_code=data["cups_code"],
            consultation_reason=data["consultation_reason"],
            intervention=data["intervention"],
            evolution=data.get("evolution"),
            next_session_plan=data.get("next_session_plan"),
            session_fee=data["session_fee"],
            authorization_number=data.get("authorization_number"),
            status="draft",
        )
        self.db.add(sess)
        self.db.flush()
        self.db.refresh(sess)
        return sess

    def update(self, session_id: str, data: dict) -> Session:
        """Update draft session. Raises SessionAlreadySignedError if signed."""
        sess = self.get_by_id(session_id)
        if sess.status == "signed":
            raise SessionAlreadySignedError(
                "No se puede editar una sesión firmada (Res. 1995/1999)."
            )
        allowed = {
            "actual_start", "actual_end", "diagnosis_cie11", "diagnosis_description",
            "cups_code", "consultation_reason", "intervention", "evolution",
            "next_session_plan", "session_fee", "authorization_number",
        }
        for key, value in data.items():
            if key in allowed:
                setattr(sess, key, value)
        self.db.flush()
        self.db.refresh(sess)
        return sess

    def sign(self, session_id: str) -> Session:
        """Sign session — immutable after this call.

        Computes SHA-256 of all clinical fields concatenated and stores it
        with the server timestamp. Raises SessionAlreadySignedError if already signed.
        """
        sess = self.get_by_id(session_id)
        if sess.status == "signed":
            raise SessionAlreadySignedError("La sesión ya está firmada.")

        content = "".join([
            str(sess.id),
            sess.actual_start.isoformat(),
            sess.actual_end.isoformat(),
            sess.diagnosis_cie11,
            sess.diagnosis_description,
            sess.cups_code,
            sess.consultation_reason,
            sess.intervention,
            sess.evolution or "",
            sess.next_session_plan or "",
            str(sess.session_fee),
            sess.authorization_number or "",
        ])
        sess.session_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
        sess.signed_at = datetime.now(tz=timezone.utc)
        sess.status = "signed"
        self.db.flush()
        self.db.refresh(sess)
        return sess

    def list_by_patient(
        self,
        patient_id: str,
        *,
        status: str | None = None,
    ) -> list[Session]:
        """Return all sessions for a patient, newest first."""
        query = self.db.query(Session).filter(
            Session.tenant_id == self._tenant_uuid(),
            Session.patient_id == uuid.UUID(patient_id),
        )
        if status:
            query = query.filter(Session.status == status)
        return query.order_by(Session.actual_start.desc()).all()

    def list_paginated(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        patient_id: str | None = None,
        status: str | None = None,
    ) -> PaginatedSessions:
        """Paginated session list, optionally filtered."""
        page_size = min(page_size, 100)
        offset = (page - 1) * page_size

        query = self.db.query(Session).filter(
            Session.tenant_id == self._tenant_uuid()
        )
        if patient_id:
            query = query.filter(Session.patient_id == uuid.UUID(patient_id))
        if status:
            query = query.filter(Session.status == status)

        total = query.count()
        rows = (
            query.order_by(Session.actual_start.desc())
            .limit(page_size)
            .offset(offset)
            .all()
        )
        items = [SessionSummary.model_validate(r) for r in rows]
        return PaginatedSessions(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            pages=math.ceil(total / page_size) if total > 0 else 1,
        )

    def add_note(self, session_id: str, content: str) -> SessionNote:
        """Append a clarification note to a session (allowed on draft and signed)."""
        sess = self.get_by_id(session_id)
        created_at = datetime.now(tz=timezone.utc)
        note_hash = hashlib.sha256(
            f"{str(sess.id)}{content}{created_at.isoformat()}".encode("utf-8")
        ).hexdigest()
        note = SessionNote(
            id=uuid.uuid4(),
            tenant_id=self._tenant_uuid(),
            session_id=sess.id,
            content=content,
            note_hash=note_hash,
        )
        self.db.add(note)
        self.db.flush()
        self.db.refresh(note)
        return note

    def list_notes(self, session_id: str) -> list[SessionNote]:
        """List all notes for a session, oldest first."""
        self.get_by_id(session_id)  # validates tenant ownership
        return (
            self.db.query(SessionNote)
            .filter(
                SessionNote.tenant_id == self._tenant_uuid(),
                SessionNote.session_id == uuid.UUID(session_id),
            )
            .order_by(SessionNote.created_at)
            .all()
        )
```

- [ ] **Step 4: Ejecutar tests para verificar que pasan**

```bash
.venv/Scripts/pytest tests/test_sessions.py -v
```
Expected: `14 passed`

- [ ] **Step 5: Commit**

```bash
git add psicogest/backend/app/services/session_service.py psicogest/backend/tests/test_sessions.py
git commit -m "feat(sprint5): SessionService — CRUD, sign, notes with 14 tests"
```

---

### Task 5: Sessions API router + appointment complete/noshow endpoints

**Files:**
- Create: `psicogest/backend/app/api/v1/sessions.py`
- Modify: `psicogest/backend/app/api/v1/appointments.py`
- Modify: `psicogest/backend/app/main.py`

- [ ] **Step 1: Crear `app/api/v1/sessions.py`**

```python
"""Sessions router — clinical notes CRUD, sign, and append-only notes."""
import math
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.deps import get_tenant_db, TenantDB
from app.schemas.session import (
    PaginatedSessions,
    SessionCreate,
    SessionDetail,
    SessionNoteCreate,
    SessionNoteDetail,
    SessionSummary,
    SessionUpdate,
)
from app.services.session_service import (
    SessionAlreadySignedError,
    SessionNotFoundError,
    SessionService,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _service(ctx: TenantDB) -> SessionService:
    return SessionService(ctx.db, ctx.tenant.tenant_id)


@router.get("", response_model=PaginatedSessions)
def list_sessions(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    patient_id: str | None = Query(None),
    session_status: str | None = Query(None, alias="status"),
) -> PaginatedSessions:
    return _service(ctx).list_paginated(
        page=page, page_size=page_size, patient_id=patient_id, status=session_status
    )


@router.post("", response_model=SessionDetail, status_code=status.HTTP_201_CREATED)
def create_session(
    body: SessionCreate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> SessionDetail:
    sess = _service(ctx).create(body.model_dump())
    ctx.db.commit()
    ctx.db.refresh(sess)
    return SessionDetail.model_validate(sess)


@router.get("/{session_id}", response_model=SessionDetail)
def get_session(
    session_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> SessionDetail:
    try:
        return SessionDetail.model_validate(_service(ctx).get_by_id(session_id))
    except SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada.")


@router.put("/{session_id}", response_model=SessionDetail)
def update_session(
    session_id: str,
    body: SessionUpdate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> SessionDetail:
    try:
        sess = _service(ctx).update(session_id, body.model_dump(exclude_none=True))
        ctx.db.commit()
        ctx.db.refresh(sess)
        return SessionDetail.model_validate(sess)
    except SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada.")
    except SessionAlreadySignedError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.post("/{session_id}/sign", response_model=SessionDetail)
def sign_session(
    session_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> SessionDetail:
    try:
        sess = _service(ctx).sign(session_id)
        ctx.db.commit()
        ctx.db.refresh(sess)
        return SessionDetail.model_validate(sess)
    except SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada.")
    except SessionAlreadySignedError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.post("/{session_id}/notes", response_model=SessionNoteDetail, status_code=status.HTTP_201_CREATED)
def add_note(
    session_id: str,
    body: SessionNoteCreate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> SessionNoteDetail:
    try:
        note = _service(ctx).add_note(session_id, body.content)
        ctx.db.commit()
        ctx.db.refresh(note)
        return SessionNoteDetail.model_validate(note)
    except SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada.")


@router.get("/{session_id}/notes", response_model=list[SessionNoteDetail])
def list_notes(
    session_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> list[SessionNoteDetail]:
    try:
        notes = _service(ctx).list_notes(session_id)
        return [SessionNoteDetail.model_validate(n) for n in notes]
    except SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada.")
```

- [ ] **Step 2: Añadir complete/noshow endpoints a appointments.py**

Abrir `psicogest/backend/app/api/v1/appointments.py` y añadir al final del archivo (después del endpoint `cancel_appointment`):

```python

@router.post("/{appointment_id}/complete", response_model=AppointmentDetail)
def complete_appointment(
    appointment_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> AppointmentDetail:
    try:
        appt = _service(ctx).complete(appointment_id)
        ctx.db.commit()
        ctx.db.refresh(appt)
        return AppointmentDetail.model_validate(appt)
    except AppointmentNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada.")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/{appointment_id}/noshow", response_model=AppointmentDetail)
def noshow_appointment(
    appointment_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> AppointmentDetail:
    try:
        appt = _service(ctx).mark_noshow(appointment_id)
        ctx.db.commit()
        ctx.db.refresh(appt)
        return AppointmentDetail.model_validate(appt)
    except AppointmentNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada.")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
```

- [ ] **Step 3: Registrar sessions_router en main.py**

Abrir `psicogest/backend/app/main.py` y añadir la importación e `include_router`. El archivo final debe quedar:

```python
"""FastAPI application factory for psyque app backend."""
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.auth_routes import router as auth_router
from app.api.v1.health import router as health_router
from app.api.v1.appointments import router as appointments_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.patients import router as patients_router
from app.api.v1.sessions import router as sessions_router
from app.core.config import settings
from app.core.database import SessionLocal
from app.jobs.reminders import run_reminder_check


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        run_reminder_check,
        "interval",
        minutes=15,
        kwargs={"session_factory": SessionLocal},
        id="reminder_check",
    )
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(
    title="psyque app API",
    description="Sistema de gestión clínica para psicólogos independientes en Colombia",
    version="1.0.0",
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
    lifespan=lifespan,
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
app.include_router(auth_router, prefix="/api/v1")
app.include_router(patients_router, prefix="/api/v1")
app.include_router(appointments_router, prefix="/api/v1")
app.include_router(sessions_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
```

- [ ] **Step 4: Verificar que el app importa y las rutas están registradas**

```bash
.venv/Scripts/python -c "
from app.main import app
routes = [r.path for r in app.routes]
assert '/api/v1/sessions' in routes, f'Missing /sessions. Got: {routes}'
assert any('/complete' in r for r in routes), 'Missing /complete endpoint'
print('OK — sessions router y complete/noshow registrados')
"
```
Expected: `OK — sessions router y complete/noshow registrados`

- [ ] **Step 5: Ejecutar todos los tests del backend**

```bash
.venv/Scripts/pytest tests/test_appointments.py tests/test_sessions.py tests/test_dashboard.py tests/test_email_service.py tests/test_reminders.py -q
```
Expected: `41 passed`

- [ ] **Step 6: Commit**

```bash
git add psicogest/backend/app/api/v1/sessions.py psicogest/backend/app/api/v1/appointments.py psicogest/backend/app/main.py
git commit -m "feat(sprint5): sessions router + appointment complete/noshow endpoints"
```

---

### Task 6: Frontend — api.ts types + hooks

**Files:**
- Modify: `psicogest/frontend/src/lib/api.ts`
- Create: `psicogest/frontend/src/hooks/useSessions.ts`

- [ ] **Step 1: Añadir tipos y métodos de sessions a api.ts**

Abrir `psicogest/frontend/src/lib/api.ts`. Después de la sección `// --- Dashboard ---`, añadir:

```typescript
// --- Sessions ----------------------------------------------------------------

export type SessionStatus = "draft" | "signed";

export interface SessionSummary {
  id: string;
  appointment_id: string;
  patient_id: string;
  actual_start: string;
  actual_end: string;
  diagnosis_cie11: string;
  cups_code: string;
  session_fee: number;
  status: SessionStatus;
  created_at: string;
}

export interface SessionDetail extends SessionSummary {
  diagnosis_description: string;
  consultation_reason: string;
  intervention: string;
  evolution: string | null;
  next_session_plan: string | null;
  authorization_number: string | null;
  session_hash: string | null;
  signed_at: string | null;
  rips_included: boolean;
  updated_at: string;
}

export interface PaginatedSessions {
  items: SessionSummary[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface SessionCreatePayload {
  appointment_id: string;
  patient_id: string;
  actual_start: string;
  actual_end: string;
  diagnosis_cie11: string;
  diagnosis_description: string;
  cups_code: string;
  consultation_reason: string;
  intervention: string;
  evolution?: string;
  next_session_plan?: string;
  session_fee: number;
  authorization_number?: string;
}

export interface SessionUpdatePayload {
  actual_start?: string;
  actual_end?: string;
  diagnosis_cie11?: string;
  diagnosis_description?: string;
  cups_code?: string;
  consultation_reason?: string;
  intervention?: string;
  evolution?: string;
  next_session_plan?: string;
  session_fee?: number;
  authorization_number?: string;
}

export interface SessionNoteDetail {
  id: string;
  session_id: string;
  content: string;
  note_hash: string;
  created_at: string;
}
```

Y dentro del objeto `api`, añadir la clave `sessions` (después de `dashboard`):

```typescript
  sessions: {
    list: (params?: { page?: number; page_size?: number; patient_id?: string; status?: string }) => {
      const q = new URLSearchParams();
      if (params?.page) q.set("page", String(params.page));
      if (params?.page_size) q.set("page_size", String(params.page_size));
      if (params?.patient_id) q.set("patient_id", params.patient_id);
      if (params?.status) q.set("status", params.status);
      return request<PaginatedSessions>("GET", `/sessions?${q}`);
    },
    create: (body: SessionCreatePayload) =>
      request<SessionDetail>("POST", "/sessions", body),
    get: (id: string) =>
      request<SessionDetail>("GET", `/sessions/${id}`),
    update: (id: string, body: SessionUpdatePayload) =>
      request<SessionDetail>("PUT", `/sessions/${id}`, body),
    sign: (id: string) =>
      request<SessionDetail>("POST", `/sessions/${id}/sign`),
    addNote: (id: string, content: string) =>
      request<SessionNoteDetail>("POST", `/sessions/${id}/notes`, { content }),
    listNotes: (id: string) =>
      request<SessionNoteDetail[]>("GET", `/sessions/${id}/notes`),
  },
  appointments_status: {
    complete: (id: string) =>
      request<AppointmentDetail>("POST", `/appointments/${id}/complete`),
    noshow: (id: string) =>
      request<AppointmentDetail>("POST", `/appointments/${id}/noshow`),
  },
```

- [ ] **Step 2: Crear `src/hooks/useSessions.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type SessionCreatePayload,
  type SessionUpdatePayload,
} from "@/lib/api";

export function useSessions(params?: {
  page?: number;
  page_size?: number;
  patient_id?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ["sessions", "list", params],
    queryFn: () => api.sessions.list(params),
  });
}

export function useSession(id: string) {
  return useQuery({
    queryKey: ["session", id],
    queryFn: () => api.sessions.get(id),
    enabled: !!id,
  });
}

export function useSessionNotes(sessionId: string) {
  return useQuery({
    queryKey: ["session", sessionId, "notes"],
    queryFn: () => api.sessions.listNotes(sessionId),
    enabled: !!sessionId,
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SessionCreatePayload) => api.sessions.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });
}

export function useUpdateSession(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SessionUpdatePayload) => api.sessions.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["session", id] });
    },
  });
}

export function useSignSession(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.sessions.sign(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["session", id] });
    },
  });
}

export function useAddSessionNote(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api.sessions.addNote(sessionId, content),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["session", sessionId, "notes"] }),
  });
}

export function useCompleteAppointment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.appointments_status.complete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["appointment", id] });
    },
  });
}

export function useNoshowAppointment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.appointments_status.noshow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["appointment", id] });
    },
  });
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd psicogest/frontend
npx tsc --noEmit
```
Expected: sin errores

- [ ] **Step 4: Commit**

```bash
git add psicogest/frontend/src/lib/api.ts psicogest/frontend/src/hooks/useSessions.ts
git commit -m "feat(sprint5): sessions API types + React Query hooks"
```

---

### Task 7: AppointmentSidebar — botones Completar y No asistió

**Files:**
- Modify: `psicogest/frontend/src/components/appointments/AppointmentSidebar.tsx`

- [ ] **Step 1: Reemplazar el contenido completo de AppointmentSidebar.tsx**

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAppointment, useCancelAppointment } from "@/hooks/useAppointments";
import { useCompleteAppointment, useNoshowAppointment } from "@/hooks/useSessions";
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
  const navigate = useNavigate();
  const { data: appt, isLoading } = useAppointment(appointmentId);
  const cancelMutation = useCancelAppointment(appointmentId);
  const completeMutation = useCompleteAppointment(appointmentId);
  const noshowMutation = useNoshowAppointment(appointmentId);

  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelledBy, setCancelledBy] = useState<CancelledBy>("psychologist");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
      setCancelError(err instanceof ApiError ? err.message : "Error al cancelar la cita.");
    }
  };

  const handleComplete = async () => {
    setActionError(null);
    try {
      await completeMutation.mutateAsync();
      navigate(`/sessions/new?appointment_id=${appointmentId}&patient_id=${appt.patient_id}&start=${encodeURIComponent(appt.scheduled_start)}&end=${encodeURIComponent(appt.scheduled_end)}`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Error al completar la cita.");
    }
  };

  const handleNoshow = async () => {
    setActionError(null);
    try {
      await noshowMutation.mutateAsync();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Error al marcar como no asistió.");
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

        {actionError && <p className="text-xs text-[#E74C3C]">{actionError}</p>}

        {appt.status === "scheduled" && !showCancelForm && (
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              className="bg-[#27AE60] hover:bg-green-700 text-white"
              onClick={handleComplete}
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending ? "Procesando..." : "✓ Completar y registrar sesión"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-amber-700 border-amber-400 hover:bg-amber-50"
              onClick={handleNoshow}
              disabled={noshowMutation.isPending}
            >
              {noshowMutation.isPending ? "Procesando..." : "No asistió"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-[#E74C3C] border-[#E74C3C] hover:bg-red-50"
              onClick={() => setShowCancelForm(true)}
            >
              Cancelar cita
            </Button>
          </div>
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

- [ ] **Step 2: Verificar TypeScript**

```bash
cd psicogest/frontend && npx tsc --noEmit
```
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add psicogest/frontend/src/components/appointments/AppointmentSidebar.tsx
git commit -m "feat(sprint5): AppointmentSidebar — Completar y No asistió buttons"
```

---

### Task 8: SessionForm component

**Files:**
- Create: `psicogest/frontend/src/components/sessions/SessionForm.tsx`

- [ ] **Step 1: Crear `src/components/sessions/SessionForm.tsx`**

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SessionCreatePayload } from "@/lib/api";

interface Props {
  defaultAppointmentId?: string;
  defaultPatientId?: string;
  defaultStart?: string;
  defaultEnd?: string;
  onSubmit: (payload: SessionCreatePayload) => void;
  isSubmitting: boolean;
  error?: string | null;
}

const CUPS_OPTIONS = [
  { code: "890101", label: "890101 — Consulta de primera vez psicología" },
  { code: "890102", label: "890102 — Consulta de control psicología" },
  { code: "890403", label: "890403 — Psicoterapia individual adultos" },
  { code: "890404", label: "890404 — Psicoterapia individual niños/adolescentes" },
  { code: "890601", label: "890601 — Psicoterapia de pareja" },
  { code: "890701", label: "890701 — Psicoterapia familiar" },
];

function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SessionForm({
  defaultAppointmentId = "",
  defaultPatientId = "",
  defaultStart,
  defaultEnd,
  onSubmit,
  isSubmitting,
  error,
}: Props) {
  const [diagnosisCie11, setDiagnosisCie11] = useState("");
  const [diagnosisDesc, setDiagnosisDesc] = useState("");
  const [cupsCode, setCupsCode] = useState("890403");
  const [reason, setReason] = useState("");
  const [intervention, setIntervention] = useState("");
  const [evolution, setEvolution] = useState("");
  const [nextPlan, setNextPlan] = useState("");
  const [fee, setFee] = useState("150000");
  const [authNumber, setAuthNumber] = useState("");
  const [actualStart, setActualStart] = useState(
    defaultStart ? toLocalDatetimeValue(defaultStart) : ""
  );
  const [actualEnd, setActualEnd] = useState(
    defaultEnd ? toLocalDatetimeValue(defaultEnd) : ""
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      appointment_id: defaultAppointmentId,
      patient_id: defaultPatientId,
      actual_start: new Date(actualStart).toISOString(),
      actual_end: new Date(actualEnd).toISOString(),
      diagnosis_cie11: diagnosisCie11,
      diagnosis_description: diagnosisDesc,
      cups_code: cupsCode,
      consultation_reason: reason,
      intervention,
      evolution: evolution || undefined,
      next_session_plan: nextPlan || undefined,
      session_fee: parseInt(fee, 10),
      authorization_number: authNumber || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-[#E74C3C]" role="alert">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Inicio real</label>
          <Input type="datetime-local" value={actualStart} onChange={(e) => setActualStart(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Fin real</label>
          <Input type="datetime-local" value={actualEnd} onChange={(e) => setActualEnd(e.target.value)} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">
            Diagnóstico CIE-11 <span className="text-[#E74C3C]">*</span>
          </label>
          <Input
            value={diagnosisCie11}
            onChange={(e) => setDiagnosisCie11(e.target.value.toUpperCase())}
            placeholder="Ej: 6A70"
            required
            maxLength={20}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Código CUPS <span className="text-[#E74C3C]">*</span>
          </label>
          <select
            className="h-10 w-full rounded-md border border-input px-3 text-sm"
            value={cupsCode}
            onChange={(e) => setCupsCode(e.target.value)}
          >
            {CUPS_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Descripción del diagnóstico <span className="text-[#E74C3C]">*</span>
        </label>
        <Input
          value={diagnosisDesc}
          onChange={(e) => setDiagnosisDesc(e.target.value)}
          placeholder="Nombre completo del diagnóstico CIE-11"
          required
          minLength={5}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Motivo de consulta <span className="text-[#E74C3C]">*</span>
        </label>
        <textarea
          className="w-full rounded-md border border-input px-3 py-2 text-sm min-h-[80px]"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          minLength={10}
          placeholder="Descripción del motivo de la consulta..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Intervención realizada <span className="text-[#E74C3C]">*</span>
        </label>
        <textarea
          className="w-full rounded-md border border-input px-3 py-2 text-sm min-h-[80px]"
          value={intervention}
          onChange={(e) => setIntervention(e.target.value)}
          required
          minLength={10}
          placeholder="Técnicas y procedimientos aplicados..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Evolución (opcional)</label>
        <textarea
          className="w-full rounded-md border border-input px-3 py-2 text-sm min-h-[60px]"
          value={evolution}
          onChange={(e) => setEvolution(e.target.value)}
          placeholder="Observaciones sobre el progreso del paciente..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Plan próxima sesión (opcional)</label>
        <textarea
          className="w-full rounded-md border border-input px-3 py-2 text-sm min-h-[60px]"
          value={nextPlan}
          onChange={(e) => setNextPlan(e.target.value)}
          placeholder="Objetivos y actividades para la próxima sesión..."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">
            Valor sesión (COP) <span className="text-[#E74C3C]">*</span>
          </label>
          <Input
            type="number"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            required
            min={0}
            placeholder="150000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">N° autorización (opcional)</label>
          <Input
            value={authNumber}
            onChange={(e) => setAuthNumber(e.target.value)}
            placeholder="Para pacientes EPS"
            maxLength={30}
          />
        </div>
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          className="bg-[#2E86AB] hover:bg-[#1E3A5F] w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Guardando borrador..." : "Guardar borrador"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd psicogest/frontend && npx tsc --noEmit
```
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add psicogest/frontend/src/components/sessions/SessionForm.tsx
git commit -m "feat(sprint5): SessionForm component with CUPS + CIE-11 fields"
```

---

### Task 9: SessionDetail component

**Files:**
- Create: `psicogest/frontend/src/components/sessions/SessionDetail.tsx`

- [ ] **Step 1: Crear `src/components/sessions/SessionDetail.tsx`**

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSession, useSignSession, useSessionNotes, useAddSessionNote } from "@/hooks/useSessions";
import { ApiError } from "@/lib/api";

interface Props {
  sessionId: string;
  onBack?: () => void;
}

const CUPS_LABELS: Record<string, string> = {
  "890101": "Consulta de primera vez",
  "890102": "Consulta de control",
  "890403": "Psicoterapia individual adultos",
  "890404": "Psicoterapia individual niños/adolescentes",
  "890601": "Psicoterapia de pareja",
  "890701": "Psicoterapia familiar",
};

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="py-3 border-b last:border-0">
      <dt className="text-xs text-muted-foreground uppercase tracking-wide">{label}</dt>
      <dd className="mt-1 text-sm text-foreground whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

export function SessionDetail({ sessionId, onBack }: Props) {
  const { data: sess, isLoading } = useSession(sessionId);
  const { data: notes } = useSessionNotes(sessionId);
  const signMutation = useSignSession(sessionId);
  const addNoteMutation = useAddSessionNote(sessionId);

  const [signError, setSignError] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [showNoteForm, setShowNoteForm] = useState(false);

  if (isLoading || !sess) {
    return <div className="p-6 text-muted-foreground text-sm">Cargando sesión...</div>;
  }

  const handleSign = async () => {
    setSignError(null);
    try {
      await signMutation.mutateAsync();
    } catch (err) {
      setSignError(err instanceof ApiError ? err.message : "Error al firmar la sesión.");
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setNoteError(null);
    try {
      await addNoteMutation.mutateAsync(noteContent);
      setNoteContent("");
      setShowNoteForm(false);
    } catch (err) {
      setNoteError(err instanceof ApiError ? err.message : "Error al añadir nota.");
    }
  };

  const start = new Date(sess.actual_start);
  const end = new Date(sess.actual_end);
  const isSigned = sess.status === "signed";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {onBack && (
            <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground mb-2 block">
              ← Volver
            </button>
          )}
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[#1E3A5F]">Nota de sesión</h2>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${isSigned ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
              {isSigned ? "Firmada" : "Borrador"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {start.toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {" · "}
            {start.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })} — {end.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>

      {/* Clinical fields */}
      <div className="bg-white rounded-lg border p-5">
        <dl>
          <Field label="Diagnóstico CIE-11" value={`${sess.diagnosis_cie11} — ${sess.diagnosis_description}`} />
          <Field label="Código CUPS" value={`${sess.cups_code} — ${CUPS_LABELS[sess.cups_code] ?? sess.cups_code}`} />
          <Field label="Motivo de consulta" value={sess.consultation_reason} />
          <Field label="Intervención realizada" value={sess.intervention} />
          <Field label="Evolución" value={sess.evolution} />
          <Field label="Plan próxima sesión" value={sess.next_session_plan} />
          <Field label="Valor sesión" value={`$${sess.session_fee.toLocaleString("es-CO")} COP`} />
          <Field label="N° autorización" value={sess.authorization_number} />
        </dl>

        {isSigned && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Firmada el {new Date(sess.signed_at!).toLocaleString("es-CO")}
            </p>
            <p className="text-xs font-mono text-muted-foreground mt-1 break-all">
              SHA-256: {sess.session_hash}
            </p>
          </div>
        )}
      </div>

      {/* Sign button */}
      {!isSigned && (
        <div className="space-y-2">
          {signError && <p className="text-sm text-[#E74C3C]">{signError}</p>}
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            Al firmar, la sesión quedará <strong>inmutable</strong> según la Res. 1995/1999.
            Verifique todos los campos antes de firmar.
          </div>
          <Button
            className="bg-[#1E3A5F] hover:bg-[#2E86AB] text-white w-full"
            onClick={handleSign}
            disabled={signMutation.isPending}
          >
            {signMutation.isPending ? "Firmando..." : "✍ Firmar sesión"}
          </Button>
        </div>
      )}

      {/* Notes section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#1E3A5F]">Notas aclaratorias</h3>
          <Button size="sm" variant="outline" onClick={() => setShowNoteForm(!showNoteForm)}>
            + Añadir nota
          </Button>
        </div>

        {showNoteForm && (
          <form onSubmit={handleAddNote} className="space-y-2 border rounded-lg p-4 bg-slate-50">
            {noteError && <p className="text-xs text-[#E74C3C]">{noteError}</p>}
            <textarea
              className="w-full rounded-md border border-input px-3 py-2 text-sm min-h-[80px]"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              required
              minLength={5}
              maxLength={5000}
              placeholder="Aclaración o información adicional..."
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="bg-[#2E86AB] hover:bg-[#1E3A5F] text-white" disabled={addNoteMutation.isPending}>
                {addNoteMutation.isPending ? "Guardando..." : "Guardar nota"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowNoteForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {notes && notes.length > 0 ? (
          <div className="space-y-2">
            {notes.map((note) => (
              <div key={note.id} className="border rounded-lg p-4 bg-white">
                <p className="text-sm">{note.content}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(note.created_at).toLocaleString("es-CO")} · SHA-256: {note.note_hash.slice(0, 16)}…
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin notas aclaratorias.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd psicogest/frontend && npx tsc --noEmit
```
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add psicogest/frontend/src/components/sessions/SessionDetail.tsx
git commit -m "feat(sprint5): SessionDetail component — sign + append-only notes"
```

---

### Task 10: SessionsPage + App.tsx + PatientDetailPage sesiones tab

**Files:**
- Create: `psicogest/frontend/src/pages/sessions/SessionsPage.tsx`
- Modify: `psicogest/frontend/src/App.tsx`
- Modify: `psicogest/frontend/src/pages/patients/PatientDetailPage.tsx`

- [ ] **Step 1: Crear `src/pages/sessions/SessionsPage.tsx`**

```tsx
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSessions, useCreateSession } from "@/hooks/useSessions";
import { SessionForm } from "@/components/sessions/SessionForm";
import { SessionDetail } from "@/components/sessions/SessionDetail";
import type { SessionCreatePayload } from "@/lib/api";
import { ApiError } from "@/lib/api";

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  signed: "Firmada",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-amber-50 text-amber-700",
  signed: "bg-green-50 text-green-700",
};

export function SessionsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // URL params for pre-filling new session from appointment sidebar
  const prefilledApptId = searchParams.get("appointment_id") ?? "";
  const prefilledPatientId = searchParams.get("patient_id") ?? "";
  const prefilledStart = searchParams.get("start") ?? "";
  const prefilledEnd = searchParams.get("end") ?? "";
  const isNewMode = searchParams.get("new") !== null || !!prefilledApptId;

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data, isLoading } = useSessions({ status: statusFilter || undefined });
  const createMutation = useCreateSession();

  const handleCreate = async (payload: SessionCreatePayload) => {
    setCreateError(null);
    try {
      const sess = await createMutation.mutateAsync(payload);
      setSelectedSessionId(sess.id);
      navigate("/sessions", { replace: true });
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Error al crear la sesión.");
    }
  };

  if (selectedSessionId) {
    return (
      <div className="p-8 max-w-3xl">
        <SessionDetail
          sessionId={selectedSessionId}
          onBack={() => setSelectedSessionId(null)}
        />
      </div>
    );
  }

  if (isNewMode) {
    return (
      <div className="p-8 max-w-2xl">
        <button
          type="button"
          onClick={() => navigate("/sessions")}
          className="text-sm text-muted-foreground hover:text-foreground mb-4 block"
        >
          ← Volver a sesiones
        </button>
        <h1 className="text-2xl font-bold text-[#1E3A5F] mb-6">Nueva nota de sesión</h1>
        <SessionForm
          defaultAppointmentId={prefilledApptId}
          defaultPatientId={prefilledPatientId}
          defaultStart={prefilledStart}
          defaultEnd={prefilledEnd}
          onSubmit={handleCreate}
          isSubmitting={createMutation.isPending}
          error={createError}
        />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Sesiones</h1>
        <button
          type="button"
          onClick={() => navigate("/sessions?new")}
          className="bg-[#2E86AB] hover:bg-[#1E3A5F] text-white text-sm px-4 py-2 rounded-md"
        >
          + Nueva sesión
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          className="h-9 rounded-md border border-input px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="draft">Borradores</option>
          <option value="signed">Firmadas</option>
        </select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando...</p>}

      {!isLoading && data && data.items.length === 0 && (
        <div className="border rounded-lg p-8 text-center text-muted-foreground text-sm">
          No hay sesiones registradas.
        </div>
      )}

      {!isLoading && data && data.items.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">CIE-11</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">CUPS</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.items.map((sess) => (
                <tr
                  key={sess.id}
                  onClick={() => setSelectedSessionId(sess.id)}
                  className="hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    {new Date(sess.actual_start).toLocaleDateString("es-CO", {
                      year: "numeric", month: "short", day: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 font-mono">{sess.diagnosis_cie11}</td>
                  <td className="px-4 py-3 font-mono">{sess.cups_code}</td>
                  <td className="px-4 py-3 text-right">${sess.session_fee.toLocaleString("es-CO")}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[sess.status] ?? ""}`}>
                      {STATUS_LABELS[sess.status] ?? sess.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Actualizar App.tsx**

Abrir `psicogest/frontend/src/App.tsx` y reemplazar con:

```tsx
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PatientsPage } from "@/pages/patients/PatientsPage";
import { PatientDetailPage } from "@/pages/patients/PatientDetailPage";
import { AgendaPage } from "@/pages/agenda/AgendaPage";
import { SessionsPage } from "@/pages/sessions/SessionsPage";

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
      {/* Rutas públicas */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Rutas protegidas */}
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
        <Route path="/agenda" element={<AgendaPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/rips" element={<div className="p-8"><h1 className="text-2xl font-bold text-[#1E3A5F]">RIPS</h1><p className="text-muted-foreground mt-2">Sprint 6</p></div>} />
        <Route path="/settings" element={<div className="p-8"><h1 className="text-2xl font-bold text-[#1E3A5F]">Configuración</h1><p className="text-muted-foreground mt-2">Sprint 7</p></div>} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 3: Actualizar la pestaña "sesiones" en PatientDetailPage.tsx**

Abrir `psicogest/frontend/src/pages/patients/PatientDetailPage.tsx`.

Añadir imports al inicio del archivo (después de los imports existentes):

```tsx
import { useState as useSessionState } from "react";
import { useSessions, useCreateSession, useSignSession } from "@/hooks/useSessions";
import { SessionForm } from "@/components/sessions/SessionForm";
import { SessionDetail } from "@/components/sessions/SessionDetail";
import type { SessionCreatePayload } from "@/lib/api";
import { ApiError } from "@/lib/api";
```

Reemplazar el bloque `{activeTab === "sesiones" && ...}` (líneas 183-189) con:

```tsx
      {activeTab === "sesiones" && id && (
        <PatientSessionsTab patientId={id} />
      )}
```

Y añadir el componente `PatientSessionsTab` al final del archivo (antes de la función `calcAge`):

```tsx
function PatientSessionsTab({ patientId }: { patientId: string }) {
  const { data, isLoading } = useSessions({ patient_id: patientId });
  const createMutation = useCreateSession();
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async (payload: SessionCreatePayload) => {
    setCreateError(null);
    try {
      const sess = await createMutation.mutateAsync(payload);
      setSelectedId(sess.id);
      setShowForm(false);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Error al crear sesión.");
    }
  };

  if (selectedId) {
    return (
      <div className="max-w-2xl">
        <SessionDetail sessionId={selectedId} onBack={() => setSelectedId(null)} />
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="max-w-2xl">
        <button type="button" onClick={() => setShowForm(false)} className="text-sm text-muted-foreground mb-4 block">← Volver</button>
        <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Nueva nota de sesión</h3>
        <SessionForm
          defaultPatientId={patientId}
          onSubmit={handleCreate}
          isSubmitting={createMutation.isPending}
          error={createError}
        />
      </div>
    );
  }

  const STATUS_COLORS: Record<string, string> = {
    draft: "bg-amber-50 text-amber-700",
    signed: "bg-green-50 text-green-700",
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-[#1E3A5F]">Historial de sesiones</h3>
        <Button size="sm" className="bg-[#2E86AB] hover:bg-[#1E3A5F] text-white" onClick={() => setShowForm(true)}>
          + Nueva sesión
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando...</p>}

      {!isLoading && data && data.items.length === 0 && (
        <div className="rounded-lg border bg-slate-50 p-4 text-sm text-muted-foreground">
          No hay sesiones registradas para este paciente.
        </div>
      )}

      {!isLoading && data && data.items.length > 0 && (
        <div className="space-y-2">
          {data.items.map((sess) => (
            <button
              key={sess.id}
              type="button"
              onClick={() => setSelectedId(sess.id)}
              className="w-full text-left border rounded-lg p-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#1E3A5F]">
                  {new Date(sess.actual_start).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[sess.status] ?? ""}`}>
                  {sess.status === "signed" ? "Firmada" : "Borrador"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                CIE-11: {sess.diagnosis_cie11} · CUPS: {sess.cups_code} · ${sess.session_fee.toLocaleString("es-CO")} COP
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

También reemplazar el bloque `{activeTab === "historia" && ...}` (líneas 174-181) con:

```tsx
      {activeTab === "historia" && id && (
        <div className="max-w-2xl space-y-3">
          <p className="text-sm text-muted-foreground mb-3">Sesiones firmadas — solo lectura (Res. 1995/1999)</p>
          <PatientSignedSessionsList patientId={id} />
        </div>
      )}
```

Y añadir el componente `PatientSignedSessionsList` justo antes de `PatientSessionsTab`:

```tsx
function PatientSignedSessionsList({ patientId }: { patientId: string }) {
  const { data, isLoading } = useSessions({ patient_id: patientId, status: "signed" });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (selectedId) {
    return <SessionDetail sessionId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando...</p>;
  if (!data || data.items.length === 0) {
    return (
      <div className="rounded-lg border bg-slate-50 p-4 text-sm text-muted-foreground">
        No hay sesiones firmadas para este paciente.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.items.map((sess) => (
        <button
          key={sess.id}
          type="button"
          onClick={() => setSelectedId(sess.id)}
          className="w-full text-left border rounded-lg p-4 hover:bg-slate-50 transition-colors border-green-100"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#1E3A5F]">
              {new Date(sess.actual_start).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}
            </span>
            <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded font-medium">Firmada</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            CIE-11: {sess.diagnosis_cie11} · CUPS: {sess.cups_code}
          </p>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd psicogest/frontend && npx tsc --noEmit
```
Expected: sin errores

- [ ] **Step 5: Ejecutar todos los tests del backend para confirmar nada se rompió**

```bash
cd psicogest/backend
.venv/Scripts/pytest tests/test_appointments.py tests/test_sessions.py tests/test_dashboard.py tests/test_email_service.py tests/test_reminders.py -q
```
Expected: `41 passed`

- [ ] **Step 6: Commit final**

```bash
git add psicogest/frontend/src/pages/sessions/SessionsPage.tsx psicogest/frontend/src/App.tsx psicogest/frontend/src/pages/patients/PatientDetailPage.tsx
git commit -m "feat(sprint5): SessionsPage, App routing, PatientDetailPage sesiones + historia tabs — Sprint 5 complete"
```

---

## Self-Review

### Spec Coverage

| Requisito | Task |
|---|---|
| Marcar cita como completada | Task 3, 5, 7 |
| Marcar cita como no-show | Task 3, 5, 7 |
| Crear nota de sesión (borrador) | Task 4, 5, 8 |
| Firmado inmutable SHA-256 (Res. 1995/1999) | Task 4, 5, 9 |
| CIE-11 obligatorio (Res. 1442/2024) | Task 2, 8 |
| CUPS code obligatorio | Task 2, 8 |
| Notas aclaratorias append-only | Task 4, 5, 9 |
| Listado de sesiones `/sessions` | Task 5, 6, 10 |
| Tab sesiones en ficha de paciente | Task 10 |
| Tab historia clínica (sesiones firmadas) | Task 10 |
| Tests backend completos | Tasks 3, 4 |

### Placeholder Scan
No placeholders — todo el código está completo en cada paso.

### Type Consistency
- `SessionService.create(data: dict)` — llamado con `body.model_dump()` en el router ✓
- `SessionService.sign(session_id: str)` — llamado como `_service(ctx).sign(session_id)` ✓
- `SessionAlreadySignedError` — importado y capturado en el router ✓
- `useCompleteAppointment` / `useNoshowAppointment` — importados en `AppointmentSidebar` desde `useSessions` ✓
- `api.appointments_status.complete(id)` — definido en `api.ts` y llamado en hook ✓
- `PatientSessionsTab` usa `useState` del scope del componente (no `useSessionState`) — la importación de alias `useSessionState` en el plan es innecesaria; usar `useState` directamente del import existente en `PatientDetailPage.tsx` ✓

> **Nota al implementador:** En `PatientDetailPage.tsx`, el archivo ya importa `useState` en la línea 1. No añadir `import { useState as useSessionState }` — usar `useState` directamente en los nuevos componentes `PatientSessionsTab` y `PatientSignedSessionsList`.
