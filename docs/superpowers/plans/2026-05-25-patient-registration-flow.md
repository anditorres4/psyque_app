# Patient Registration Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a booking request is confirmed but the patient doesn't exist yet, send a 48h registration link by email; the patient fills minimum fields, a Patient + Appointment are created, and portal access is activated automatically.

**Architecture:** Token stored as 3 nullable columns on `booking_requests`. Public endpoints under `/api/v1/public/booking/registration/{token}` handle pre-fill and submission. The agenda shows confirmed-pending-registration events in purple with a "Resend email" action.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 + Alembic, Supabase Admin REST API (httpx), Resend, React 18 + React Query + Zod

---

## File Map

| File | Action |
|------|--------|
| `psicogest/backend/alembic/versions/0044_patient_registration_flow.py` | CREATE — migration |
| `psicogest/backend/app/models/booking_request.py` | MODIFY — 3 new columns |
| `psicogest/backend/app/models/patient.py` | MODIFY — 6 fields nullable |
| `psicogest/backend/app/schemas/booking.py` | MODIFY — new schemas + updated summary |
| `psicogest/backend/app/services/booking_service.py` | MODIFY — confirm() + new methods |
| `psicogest/backend/app/services/email_service.py` | MODIFY — new method |
| `psicogest/backend/app/api/v1/booking.py` | MODIFY — 2 new public endpoints |
| `psicogest/backend/app/api/v1/booking_requests.py` | MODIFY — confirm + resend endpoint |
| `psicogest/frontend/src/lib/api.ts` | MODIFY — new API methods |
| `psicogest/frontend/src/hooks/useBooking.ts` | MODIFY — updated hooks + new hook |
| `psicogest/frontend/src/pages/booking/BookingRegistrationPage.tsx` | CREATE — public registration form |
| `psicogest/frontend/src/App.tsx` | MODIFY — add `/completar-registro/:token` route |
| `psicogest/frontend/src/pages/agenda/AgendaPage.tsx` | MODIFY — purple events + new sidebar |

---

## Task 1: DB Migration

**Files:**
- Create: `psicogest/backend/alembic/versions/0044_patient_registration_flow.py`

- [ ] **Step 1: Create migration file**

```python
# psicogest/backend/alembic/versions/0044_patient_registration_flow.py
"""Add registration token to booking_requests; make optional patient fields nullable.

Revision ID: 0044
Revises: 0043
Create Date: 2026-05-25
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0044"
down_revision: Union[str, None] = "0043"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- booking_requests: registration token columns ---
    op.add_column("booking_requests",
        sa.Column("registration_token", sa.String(36), nullable=True))
    op.add_column("booking_requests",
        sa.Column("registration_token_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("booking_requests",
        sa.Column("registration_token_used_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(
        "ix_booking_requests_registration_token",
        "booking_requests", ["registration_token"], unique=True,
        postgresql_where=sa.text("registration_token IS NOT NULL"),
    )

    # --- patients: make clinical fields nullable (filled during first session) ---
    op.alter_column("patients", "marital_status", nullable=True)
    op.alter_column("patients", "occupation",     nullable=True)
    op.alter_column("patients", "address",        nullable=True)
    op.alter_column("patients", "municipality_dane", nullable=True)
    op.alter_column("patients", "zone",           nullable=True)
    op.alter_column("patients", "payer_type",     nullable=True)


def downgrade() -> None:
    op.alter_column("patients", "payer_type",        nullable=False)
    op.alter_column("patients", "zone",              nullable=False)
    op.alter_column("patients", "municipality_dane", nullable=False)
    op.alter_column("patients", "address",           nullable=False)
    op.alter_column("patients", "occupation",        nullable=False)
    op.alter_column("patients", "marital_status",    nullable=False)

    op.drop_index("ix_booking_requests_registration_token", table_name="booking_requests")
    op.drop_column("booking_requests", "registration_token_used_at")
    op.drop_column("booking_requests", "registration_token_expires_at")
    op.drop_column("booking_requests", "registration_token")
```

- [ ] **Step 2: Run migration**

```bash
cd psicogest/backend
source .venv/bin/activate   # Windows: .venv\Scripts\activate
alembic upgrade head
```

Expected: `Running upgrade 0043 -> 0044, Add registration token to booking_requests...`

- [ ] **Step 3: Commit**

```bash
git add psicogest/backend/alembic/versions/0044_patient_registration_flow.py
git commit -m "feat(db): add registration token to booking_requests, make patient fields nullable"
```

---

## Task 2: Update SQLAlchemy Models

**Files:**
- Modify: `psicogest/backend/app/models/booking_request.py`
- Modify: `psicogest/backend/app/models/patient.py`

- [ ] **Step 1: Add 3 columns to BookingRequest model**

In `psicogest/backend/app/models/booking_request.py`, add after the `created_at` column:

```python
    registration_token: Mapped[str | None] = mapped_column(sa.String(36), nullable=True, index=True)
    registration_token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    registration_token_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
```

The `datetime` and `DateTime` imports are already in the file.

- [ ] **Step 2: Make 6 patient fields nullable in Patient model**

In `psicogest/backend/app/models/patient.py`, change these 6 `Mapped` annotations from `Mapped[str]` to `Mapped[str | None]` and add `nullable=True`:

```python
    marital_status: Mapped[str | None] = mapped_column(
        sa.Enum("S", "C", "U", "D", "V", "SE", name="marital_status"),
        nullable=True,
    )
    occupation: Mapped[str | None] = mapped_column(sa.String(150), nullable=True)
    address: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    municipality_dane: Mapped[str | None] = mapped_column(sa.String(10), nullable=True)
    zone: Mapped[str | None] = mapped_column(
        sa.Enum("U", "R", name="zone"),
        nullable=True,
    )
    payer_type: Mapped[str | None] = mapped_column(
        sa.Enum("PA", "CC", "SS", "PE", "SE", name="payer_type"),
        nullable=True,
    )
```

- [ ] **Step 3: Verify backend starts without errors**

```bash
cd psicogest/backend
uvicorn app.main:app --reload
```

Expected: server starts on port 8000 with no import errors.

- [ ] **Step 4: Commit**

```bash
git add psicogest/backend/app/models/booking_request.py psicogest/backend/app/models/patient.py
git commit -m "feat(models): add registration token fields, nullable patient fields"
```

---

## Task 3: Update Pydantic Schemas

**Files:**
- Modify: `psicogest/backend/app/schemas/booking.py`

- [ ] **Step 1: Replace the full file content**

```python
"""Pydantic schemas for public booking endpoints."""
from datetime import datetime
from pydantic import BaseModel, Field


class BookingInfo(BaseModel):
    tenant_name: str
    welcome_message: str
    session_duration_min: int
    slots: list[str]


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
    registration_pending: bool = False
    registration_token_expires_at: datetime | None = None

    model_config = {"from_attributes": True}


# --- Patient registration via booking token ---

class RegistrationTokenInfo(BaseModel):
    """Returned by GET /registration/{token} to pre-fill the form."""
    patient_name: str
    patient_email: str
    psychologist_name: str
    requested_start: datetime
    session_type: str


class PatientRegistrationBody(BaseModel):
    doc_type: str = Field(..., pattern="^(CC|TI|CE|PA|RC|MS)$")
    doc_number: str = Field(..., min_length=4, max_length=20)
    birth_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")  # YYYY-MM-DD
    biological_sex: str = Field(..., pattern="^(M|F|I)$")
    phone: str = Field(..., min_length=7, max_length=20)


class PatientRegistrationResult(BaseModel):
    patient_name: str
    appointment_start: datetime
```

- [ ] **Step 2: Commit**

```bash
git add psicogest/backend/app/schemas/booking.py
git commit -m "feat(schemas): add registration token fields and patient registration schemas"
```

---

## Task 4: Update BookingService

**Files:**
- Modify: `psicogest/backend/app/services/booking_service.py`

- [ ] **Step 1: Add imports at the top of the service**

After the existing imports, add:

```python
import uuid as uuid_module
from datetime import datetime, timedelta, timezone
```

`uuid` is already imported as `import uuid` — change it to `import uuid` only (it's already there). The `datetime`, `timedelta`, `timezone` imports already exist. No changes needed for those.

- [ ] **Step 2: Replace `confirm()` method**

```python
    def confirm(self, request_id: uuid.UUID, tenant_id: uuid.UUID) -> BookingRequest:
        req = self._get(request_id, tenant_id)
        req.status = "confirmed"

        valid_session_types = {"individual", "couple", "family", "followup"}
        session_type = req.session_type if req.session_type in valid_session_types else "individual"

        # Try to find existing patient by email
        patient = (
            self.db.query(Patient)
            .filter(Patient.tenant_id == tenant_id, Patient.email == req.patient_email)
            .first()
        ) if req.patient_email else None

        if patient:
            # Auto-create Appointment — patient already registered
            appt = Appointment(
                tenant_id=tenant_id,
                patient_id=patient.id,
                scheduled_start=req.requested_start,
                scheduled_end=req.requested_end,
                session_type=session_type,
                modality="virtual",
                status="scheduled",
                notes=req.notes,
            )
            self.db.add(appt)
        else:
            # Patient unknown — generate registration token
            req.registration_token = str(uuid.uuid4())
            req.registration_token_expires_at = datetime.now(tz=timezone.utc) + timedelta(hours=48)

        self.db.flush()
        self.db.refresh(req)
        return req
```

- [ ] **Step 3: Add `resend_registration()` method** after `confirm()`:

```python
    def resend_registration(self, request_id: uuid.UUID, tenant_id: uuid.UUID) -> BookingRequest:
        """Regenerate registration token and reset expiry for resending the email."""
        req = self._get(request_id, tenant_id)
        if req.status != "confirmed" or req.registration_token_used_at is not None:
            raise BookingNotFoundError(str(request_id))
        req.registration_token = str(uuid.uuid4())
        req.registration_token_expires_at = datetime.now(tz=timezone.utc) + timedelta(hours=48)
        req.registration_token_used_at = None
        self.db.flush()
        self.db.refresh(req)
        return req
```

- [ ] **Step 4: Add `get_registration_info()` and `complete_registration()` methods** after `resend_registration()`:

```python
    def get_registration_info(self, token: str) -> tuple[BookingRequest, "Tenant"]:
        """Validate token and return booking request + tenant for pre-fill.
        Raises BookingNotFoundError for missing/expired/used tokens.
        """
        req = (
            self.db.query(BookingRequest)
            .filter(BookingRequest.registration_token == token)
            .first()
        )
        self._validate_token(req)
        tenant = self.db.get(Tenant, req.tenant_id)
        return req, tenant

    def complete_registration(
        self,
        token: str,
        *,
        doc_type: str,
        doc_number: str,
        birth_date,
        biological_sex: str,
        phone: str,
    ) -> tuple[BookingRequest, "Patient", "Appointment"]:
        """Create Patient + Appointment from token. Marks token as used."""
        from app.models.patient import Patient as PatientModel
        from app.services.patient_service import PatientService

        req = (
            self.db.query(BookingRequest)
            .filter(BookingRequest.registration_token == token)
            .first()
        )
        self._validate_token(req)

        valid_session_types = {"individual", "couple", "family", "followup"}
        session_type = req.session_type if req.session_type in valid_session_types else "individual"

        # Idempotency: if patient already exists (race condition), reuse
        patient = (
            self.db.query(PatientModel)
            .filter(PatientModel.tenant_id == req.tenant_id, PatientModel.email == req.patient_email)
            .first()
        )

        if not patient:
            # Split name: last word as first_surname, rest as first_name
            parts = req.patient_name.strip().split()
            first_name = " ".join(parts[:-1]) if len(parts) > 1 else parts[0]
            first_surname = parts[-1] if len(parts) > 1 else "N/A"

            hc_number = PatientService(self.db, str(tenant_id))._next_hc_number()

            patient = PatientModel(
                tenant_id=req.tenant_id,
                hc_number=hc_number,
                doc_type=doc_type,
                doc_number=doc_number,
                first_name=first_name,
                first_surname=first_surname,
                birth_date=birth_date,
                biological_sex=biological_sex,
                phone=phone,
                email=req.patient_email,
                # Nullable fields left None — to be completed in first session
            )
            self.db.add(patient)
            self.db.flush()
            self.db.refresh(patient)

        appt = Appointment(
            tenant_id=req.tenant_id,
            patient_id=patient.id,
            scheduled_start=req.requested_start,
            scheduled_end=req.requested_end,
            session_type=session_type,
            modality="virtual",
            status="scheduled",
            notes=req.notes,
        )
        self.db.add(appt)

        req.registration_token_used_at = datetime.now(tz=timezone.utc)
        self.db.flush()
        self.db.refresh(appt)
        return req, patient, appt

    def _validate_token(self, req: "BookingRequest | None") -> None:
        if req is None:
            raise BookingNotFoundError("token_not_found")
        if req.registration_token_used_at is not None:
            raise BookingNotFoundError("token_used")
        if req.registration_token_expires_at and req.registration_token_expires_at < datetime.now(tz=timezone.utc):
            raise BookingNotFoundError("token_expired")
```

- [ ] **Step 5: Run existing tests to verify no regression**

```bash
cd psicogest/backend
pytest tests/ -v --tb=short -q
```

Expected: all previously passing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add psicogest/backend/app/services/booking_service.py
git commit -m "feat(service): confirm auto-generates registration token, add complete_registration"
```

---

## Task 5: Add Email Method

**Files:**
- Modify: `psicogest/backend/app/services/email_service.py`

- [ ] **Step 1: Add `send_patient_registration_request()` method** at the end of the `EmailService` class:

```python
    def send_patient_registration_request(
        self,
        *,
        to_email: str,
        patient_name: str,
        psychologist_name: str,
        registration_link: str,
        appointment_start: datetime,
    ) -> bool:
        """Sent when a booking is confirmed but patient doesn't exist yet."""
        if not settings.resend_api_key:
            return False
        date_str = appointment_start.strftime("%A %d de %B de %Y")
        time_str = appointment_start.strftime("%H:%M")
        return self._post({
            "from": settings.resend_from_email,
            "to": [to_email],
            "subject": f"Completa tu registro — cita el {date_str}",
            "html": (
                f"<p>Hola {patient_name},</p>"
                f"<p><strong>{psychologist_name}</strong> ha confirmado tu solicitud de cita para el "
                f"<strong>{date_str} a las {time_str}</strong>.</p>"
                f"<p>Para finalizar el agendamiento necesitamos algunos datos básicos. "
                f"Solo te tomará 2 minutos:</p>"
                f"<p style='margin:24px 0;'>"
                f"<a href='{registration_link}' style='display:inline-block;background:#2E5E8A;"
                f"color:white;padding:14px 32px;border-radius:8px;text-decoration:none;"
                f"font-weight:600;font-size:15px;'>Completar mi registro</a></p>"
                f"<p style='font-size:12px;color:#6B7A7E;'>Este enlace es válido por 48 horas. "
                f"Si no solicitaste esta cita, ignora este mensaje.</p>"
                f"<p>Saludos,<br><strong>{psychologist_name}</strong></p>"
            ),
        })
```

- [ ] **Step 2: Commit**

```bash
git add psicogest/backend/app/services/email_service.py
git commit -m "feat(email): add send_patient_registration_request method"
```

---

## Task 6: Public Registration Endpoints

**Files:**
- Modify: `psicogest/backend/app/api/v1/booking.py`

- [ ] **Step 1: Add imports to `booking.py`**

Add to existing imports at top:

```python
from datetime import date
from app.schemas.booking import (
    BookingInfo, BookingRequestCreate, BookingRequestCreated,
    RegistrationTokenInfo, PatientRegistrationBody, PatientRegistrationResult,
)
from app.core.config import settings
import httpx
import logging

logger = logging.getLogger(__name__)

_SUPABASE_ADMIN_HEADERS = {
    "apikey": settings.supabase_service_key,
    "Authorization": f"Bearer {settings.supabase_service_key}",
    "Content-Type": "application/json",
}
```

- [ ] **Step 2: Add two new endpoints at the end of `booking.py`**

```python
@router.get("/registration/{token}", response_model=RegistrationTokenInfo)
def get_registration_info(token: str, db: Annotated[Session, Depends(get_db)]):
    """Return pre-fill data for the patient registration form."""
    svc = BookingService(db)
    try:
        req, tenant = svc.get_registration_info(token)
    except BookingNotFoundError as e:
        msg = str(e)
        if "used" in msg:
            raise HTTPException(status_code=410, detail="Este enlace ya fue utilizado.")
        if "expired" in msg:
            raise HTTPException(status_code=410, detail="Este enlace expiró. Pide a tu psicólogo que lo reenvíe.")
        raise HTTPException(status_code=404, detail="Enlace no encontrado.")
    return RegistrationTokenInfo(
        patient_name=req.patient_name,
        patient_email=req.patient_email,
        psychologist_name=tenant.full_name if tenant else "tu psicólogo",
        requested_start=req.requested_start,
        session_type=req.session_type,
    )


@router.post("/registration/{token}", response_model=PatientRegistrationResult, status_code=201)
def complete_registration(
    token: str,
    body: PatientRegistrationBody,
    db: Annotated[Session, Depends(get_db)],
    bg: BackgroundTasks,
):
    """Complete patient registration: create Patient + Appointment + Supabase auth user."""
    svc = BookingService(db)
    try:
        birth_date = date.fromisoformat(body.birth_date)
        req, patient, appt = svc.complete_registration(
            token,
            doc_type=body.doc_type,
            doc_number=body.doc_number,
            birth_date=birth_date,
            biological_sex=body.biological_sex,
            phone=body.phone,
        )
    except BookingNotFoundError as e:
        msg = str(e)
        if "used" in msg:
            raise HTTPException(status_code=410, detail="Este enlace ya fue utilizado.")
        if "expired" in msg:
            raise HTTPException(status_code=410, detail="Este enlace expiró. Pide a tu psicólogo que lo reenvíe.")
        raise HTTPException(status_code=404, detail="Enlace no encontrado.")

    db.commit()

    # Activate portal in background — do NOT fail if this errors
    bg.add_task(
        _activate_portal_and_invite,
        patient_id=str(patient.id),
        tenant_id=str(patient.tenant_id),
        patient_email=patient.email,
        patient_name=patient.first_name,
    )

    return PatientRegistrationResult(
        patient_name=req.patient_name,
        appointment_start=appt.scheduled_start,
    )


def _activate_portal_and_invite(
    *,
    patient_id: str,
    tenant_id: str,
    patient_email: str,
    patient_name: str,
):
    """Background: create Supabase auth user + send portal invite."""
    from app.core.database import SessionLocal
    from app.models.patient import Patient as PatientModel
    from app.models.tenant import Tenant as TenantModel
    import uuid

    try:
        db = SessionLocal()
        try:
            # Resolve psychologist name from tenant
            tenant = db.get(TenantModel, uuid.UUID(tenant_id))
            psych_name = tenant.full_name if tenant else "tu psicólogo"

            # Create Supabase auth user
            resp = httpx.post(
                f"{settings.supabase_url}/auth/v1/admin/users",
                json={
                    "email": patient_email,
                    "email_confirm": True,
                    "app_metadata": {
                        "role": "patient",
                        "patient_id": patient_id,
                        "tenant_id": tenant_id,
                    },
                },
                headers=_SUPABASE_ADMIN_HEADERS,
                timeout=15.0,
            )
            email_existed = resp.status_code == 422 and "email_exists" in resp.text
            if not email_existed:
                resp.raise_for_status()
                auth_user_id = uuid.UUID(resp.json()["id"])
                # Persist auth_user_id on patient
                patient = db.get(PatientModel, uuid.UUID(patient_id))
                if patient:
                    patient.auth_user_id = auth_user_id
                    db.commit()

            # Generate recovery/invite link
            link_resp = httpx.post(
                f"{settings.supabase_url}/auth/v1/admin/generate_link",
                json={"type": "recovery", "email": patient_email},
                headers=_SUPABASE_ADMIN_HEADERS,
                timeout=10.0,
            )
            link_resp.raise_for_status()
            action_link = link_resp.json().get("action_link", "")

            EmailService().send_portal_invite(
                to_email=patient_email,
                patient_name=patient_name,
                psychologist_name=psych_name,
                action_link=action_link,
            )
        finally:
            db.close()
    except Exception:
        logger.exception("Failed to activate portal for patient %s", patient_id)
```

- [ ] **Step 3: Add missing imports** — check `booking.py` already imports `BackgroundTasks` and `EmailService`. If not, add:

```python
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from app.services.email_service import EmailService
```

- [ ] **Step 4: Verify endpoints register**

```bash
cd psicogest/backend
uvicorn app.main:app --reload
# In another terminal:
curl http://localhost:8000/api/v1/public/booking/registration/nonexistent-token
```

Expected: `{"detail":"Enlace no encontrado."}`

- [ ] **Step 5: Commit**

```bash
git add psicogest/backend/app/api/v1/booking.py
git commit -m "feat(api): add GET/POST /public/booking/registration/{token} endpoints"
```

---

## Task 7: Update booking_requests Router

**Files:**
- Modify: `psicogest/backend/app/api/v1/booking_requests.py`

- [ ] **Step 1: Update `confirm_request` to send email + add `registration_pending` flag**

Replace the `confirm_request` function:

```python
@router.post("/{request_id}/confirm", response_model=BookingRequestSummary)
def confirm_request(
    request_id: uuid.UUID,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    background_tasks: BackgroundTasks,
):
    from app.core.config import settings

    try:
        req = _svc(ctx).confirm(request_id, uuid.UUID(ctx.tenant.tenant_id))
        ctx.db.commit()

        registration_pending = (
            req.registration_token is not None
            and req.registration_token_used_at is None
        )

        if registration_pending:
            tenant = ctx.db.get(Tenant, uuid.UUID(ctx.tenant.tenant_id))
            psychologist_name = tenant.full_name if tenant else "tu psicólogo"
            frontend_url = getattr(settings, "frontend_url", "https://app.psycent.co")
            registration_link = f"{frontend_url}/completar-registro/{req.registration_token}"
            background_tasks.add_task(
                _send_registration_email,
                to_email=req.patient_email,
                patient_name=req.patient_name,
                psychologist_name=psychologist_name,
                registration_link=registration_link,
                appointment_start=req.requested_start,
            )
        elif req.patient_email:
            tenant = ctx.db.get(Tenant, uuid.UUID(ctx.tenant.tenant_id))
            psychologist_name = tenant.full_name if tenant else "tu psicólogo"
            background_tasks.add_task(
                _send_booking_confirmation,
                to_email=req.patient_email,
                patient_name=req.patient_name,
                psychologist_name=psychologist_name,
                requested_start=req.requested_start,
            )

        return BookingRequestSummary(
            id=str(req.id),
            patient_name=req.patient_name,
            patient_email=req.patient_email,
            patient_phone=req.patient_phone,
            session_type=req.session_type,
            requested_start=req.requested_start,
            requested_end=req.requested_end,
            status=req.status,
            notes=req.notes,
            created_at=req.created_at,
            registration_pending=registration_pending,
            registration_token_expires_at=req.registration_token_expires_at,
        )
    except BookingNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")
```

- [ ] **Step 2: Add `_send_registration_email` background helper** after `_send_booking_confirmation`:

```python
def _send_registration_email(
    *,
    to_email: str,
    patient_name: str,
    psychologist_name: str,
    registration_link: str,
    appointment_start,
) -> None:
    try:
        EmailService().send_patient_registration_request(
            to_email=to_email,
            patient_name=patient_name,
            psychologist_name=psychologist_name,
            registration_link=registration_link,
            appointment_start=appointment_start,
        )
    except Exception:
        logger.exception("Failed to send registration email to %s", to_email)
```

- [ ] **Step 3: Add `resend-registration` endpoint** at the end of the file:

```python
@router.post("/{request_id}/resend-registration", response_model=BookingRequestSummary)
def resend_registration(
    request_id: uuid.UUID,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    background_tasks: BackgroundTasks,
):
    from app.core.config import settings

    try:
        req = _svc(ctx).resend_registration(request_id, uuid.UUID(ctx.tenant.tenant_id))
        ctx.db.commit()
        tenant = ctx.db.get(Tenant, uuid.UUID(ctx.tenant.tenant_id))
        psychologist_name = tenant.full_name if tenant else "tu psicólogo"
        frontend_url = getattr(settings, "frontend_url", "https://app.psycent.co")
        registration_link = f"{frontend_url}/completar-registro/{req.registration_token}"
        background_tasks.add_task(
            _send_registration_email,
            to_email=req.patient_email,
            patient_name=req.patient_name,
            psychologist_name=psychologist_name,
            registration_link=registration_link,
            appointment_start=req.requested_start,
        )
        return BookingRequestSummary(
            id=str(req.id),
            patient_name=req.patient_name,
            patient_email=req.patient_email,
            patient_phone=req.patient_phone,
            session_type=req.session_type,
            requested_start=req.requested_start,
            requested_end=req.requested_end,
            status=req.status,
            notes=req.notes,
            created_at=req.created_at,
            registration_pending=True,
            registration_token_expires_at=req.registration_token_expires_at,
        )
    except BookingNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")
```

- [ ] **Step 4: Add `frontend_url` to settings** — check `psicogest/backend/app/core/config.py`:

```python
frontend_url: str = "https://app.psycent.co"
```

Add this line to the `Settings` class if not already there.

- [ ] **Step 5: Also update `list_booking_requests`** to include the new fields in the returned summaries. Replace the list comprehension return:

```python
    return [
        BookingRequestSummary(
            id=str(req.id),
            patient_name=req.patient_name,
            patient_email=req.patient_email,
            patient_phone=req.patient_phone,
            session_type=req.session_type,
            requested_start=req.requested_start,
            requested_end=req.requested_end,
            status=req.status,
            notes=req.notes,
            created_at=req.created_at,
            registration_pending=(
                req.registration_token is not None
                and req.registration_token_used_at is None
            ),
            registration_token_expires_at=req.registration_token_expires_at,
        )
        for req in requests
    ]
```

- [ ] **Step 6: Commit**

```bash
git add psicogest/backend/app/api/v1/booking_requests.py psicogest/backend/app/core/config.py
git commit -m "feat(api): booking confirm sends registration email; add resend-registration endpoint"
```

---

## Task 8: Frontend — API Client

**Files:**
- Modify: `psicogest/frontend/src/lib/api.ts`

- [ ] **Step 1: Add TypeScript types for new schemas**

Find the existing `BookingRequestSummary` type in `api.ts` and update it, then add new types:

```typescript
export interface BookingRequestSummary {
  id: string;
  patient_name: string;
  patient_email: string;
  patient_phone: string | null;
  session_type: string;
  requested_start: string;
  requested_end: string;
  status: string;
  notes: string | null;
  created_at: string;
  registration_pending: boolean;
  registration_token_expires_at: string | null;
}

export interface RegistrationTokenInfo {
  patient_name: string;
  patient_email: string;
  psychologist_name: string;
  requested_start: string;
  session_type: string;
}

export interface PatientRegistrationBody {
  doc_type: string;
  doc_number: string;
  birth_date: string;
  biological_sex: string;
  phone: string;
}

export interface PatientRegistrationResult {
  patient_name: string;
  appointment_start: string;
}
```

- [ ] **Step 2: Add new API methods to `bookingRequests` and add `registration` namespace**

In the `api` object, update `bookingRequests`:

```typescript
bookingRequests: {
  list: (status?: string) => {
    const q = status ? `?status=${status}` : "";
    return request<BookingRequestSummary[]>("GET", `/booking-requests${q}`);
  },
  confirm: (id: string) =>
    request<BookingRequestSummary>("POST", `/booking-requests/${id}/confirm`),
  reject: (id: string) =>
    request<BookingRequestSummary>("POST", `/booking-requests/${id}/reject`),
  resendRegistration: (id: string) =>
    request<BookingRequestSummary>("POST", `/booking-requests/${id}/resend-registration`),
},
registration: {
  getInfo: (token: string) =>
    publicRequest<RegistrationTokenInfo>("GET", `/public/booking/registration/${token}`),
  complete: (token: string, body: PatientRegistrationBody) =>
    publicRequest<PatientRegistrationResult>("POST", `/public/booking/registration/${token}`, body),
},
```

- [ ] **Step 3: Commit**

```bash
git add psicogest/frontend/src/lib/api.ts
git commit -m "feat(api-client): add registration token types and methods"
```

---

## Task 9: Frontend — Hooks

**Files:**
- Modify: `psicogest/frontend/src/hooks/useBooking.ts`

- [ ] **Step 1: Replace the full file**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type BookingRequestSummary, type PatientRegistrationBody } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

export function useBookingRequests(status?: string) {
  return useQuery({
    queryKey: ["booking-requests", status ?? "all"],
    queryFn: () => api.bookingRequests.list(status),
    staleTime: 60_000,
    retry: false,
  });
}

export function useConfirmBookingRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.bookingRequests.confirm(id),
    onSuccess: (data: BookingRequestSummary) => {
      queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      if (data.registration_pending) {
        toast({
          title: "Solicitud confirmada",
          description: `Se envió un email a ${data.patient_email} para completar el registro. Recuérdale revisarlo.`,
        });
      }
    },
  });
}

export function useRejectBookingRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.bookingRequests.reject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["booking-requests"] }),
  });
}

export function useResendRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.bookingRequests.resendRegistration(id),
    onSuccess: (data: BookingRequestSummary) => {
      queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
      toast({
        title: "Email reenviado",
        description: `Se envió un nuevo enlace a ${data.patient_email}.`,
      });
    },
  });
}

export function useRegistrationInfo(token: string) {
  return useQuery({
    queryKey: ["registration-info", token],
    queryFn: () => api.registration.getInfo(token),
    retry: false,
    staleTime: Infinity,
  });
}

export function useCompleteRegistration(token: string) {
  return useMutation({
    mutationFn: (body: PatientRegistrationBody) => api.registration.complete(token, body),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add psicogest/frontend/src/hooks/useBooking.ts
git commit -m "feat(hooks): add registration hooks, toast on confirm with pending registration"
```

---

## Task 10: Frontend — Registration Page

**Files:**
- Create: `psicogest/frontend/src/pages/booking/BookingRegistrationPage.tsx`

- [ ] **Step 1: Create the page**

```typescript
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRegistrationInfo, useCompleteRegistration } from "@/hooks/useBooking";

const schema = z.object({
  doc_type: z.enum(["CC", "TI", "CE", "PA", "RC", "MS"], {
    required_error: "Selecciona el tipo de documento",
  }),
  doc_number: z.string().min(4, "Mínimo 4 caracteres").max(20),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
  biological_sex: z.enum(["M", "F", "I"], { required_error: "Selecciona una opción" }),
  phone: z.string().min(7, "Mínimo 7 dígitos").max(20),
});

type FormValues = z.infer<typeof schema>;

const DOC_TYPES = [
  { value: "CC", label: "Cédula de Ciudadanía" },
  { value: "TI", label: "Tarjeta de Identidad" },
  { value: "CE", label: "Cédula de Extranjería" },
  { value: "PA", label: "Pasaporte" },
  { value: "RC", label: "Registro Civil" },
  { value: "MS", label: "Mayor de Edad sin Documento" },
];

const SEX_OPTIONS = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Femenino" },
  { value: "I", label: "Indeterminado / Intersexual" },
];

const SESSION_LABELS: Record<string, string> = {
  individual: "Individual",
  couple: "Pareja",
  family: "Familia",
  followup: "Seguimiento",
};

export function BookingRegistrationPage() {
  const { token = "" } = useParams<{ token: string }>();
  const { data: info, isLoading, error } = useRegistrationInfo(token);
  const mutation = useCompleteRegistration(token);
  const [done, setDone] = useState(false);
  const [appointmentStart, setAppointmentStart] = useState("");

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { doc_type: "CC", biological_sex: "M" },
  });

  const onSubmit = async (values: FormValues) => {
    const result = await mutation.mutateAsync(values);
    setAppointmentStart(result.appointment_start);
    setDone(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <p className="text-sm text-[#4A7B6F]">Cargando...</p>
      </div>
    );
  }

  if (error || !info) {
    const detail = (error as { message?: string })?.message ?? "";
    const isExpired = detail.includes("expiró");
    const isUsed = detail.includes("utilizado");
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6">
        <div className="max-w-md w-full text-center space-y-3">
          <div className="text-4xl">{isUsed ? "✅" : "⏰"}</div>
          <h1 className="text-xl font-semibold text-[#1E3A5F]">
            {isUsed ? "Registro ya completado" : isExpired ? "Enlace expirado" : "Enlace no válido"}
          </h1>
          <p className="text-sm text-[#6B7A7E]">
            {isUsed
              ? "Tu registro ya fue completado anteriormente."
              : isExpired
              ? "Este enlace expiró. Escríbele a tu psicólogo para que te envíe uno nuevo."
              : "Este enlace no es válido. Verifica que hayas abierto el enlace del email correctamente."}
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    const date = appointmentStart
      ? new Date(appointmentStart).toLocaleString("es-CO", {
          weekday: "long", year: "numeric", month: "long",
          day: "numeric", hour: "2-digit", minute: "2-digit",
        })
      : "";
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-5xl">🎉</div>
          <h1 className="text-2xl font-semibold text-[#1E3A5F]">¡Registro completado!</h1>
          <p className="text-[#374151]">
            Tu cita con <strong>{info.psychologist_name}</strong>{date ? ` el ${date}` : ""} está confirmada.
          </p>
          <p className="text-sm text-[#6B7A7E]">
            Revisa tu correo — te enviamos un enlace para acceder a tu portal de paciente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-[#1E3A5F] mb-1">Completa tu registro</h1>
          <p className="text-sm text-[#6B7A7E]">
            Cita con <strong>{info.psychologist_name}</strong> —{" "}
            {new Date(info.requested_start).toLocaleString("es-CO", {
              weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
            })}
            {" · "}{SESSION_LABELS[info.session_type] ?? info.session_type}
          </p>
        </div>

        <div
          className="rounded-xl p-6 space-y-4"
          style={{ background: "white", border: "1px solid #E2EAF0" }}
        >
          {/* Read-only pre-filled fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#6B7A7E] uppercase tracking-wide">Nombre</label>
              <p className="text-sm text-[#1E3A5F] mt-1">{info.patient_name}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-[#6B7A7E] uppercase tracking-wide">Email</label>
              <p className="text-sm text-[#1E3A5F] mt-1 truncate">{info.patient_email}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[#6B7A7E] uppercase tracking-wide block mb-1">
                  Tipo de documento
                </label>
                <select
                  {...register("doc_type")}
                  className="w-full text-sm border rounded-md px-3 py-2 text-[#1E3A5F]"
                  style={{ borderColor: "#E2EAF0" }}
                >
                  {DOC_TYPES.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
                {errors.doc_type && <p className="text-xs text-red-500 mt-1">{errors.doc_type.message}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-[#6B7A7E] uppercase tracking-wide block mb-1">
                  Número de documento
                </label>
                <input
                  {...register("doc_number")}
                  className="w-full text-sm border rounded-md px-3 py-2 text-[#1E3A5F]"
                  style={{ borderColor: "#E2EAF0" }}
                  placeholder="12345678"
                />
                {errors.doc_number && <p className="text-xs text-red-500 mt-1">{errors.doc_number.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[#6B7A7E] uppercase tracking-wide block mb-1">
                  Fecha de nacimiento
                </label>
                <input
                  {...register("birth_date")}
                  type="date"
                  className="w-full text-sm border rounded-md px-3 py-2 text-[#1E3A5F]"
                  style={{ borderColor: "#E2EAF0" }}
                />
                {errors.birth_date && <p className="text-xs text-red-500 mt-1">{errors.birth_date.message}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-[#6B7A7E] uppercase tracking-wide block mb-1">
                  Sexo biológico
                </label>
                <select
                  {...register("biological_sex")}
                  className="w-full text-sm border rounded-md px-3 py-2 text-[#1E3A5F]"
                  style={{ borderColor: "#E2EAF0" }}
                >
                  {SEX_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                {errors.biological_sex && <p className="text-xs text-red-500 mt-1">{errors.biological_sex.message}</p>}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-[#6B7A7E] uppercase tracking-wide block mb-1">
                Teléfono
              </label>
              <input
                {...register("phone")}
                type="tel"
                className="w-full text-sm border rounded-md px-3 py-2 text-[#1E3A5F]"
                style={{ borderColor: "#E2EAF0" }}
                placeholder="3001234567"
              />
              {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
            </div>

            {mutation.error && (
              <p className="text-sm text-red-600 text-center">
                {(mutation.error as { message?: string })?.message ?? "Error al guardar. Intenta de nuevo."}
              </p>
            )}

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full py-3 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ background: "#2E5E8A" }}
            >
              {mutation.isPending ? "Guardando..." : "Confirmar mi registro"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#6B7A7E] mt-4">
          Tus datos se protegen bajo la Ley 1581/2012 de habeas data.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add psicogest/frontend/src/pages/booking/BookingRegistrationPage.tsx
git commit -m "feat(page): add BookingRegistrationPage for patient self-registration"
```

---

## Task 11: Frontend — Route + Agenda Updates

**Files:**
- Modify: `psicogest/frontend/src/App.tsx`
- Modify: `psicogest/frontend/src/pages/agenda/AgendaPage.tsx`

- [ ] **Step 1: Add route in `App.tsx`**

Add lazy import after the existing `BookingPage` import line:

```typescript
const BookingRegistrationPage = lazy(() => import("@/pages/booking/BookingRegistrationPage").then((m) => ({ default: m.BookingRegistrationPage })));
```

Add route inside `<Routes>` after the `/registro/:slug` route:

```tsx
<Route path="/completar-registro/:token" element={<BookingRegistrationPage />} />
```

- [ ] **Step 2: Update `AgendaPage.tsx` — load confirmed-registration-pending requests**

Replace the single `useBookingRequests` call:

```typescript
const { data: pendingRequests = [] } = useBookingRequests("pending");
const { data: confirmedRequests = [] } = useBookingRequests("confirmed");
const registrationPendingRequests = confirmedRequests.filter((r) => r.registration_pending);

const bookingRequests = pendingRequests; // used for event click lookup
```

- [ ] **Step 3: Add purple events and resend hook to `AgendaPage.tsx`**

Add after the existing hook imports at the top of the component:

```typescript
const resendMutation = useResendRegistration();
const [selectedRegistrationRequest, setSelectedRegistrationRequest] = useState<BookingRequestSummary | null>(null);
```

Import `useResendRegistration` and `BookingRequestSummary` from the hooks/api files.

- [ ] **Step 4: Update `calendarEvents` to include registration-pending events**

```typescript
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
    backgroundColor: "#B8843A",
    borderColor: "#8F5E25",
    textColor: "#fff",
    extendedProps: { type: "booking_request", requestId: req.id },
  })),
  ...registrationPendingRequests.map((req) => ({
    id: `rp-${req.id}`,
    title: `📋 ${req.patient_name}`,
    start: req.requested_start,
    end: req.requested_end,
    backgroundColor: "#7C4DFF",
    borderColor: "#5B2ECC",
    textColor: "#fff",
    extendedProps: { type: "registration_pending", requestId: req.id },
  })),
];
```

- [ ] **Step 5: Update `handleEventClick` to handle `registration_pending` type**

```typescript
const handleEventClick = useCallback((info: EventClickArg) => {
  const { type, requestId } = info.event.extendedProps as { type?: string; requestId?: string };
  if (type === "booking_request") {
    const req = bookingRequests.find((r) => r.id === requestId) ?? null;
    setSelectedBookingRequest(req);
    setSelectedAppointmentId(null);
    setSelectedRegistrationRequest(null);
  } else if (type === "registration_pending") {
    const req = registrationPendingRequests.find((r) => r.id === requestId) ?? null;
    setSelectedRegistrationRequest(req);
    setSelectedBookingRequest(null);
    setSelectedAppointmentId(null);
  } else {
    setSelectedAppointmentId(info.event.id);
    setSelectedBookingRequest(null);
    setSelectedRegistrationRequest(null);
  }
}, [bookingRequests, registrationPendingRequests]);
```

- [ ] **Step 6: Add registration-pending sidebar panel in `AgendaPage.tsx`**

Add after the existing booking request sidebar block (before the closing `</div>` of the outer flex container):

```tsx
{/* Registration pending sidebar */}
{selectedRegistrationRequest && (
  <div
    className="w-80 flex-shrink-0 overflow-y-auto"
    style={{ background: "var(--psy-surface)", borderLeft: "1px solid var(--psy-line)" }}
  >
    <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--psy-line)" }}>
      <h2 className="text-[14px] font-semibold" style={{ color: "var(--psy-ink-1)" }}>Registro pendiente</h2>
      <button
        type="button"
        onClick={() => setSelectedRegistrationRequest(null)}
        className="text-[18px] leading-none"
        style={{ color: "var(--psy-ink-3)" }}
      >✕</button>
    </div>
    <div className="p-4 space-y-4">
      <span
        className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full"
        style={{ background: "#EDE7FF", color: "#5B2ECC" }}
      >
        📋 Registro pendiente
      </span>
      <dl className="space-y-3">
        {[
          { label: "Paciente", value: selectedRegistrationRequest.patient_name },
          { label: "Email", value: selectedRegistrationRequest.patient_email },
          ...(selectedRegistrationRequest.patient_phone
            ? [{ label: "Teléfono", value: selectedRegistrationRequest.patient_phone }]
            : []),
          {
            label: "Cita reservada",
            value: new Date(selectedRegistrationRequest.requested_start).toLocaleString("es-CO", {
              weekday: "long", year: "numeric", month: "long",
              day: "numeric", hour: "2-digit", minute: "2-digit",
            }),
          },
        ].map(({ label, value }) => (
          <div key={label}>
            <dt className="psy-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--psy-ink-3)" }}>{label}</dt>
            <dd className="text-[13px] mt-0.5" style={{ color: "var(--psy-ink-1)" }}>{value}</dd>
          </div>
        ))}
        {selectedRegistrationRequest.registration_token_expires_at && (
          <div>
            <dt className="psy-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--psy-ink-3)" }}>Enlace válido hasta</dt>
            <dd className="text-[13px] mt-0.5" style={{
              color: new Date(selectedRegistrationRequest.registration_token_expires_at) < new Date()
                ? "var(--psy-danger)" : "var(--psy-ink-1)"
            }}>
              {new Date(selectedRegistrationRequest.registration_token_expires_at) < new Date()
                ? "⚠ Expirado"
                : new Date(selectedRegistrationRequest.registration_token_expires_at).toLocaleString("es-CO", {
                    day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
                  })
              }
            </dd>
          </div>
        )}
      </dl>
      <button
        type="button"
        disabled={resendMutation.isPending}
        onClick={() => resendMutation.mutate(selectedRegistrationRequest.id, {
          onSuccess: (updated) => setSelectedRegistrationRequest(updated),
        })}
        className="w-full text-[13px] py-2 rounded-md font-medium disabled:opacity-50 transition-colors"
        style={{ background: "#7C4DFF", color: "#fff" }}
      >
        {resendMutation.isPending ? "Enviando..." : "↩ Reenviar email de registro"}
      </button>
      <p className="text-[11px]" style={{ color: "var(--psy-ink-3)" }}>
        El paciente recibirá un nuevo enlace válido por 48 horas.
      </p>
    </div>
  </div>
)}
```

- [ ] **Step 7: Update the header counter to include registration-pending count**

```tsx
{pendingRequests > 0 && (
  <> · <span style={{ color: "var(--psy-warn)" }}>{pendingRequests} solicitud{pendingRequests !== 1 ? "es" : ""} pendiente{pendingRequests !== 1 ? "s" : ""}</span></>
)}
{registrationPendingRequests.length > 0 && (
  <> · <span style={{ color: "#7C4DFF" }}>{registrationPendingRequests.length} registro{registrationPendingRequests.length !== 1 ? "s" : ""} pendiente{registrationPendingRequests.length !== 1 ? "s" : ""}</span></>
)}
```

- [ ] **Step 8: Add purple to legend**

```tsx
<span className="flex items-center gap-1.5">
  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#7C4DFF" }} /> Registro pendiente
</span>
```

- [ ] **Step 9: Run frontend lint check**

```bash
cd psicogest/frontend
npm run lint
```

Expected: no new errors.

- [ ] **Step 10: Commit**

```bash
git add psicogest/frontend/src/App.tsx psicogest/frontend/src/pages/agenda/AgendaPage.tsx
git commit -m "feat(agenda): show registration-pending events in purple with resend action"
```

---

## Task 12: Final Integration Test

- [ ] **Step 1: Start backend and frontend**

```bash
# Terminal 1
cd psicogest/backend && uvicorn app.main:app --reload

# Terminal 2
cd psicogest/frontend && npm run dev
```

- [ ] **Step 2: Happy path test**

1. Go to `/book/{slug}` and create a booking request with an email that has NO patient record.
2. Log in as psychologist → go to Agenda → click the pending request → click "Confirmar".
3. Verify toast: "Se envió un email a [email] para completar el registro. Recuérdale revisarlo."
4. Verify the event turns purple (📋) in the calendar.
5. Check backend logs for "Failed to send..." — if Resend not configured in dev, that's expected.
6. Manually call `GET /api/v1/public/booking/registration/{token}` with the token from the DB.
7. Open `/completar-registro/{token}` — verify form is pre-filled with patient name and email.
8. Submit the form → verify "¡Registro completado!" screen.
9. Go back to Agenda → verify the purple event is gone and a blue appointment appears.

- [ ] **Step 3: Error path tests**

```bash
# Expired token
curl -X GET "http://localhost:8000/api/v1/public/booking/registration/fake-token"
# Expected: 404 {"detail":"Enlace no encontrado."}

# Used token (after completing registration)
curl -X POST "http://localhost:8000/api/v1/public/booking/registration/{used_token}" \
  -H "Content-Type: application/json" \
  -d '{"doc_type":"CC","doc_number":"123","birth_date":"1990-01-01","biological_sex":"M","phone":"3001234567"}'
# Expected: 410 {"detail":"Este enlace ya fue utilizado."}
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: patient registration flow complete — token email + form + portal activation"
```
