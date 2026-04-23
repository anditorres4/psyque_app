# Sprint 4 — Recordatorios + Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add APScheduler background jobs that send 48h/2h appointment reminders via Resend email, and build a functional Dashboard page showing today's appointments, pending closures, 30-day attendance rate, and next upcoming appointments.

**Architecture:** APScheduler runs a background thread every 15 minutes scanning for appointments due for reminders using a standalone DB session (superuser bypass of RLS). The Dashboard exposes a single `GET /api/v1/dashboard/stats` endpoint backed by a `DashboardService` with pure ORM queries; the React `DashboardPage` calls this via a React Query hook and renders stat cards + upcoming list.

**Tech Stack:** APScheduler 3.x (`BackgroundScheduler`), httpx (already installed) → Resend REST API, Python `zoneinfo` (stdlib), FastAPI lifespan context manager, React Query, shadcn/ui Card.

---

## File Map

**Create:**
- `psicogest/backend/app/services/email_service.py` — Resend HTTP wrapper
- `psicogest/backend/app/jobs/__init__.py` — package marker
- `psicogest/backend/app/jobs/reminders.py` — ReminderService + run_reminder_check
- `psicogest/backend/app/schemas/dashboard.py` — DashboardStats schema
- `psicogest/backend/app/services/dashboard_service.py` — stats queries
- `psicogest/backend/app/api/v1/dashboard.py` — GET /dashboard/stats router
- `psicogest/backend/tests/test_email_service.py`
- `psicogest/backend/tests/test_reminders.py`
- `psicogest/backend/tests/test_dashboard.py`
- `psicogest/frontend/src/hooks/useDashboard.ts`

**Modify:**
- `psicogest/backend/pyproject.toml` — add `apscheduler>=3.10.0`
- `psicogest/backend/app/core/config.py` — add `resend_from_email`
- `psicogest/backend/app/main.py` — add lifespan + dashboard router
- `psicogest/frontend/src/lib/api.ts` — add `dashboard.getStats()`
- `psicogest/frontend/src/pages/DashboardPage.tsx` — full stats UI

---

### Task 1: APScheduler dependency + config field

**Files:**
- Modify: `psicogest/backend/pyproject.toml`
- Modify: `psicogest/backend/app/core/config.py`

- [ ] **Step 1: Add apscheduler to pyproject.toml**

Open `psicogest/backend/pyproject.toml` and add `"apscheduler>=3.10.0",` to the `dependencies` list:

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
    "apscheduler>=3.10.0",
]
```

- [ ] **Step 2: Install the new dependency**

Run from `psicogest/backend/`:
```bash
pip install apscheduler>=3.10.0
```
Expected: `Successfully installed apscheduler-3.x.x`

- [ ] **Step 3: Add resend_from_email to config**

Open `psicogest/backend/app/core/config.py` and add the `resend_from_email` field after `resend_api_key`:

```python
"""Application configuration loaded from environment variables."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All settings required at startup — app fails fast if any is missing."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Supabase
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_jwk: str
    supabase_database_url: str

    # App
    app_url: str = "http://localhost:3000"
    environment: str = "development"

    # Email (Resend)
    resend_api_key: str = ""
    resend_from_email: str = "noreply@psyque.app"

    @property
    def is_development(self) -> bool:
        return self.environment == "development"


settings = Settings()
```

- [ ] **Step 4: Verify config loads**

Run from `psicogest/backend/`:
```bash
python -c "from app.core.config import settings; print(settings.resend_from_email)"
```
Expected: `noreply@psyque.app`

- [ ] **Step 5: Commit**

```bash
git add psicogest/backend/pyproject.toml psicogest/backend/app/core/config.py
git commit -m "feat(sprint4): add apscheduler dep + resend_from_email config"
```

---

### Task 2: EmailService

**Files:**
- Create: `psicogest/backend/app/services/email_service.py`
- Create: `psicogest/backend/tests/test_email_service.py`

- [ ] **Step 1: Write the failing tests**

Create `psicogest/backend/tests/test_email_service.py`:

```python
"""Tests for EmailService — httpx calls mocked to avoid real Resend API."""
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.services.email_service import EmailService


@pytest.fixture
def svc():
    return EmailService()


def test_send_reminder_returns_false_when_no_api_key(svc):
    """Should not call httpx and return False when resend_api_key is empty."""
    with patch("app.services.email_service.settings") as mock_settings:
        mock_settings.resend_api_key = ""
        result = svc.send_reminder(
            to_email="patient@example.com",
            patient_name="Juan Pérez",
            appointment_start=datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc),
            hours_ahead=48,
        )
    assert result is False


def test_send_48h_reminder_posts_to_resend(svc):
    """Should POST to Resend with correct payload and return True."""
    mock_response = MagicMock()
    mock_response.raise_for_status.return_value = None

    with patch("app.services.email_service.settings") as mock_settings, \
         patch("app.services.email_service.httpx.post", return_value=mock_response) as mock_post:
        mock_settings.resend_api_key = "re_test_key"
        mock_settings.resend_from_email = "noreply@psyque.app"

        result = svc.send_reminder(
            to_email="patient@example.com",
            patient_name="Juan Pérez",
            appointment_start=datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc),
            hours_ahead=48,
        )

    assert result is True
    mock_post.assert_called_once()
    payload = mock_post.call_args.kwargs["json"]
    assert payload["to"] == ["patient@example.com"]
    assert "48 horas" in payload["subject"]
    assert "Juan Pérez" in payload["html"]


def test_send_2h_reminder_subject_says_2_horas(svc):
    """Subject must say '2 horas' for the 2h reminder."""
    mock_response = MagicMock()
    mock_response.raise_for_status.return_value = None

    with patch("app.services.email_service.settings") as mock_settings, \
         patch("app.services.email_service.httpx.post", return_value=mock_response) as mock_post:
        mock_settings.resend_api_key = "re_test_key"
        mock_settings.resend_from_email = "noreply@psyque.app"

        svc.send_reminder(
            to_email="p@example.com",
            patient_name="Ana García",
            appointment_start=datetime(2026, 5, 1, 14, 0, tzinfo=timezone.utc),
            hours_ahead=2,
        )

    payload = mock_post.call_args.kwargs["json"]
    assert "2 horas" in payload["subject"]
    assert "48 horas" not in payload["subject"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `psicogest/backend/`:
```bash
pytest tests/test_email_service.py -v
```
Expected: `ERROR` with `ModuleNotFoundError: No module named 'app.services.email_service'`

- [ ] **Step 3: Implement EmailService**

Create `psicogest/backend/app/services/email_service.py`:

```python
"""Thin wrapper around Resend REST API for sending reminder emails."""
from datetime import datetime

import httpx

from app.core.config import settings


class EmailService:
    """Sends reminder emails via Resend. Skips silently if resend_api_key is empty."""

    RESEND_URL = "https://api.resend.com/emails"

    def send_reminder(
        self,
        *,
        to_email: str,
        patient_name: str,
        appointment_start: datetime,
        hours_ahead: int,
    ) -> bool:
        """POST reminder email to Resend. Returns True if sent, False if skipped."""
        if not settings.resend_api_key:
            return False

        label = "48 horas" if hours_ahead == 48 else "2 horas"
        date_str = appointment_start.strftime("%A %d de %B de %Y")
        time_str = appointment_start.strftime("%H:%M")

        payload = {
            "from": settings.resend_from_email,
            "to": [to_email],
            "subject": f"Recordatorio de cita — {label}",
            "html": (
                f"<p>Hola {patient_name},</p>"
                f"<p>Te recordamos que tienes una cita programada en "
                f"<strong>{label}</strong>:</p>"
                f"<p><strong>Fecha:</strong> {date_str}<br>"
                f"<strong>Hora:</strong> {time_str}</p>"
                f"<p>Si necesitas cancelar o reprogramar, contacta a tu psicólogo.</p>"
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

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_email_service.py -v
```
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add psicogest/backend/app/services/email_service.py psicogest/backend/tests/test_email_service.py
git commit -m "feat(sprint4): EmailService — Resend httpx wrapper with tests"
```

---

### Task 3: ReminderService + run_reminder_check

**Files:**
- Create: `psicogest/backend/app/jobs/__init__.py`
- Create: `psicogest/backend/app/jobs/reminders.py`
- Create: `psicogest/backend/tests/test_reminders.py`

- [ ] **Step 1: Write the failing tests**

Create `psicogest/backend/tests/test_reminders.py`:

```python
"""Tests for ReminderService scanning logic and run_reminder_check orchestration."""
import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.jobs.reminders import ReminderService, run_reminder_check


TENANT_ID = str(uuid.uuid4())
PATIENT_ID = str(uuid.uuid4())


@pytest.fixture(scope="session")
def engine():
    """SQLite in-memory — only Appointment table; Patient uses PostgreSQL INET."""
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Appointment.__table__.create(eng, checkfirst=True)
    return eng


@pytest.fixture
def db(engine):
    with engine.connect() as conn:
        conn.execute(text("PRAGMA journal_mode=WAL"))
        with Session(conn) as session:
            yield session
            session.rollback()


@pytest.fixture
def svc():
    return ReminderService()


def _make_appt(db: Session, start: datetime, **kwargs) -> Appointment:
    appt = Appointment(
        id=uuid.uuid4(),
        tenant_id=uuid.UUID(TENANT_ID),
        patient_id=uuid.UUID(PATIENT_ID),
        scheduled_start=start,
        scheduled_end=start + timedelta(hours=1),
        session_type="individual",
        modality="presential",
        status=kwargs.get("status", "scheduled"),
        reminder_sent_48h=kwargs.get("reminder_sent_48h", False),
        reminder_sent_2h=kwargs.get("reminder_sent_2h", False),
        notes=None,
    )
    db.add(appt)
    db.flush()
    return appt


# ---- ReminderService unit tests (SQLite) ----

def test_get_due_48h_returns_appointment_in_window(svc, db):
    now = datetime.now(tz=timezone.utc)
    appt = _make_appt(db, start=now + timedelta(hours=47, minutes=50))
    results = svc.get_due_48h(db)
    assert any(r.id == appt.id for r in results)


def test_get_due_48h_excludes_already_sent(svc, db):
    now = datetime.now(tz=timezone.utc)
    appt = _make_appt(db, start=now + timedelta(hours=47, minutes=52), reminder_sent_48h=True)
    results = svc.get_due_48h(db)
    assert not any(r.id == appt.id for r in results)


def test_get_due_48h_excludes_appointments_outside_window(svc, db):
    now = datetime.now(tz=timezone.utc)
    appt = _make_appt(db, start=now + timedelta(hours=50))  # too far ahead
    results = svc.get_due_48h(db)
    assert not any(r.id == appt.id for r in results)


def test_get_due_2h_returns_appointment_in_window(svc, db):
    now = datetime.now(tz=timezone.utc)
    appt = _make_appt(db, start=now + timedelta(hours=1, minutes=50))
    results = svc.get_due_2h(db)
    assert any(r.id == appt.id for r in results)


def test_get_due_2h_excludes_already_sent(svc, db):
    now = datetime.now(tz=timezone.utc)
    appt = _make_appt(db, start=now + timedelta(hours=1, minutes=52), reminder_sent_2h=True)
    results = svc.get_due_2h(db)
    assert not any(r.id == appt.id for r in results)


def test_mark_48h_sent_sets_flag(svc, db):
    now = datetime.now(tz=timezone.utc)
    appt = _make_appt(db, start=now + timedelta(hours=47, minutes=55))
    svc.mark_48h_sent(db, appt)
    assert appt.reminder_sent_48h is True


def test_mark_2h_sent_sets_flag(svc, db):
    now = datetime.now(tz=timezone.utc)
    appt = _make_appt(db, start=now + timedelta(hours=1, minutes=55))
    svc.mark_2h_sent(db, appt)
    assert appt.reminder_sent_2h is True


# ---- run_reminder_check integration tests (fully mocked) ----

def test_run_reminder_check_sends_48h_email_and_marks_sent():
    """run_reminder_check calls email_service and marks 48h flag."""
    mock_appt = MagicMock()
    mock_appt.id = uuid.uuid4()
    mock_appt.patient_id = uuid.uuid4()
    mock_appt.scheduled_start = datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc)

    mock_patient = MagicMock()
    mock_patient.email = "patient@example.com"
    mock_patient.full_name = "Juan Pérez"

    mock_db = MagicMock()
    mock_factory = MagicMock(return_value=mock_db)
    mock_email = MagicMock()
    mock_email.send_reminder.return_value = True

    mock_svc = MagicMock(spec=ReminderService)
    mock_svc.get_due_48h.return_value = [mock_appt]
    mock_svc.get_due_2h.return_value = []
    mock_svc.get_patient.return_value = mock_patient

    with patch("app.jobs.reminders.ReminderService", return_value=mock_svc):
        run_reminder_check(mock_factory, email_service=mock_email)

    mock_email.send_reminder.assert_called_once_with(
        to_email="patient@example.com",
        patient_name="Juan Pérez",
        appointment_start=mock_appt.scheduled_start,
        hours_ahead=48,
    )
    mock_svc.mark_48h_sent.assert_called_once_with(mock_db, mock_appt)
    mock_db.commit.assert_called_once()


def test_run_reminder_check_marks_sent_when_patient_has_no_email():
    """When patient.email is None, skip sending but still mark flag."""
    mock_appt = MagicMock()
    mock_appt.id = uuid.uuid4()
    mock_appt.patient_id = uuid.uuid4()
    mock_appt.scheduled_start = datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc)

    mock_patient = MagicMock()
    mock_patient.email = None

    mock_db = MagicMock()
    mock_factory = MagicMock(return_value=mock_db)
    mock_email = MagicMock()

    mock_svc = MagicMock(spec=ReminderService)
    mock_svc.get_due_48h.return_value = [mock_appt]
    mock_svc.get_due_2h.return_value = []
    mock_svc.get_patient.return_value = mock_patient

    with patch("app.jobs.reminders.ReminderService", return_value=mock_svc):
        run_reminder_check(mock_factory, email_service=mock_email)

    mock_email.send_reminder.assert_not_called()
    mock_svc.mark_48h_sent.assert_called_once_with(mock_db, mock_appt)


def test_run_reminder_check_sends_2h_email():
    """run_reminder_check sends 2h reminder correctly."""
    mock_appt = MagicMock()
    mock_appt.id = uuid.uuid4()
    mock_appt.patient_id = uuid.uuid4()
    mock_appt.scheduled_start = datetime(2026, 5, 1, 14, 0, tzinfo=timezone.utc)

    mock_patient = MagicMock()
    mock_patient.email = "p@example.com"
    mock_patient.full_name = "Ana García"

    mock_db = MagicMock()
    mock_factory = MagicMock(return_value=mock_db)
    mock_email = MagicMock()
    mock_email.send_reminder.return_value = True

    mock_svc = MagicMock(spec=ReminderService)
    mock_svc.get_due_48h.return_value = []
    mock_svc.get_due_2h.return_value = [mock_appt]
    mock_svc.get_patient.return_value = mock_patient

    with patch("app.jobs.reminders.ReminderService", return_value=mock_svc):
        run_reminder_check(mock_factory, email_service=mock_email)

    mock_email.send_reminder.assert_called_once_with(
        to_email="p@example.com",
        patient_name="Ana García",
        appointment_start=mock_appt.scheduled_start,
        hours_ahead=2,
    )
    mock_svc.mark_2h_sent.assert_called_once_with(mock_db, mock_appt)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_reminders.py -v
```
Expected: `ERROR` with `ModuleNotFoundError: No module named 'app.jobs'`

- [ ] **Step 3: Create the jobs package**

Create `psicogest/backend/app/jobs/__init__.py` (empty):
```python
```

- [ ] **Step 4: Implement reminders.py**

Create `psicogest/backend/app/jobs/reminders.py`:

```python
"""Background job: scan and send appointment reminders at 48h and 2h windows."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.patient import Patient
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)


class ReminderService:
    """Queries appointments due for reminder and marks flags after sending.

    These queries run without SET LOCAL app.tenant_id — they rely on the
    postgres superuser connection bypassing RLS to scan across all tenants.
    """

    def get_due_48h(self, db: Session) -> list[Appointment]:
        """Return scheduled appointments starting in [now+47h45m, now+48h], reminder not sent."""
        now = datetime.now(tz=timezone.utc)
        window_start = now + timedelta(hours=47, minutes=45)
        window_end = now + timedelta(hours=48)
        return (
            db.query(Appointment)
            .filter(
                Appointment.status == "scheduled",
                Appointment.reminder_sent_48h.is_(False),
                Appointment.scheduled_start >= window_start,
                Appointment.scheduled_start < window_end,
            )
            .all()
        )

    def get_due_2h(self, db: Session) -> list[Appointment]:
        """Return scheduled appointments starting in [now+1h45m, now+2h], reminder not sent."""
        now = datetime.now(tz=timezone.utc)
        window_start = now + timedelta(hours=1, minutes=45)
        window_end = now + timedelta(hours=2)
        return (
            db.query(Appointment)
            .filter(
                Appointment.status == "scheduled",
                Appointment.reminder_sent_2h.is_(False),
                Appointment.scheduled_start >= window_start,
                Appointment.scheduled_start < window_end,
            )
            .all()
        )

    def get_patient(self, db: Session, patient_id) -> Patient | None:
        return db.get(Patient, patient_id)

    def mark_48h_sent(self, db: Session, appt: Appointment) -> None:
        appt.reminder_sent_48h = True
        db.flush()

    def mark_2h_sent(self, db: Session, appt: Appointment) -> None:
        appt.reminder_sent_2h = True
        db.flush()


def run_reminder_check(
    session_factory,
    email_service: EmailService | None = None,
) -> None:
    """APScheduler entry point. Opens its own DB session (no tenant RLS context)."""
    if email_service is None:
        email_service = EmailService()

    svc = ReminderService()
    db = session_factory()
    try:
        for appt in svc.get_due_48h(db):
            patient = svc.get_patient(db, appt.patient_id)
            if patient and patient.email:
                try:
                    email_service.send_reminder(
                        to_email=patient.email,
                        patient_name=patient.full_name,
                        appointment_start=appt.scheduled_start,
                        hours_ahead=48,
                    )
                except Exception:
                    logger.exception("Failed to send 48h reminder for appt %s", appt.id)
            svc.mark_48h_sent(db, appt)

        for appt in svc.get_due_2h(db):
            patient = svc.get_patient(db, appt.patient_id)
            if patient and patient.email:
                try:
                    email_service.send_reminder(
                        to_email=patient.email,
                        patient_name=patient.full_name,
                        appointment_start=appt.scheduled_start,
                        hours_ahead=2,
                    )
                except Exception:
                    logger.exception("Failed to send 2h reminder for appt %s", appt.id)
            svc.mark_2h_sent(db, appt)

        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Reminder check failed")
    finally:
        db.close()
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_reminders.py -v
```
Expected: `10 passed`

- [ ] **Step 6: Commit**

```bash
git add psicogest/backend/app/jobs/__init__.py psicogest/backend/app/jobs/reminders.py psicogest/backend/tests/test_reminders.py
git commit -m "feat(sprint4): ReminderService + run_reminder_check with tests"
```

---

### Task 4: Wire APScheduler lifespan into main.py

**Files:**
- Modify: `psicogest/backend/app/main.py`

- [ ] **Step 1: Update main.py to add lifespan with scheduler**

Replace the full content of `psicogest/backend/app/main.py`:

```python
"""FastAPI application factory for psyque app backend."""
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.auth_routes import router as auth_router
from app.api.v1.health import router as health_router
from app.api.v1.appointments import router as appointments_router
from app.api.v1.patients import router as patients_router
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
```

- [ ] **Step 2: Verify the app imports cleanly**

Run from `psicogest/backend/`:
```bash
python -c "from app.main import app; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add psicogest/backend/app/main.py
git commit -m "feat(sprint4): wire APScheduler lifespan — 15-min reminder check"
```

---

### Task 5: DashboardService + schema + tests

**Files:**
- Create: `psicogest/backend/app/schemas/dashboard.py`
- Create: `psicogest/backend/app/services/dashboard_service.py`
- Create: `psicogest/backend/tests/test_dashboard.py`

- [ ] **Step 1: Write the failing tests**

Create `psicogest/backend/tests/test_dashboard.py`:

```python
"""Tests for DashboardService — stat calculations."""
import uuid
from datetime import datetime, timezone, timedelta

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.services.dashboard_service import DashboardService


TENANT_ID = str(uuid.uuid4())
OTHER_TENANT_ID = str(uuid.uuid4())
PATIENT_ID = str(uuid.uuid4())


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Appointment.__table__.create(eng, checkfirst=True)
    return eng


@pytest.fixture
def db(engine):
    with engine.connect() as conn:
        conn.execute(text("PRAGMA journal_mode=WAL"))
        with Session(conn) as session:
            yield session
            session.rollback()


@pytest.fixture
def svc(db):
    return DashboardService(db, TENANT_ID)


def _make_appt(db: Session, start: datetime, status: str = "scheduled", tenant_id: str = TENANT_ID) -> Appointment:
    appt = Appointment(
        id=uuid.uuid4(),
        tenant_id=uuid.UUID(tenant_id),
        patient_id=uuid.UUID(PATIENT_ID),
        scheduled_start=start,
        scheduled_end=start + timedelta(hours=1),
        session_type="individual",
        modality="presential",
        status=status,
        reminder_sent_48h=False,
        reminder_sent_2h=False,
        notes=None,
    )
    db.add(appt)
    db.flush()
    return appt


def test_appointments_today_counts_scheduled_today(svc, db):
    now = datetime.now(tz=timezone.utc)
    _make_appt(db, start=now + timedelta(hours=2))  # today, future
    stats = svc.get_stats()
    assert stats["appointments_today"] >= 1


def test_appointments_today_excludes_other_tenant(svc, db):
    now = datetime.now(tz=timezone.utc)
    _make_appt(db, start=now + timedelta(hours=3), tenant_id=OTHER_TENANT_ID)
    before = svc.get_stats()["appointments_today"]
    # Add another for our tenant
    _make_appt(db, start=now + timedelta(hours=4))
    after = svc.get_stats()["appointments_today"]
    assert after == before + 1


def test_pending_to_close_counts_past_scheduled(svc, db):
    now = datetime.now(tz=timezone.utc)
    # Past appointment still "scheduled"
    _make_appt(db, start=now - timedelta(hours=3))
    stats = svc.get_stats()
    assert stats["pending_to_close"] >= 1


def test_pending_to_close_excludes_completed(svc, db):
    now = datetime.now(tz=timezone.utc)
    _make_appt(db, start=now - timedelta(hours=5), status="completed")
    before = svc.get_stats()["pending_to_close"]
    # completed past appointments should not count
    _make_appt(db, start=now - timedelta(hours=6), status="completed")
    after = svc.get_stats()["pending_to_close"]
    assert after == before  # no change


def test_attendance_rate_30d_returns_none_when_no_data(svc, db):
    # Fresh service with a unique tenant that has no completed/noshow
    fresh_svc = DashboardService(db, str(uuid.uuid4()))
    stats = fresh_svc.get_stats()
    assert stats["attendance_rate_30d"] is None


def test_attendance_rate_30d_calculates_correctly(svc, db):
    fresh_tenant = str(uuid.uuid4())
    fresh_svc = DashboardService(db, fresh_tenant)
    now = datetime.now(tz=timezone.utc)
    # 3 completed, 1 noshow → 75%
    for _ in range(3):
        _make_appt(db, start=now - timedelta(days=5), status="completed", tenant_id=fresh_tenant)
    _make_appt(db, start=now - timedelta(days=5), status="noshow", tenant_id=fresh_tenant)
    stats = fresh_svc.get_stats()
    assert stats["attendance_rate_30d"] == 75.0


def test_upcoming_returns_next_scheduled_only(svc, db):
    fresh_tenant = str(uuid.uuid4())
    fresh_svc = DashboardService(db, fresh_tenant)
    now = datetime.now(tz=timezone.utc)
    for i in range(3):
        _make_appt(db, start=now + timedelta(hours=i + 1), tenant_id=fresh_tenant)
    stats = fresh_svc.get_stats()
    assert len(stats["upcoming"]) == 3
    # Verify sorted ascending
    starts = [a.scheduled_start for a in stats["upcoming"]]
    assert starts == sorted(starts)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_dashboard.py -v
```
Expected: `ERROR` with `ModuleNotFoundError: No module named 'app.services.dashboard_service'`

- [ ] **Step 3: Implement DashboardStats schema**

Create `psicogest/backend/app/schemas/dashboard.py`:

```python
"""Pydantic schema for dashboard stats response."""
from pydantic import BaseModel

from app.schemas.appointment import AppointmentSummary


class DashboardStats(BaseModel):
    appointments_today: int
    pending_to_close: int
    attendance_rate_30d: float | None
    upcoming: list[AppointmentSummary]
```

- [ ] **Step 4: Implement DashboardService**

Create `psicogest/backend/app/services/dashboard_service.py`:

```python
"""Dashboard stats for the authenticated tenant."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.schemas.appointment import AppointmentSummary

BOGOTA_TZ = ZoneInfo("America/Bogota")


class DashboardService:
    """Computes dashboard metrics for a single tenant."""

    def __init__(self, db: Session, tenant_id: str) -> None:
        self.db = db
        self.tenant_id = uuid.UUID(tenant_id)

    def get_stats(self) -> dict:
        """Return appointments_today, pending_to_close, attendance_rate_30d, upcoming."""
        now_utc = datetime.now(tz=timezone.utc)

        # "Today" computed in Colombia time (UTC-5, no DST)
        now_bogota = now_utc.astimezone(BOGOTA_TZ)
        today_start = now_bogota.replace(
            hour=0, minute=0, second=0, microsecond=0
        ).astimezone(timezone.utc)
        today_end = today_start + timedelta(days=1)

        appointments_today = (
            self.db.query(Appointment)
            .filter(
                Appointment.tenant_id == self.tenant_id,
                Appointment.status == "scheduled",
                Appointment.scheduled_start >= today_start,
                Appointment.scheduled_start < today_end,
            )
            .count()
        )

        pending_to_close = (
            self.db.query(Appointment)
            .filter(
                Appointment.tenant_id == self.tenant_id,
                Appointment.status == "scheduled",
                Appointment.scheduled_end < now_utc,
            )
            .count()
        )

        thirty_days_ago = now_utc - timedelta(days=30)

        completed = (
            self.db.query(Appointment)
            .filter(
                Appointment.tenant_id == self.tenant_id,
                Appointment.status == "completed",
                Appointment.scheduled_start >= thirty_days_ago,
            )
            .count()
        )
        noshow = (
            self.db.query(Appointment)
            .filter(
                Appointment.tenant_id == self.tenant_id,
                Appointment.status == "noshow",
                Appointment.scheduled_start >= thirty_days_ago,
            )
            .count()
        )

        total_attended = completed + noshow
        attendance_rate = (
            round(completed / total_attended * 100, 1) if total_attended > 0 else None
        )

        upcoming = (
            self.db.query(Appointment)
            .filter(
                Appointment.tenant_id == self.tenant_id,
                Appointment.status == "scheduled",
                Appointment.scheduled_start >= now_utc,
            )
            .order_by(Appointment.scheduled_start)
            .limit(5)
            .all()
        )

        return {
            "appointments_today": appointments_today,
            "pending_to_close": pending_to_close,
            "attendance_rate_30d": attendance_rate,
            "upcoming": [AppointmentSummary.model_validate(a) for a in upcoming],
        }
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_dashboard.py -v
```
Expected: `7 passed`

- [ ] **Step 6: Commit**

```bash
git add psicogest/backend/app/schemas/dashboard.py psicogest/backend/app/services/dashboard_service.py psicogest/backend/tests/test_dashboard.py
git commit -m "feat(sprint4): DashboardService + schema with tests"
```

---

### Task 6: Dashboard API endpoint

**Files:**
- Create: `psicogest/backend/app/api/v1/dashboard.py`
- Modify: `psicogest/backend/app/main.py`

- [ ] **Step 1: Create the dashboard router**

Create `psicogest/backend/app/api/v1/dashboard.py`:

```python
"""Dashboard stats endpoint."""
from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.deps import get_tenant_db, TenantDB
from app.schemas.dashboard import DashboardStats
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> DashboardStats:
    svc = DashboardService(ctx.db, ctx.tenant.tenant_id)
    data = svc.get_stats()
    return DashboardStats(**data)
```

- [ ] **Step 2: Register the router in main.py**

Add the dashboard router import and registration to `psicogest/backend/app/main.py`. The final file should be:

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
app.include_router(dashboard_router, prefix="/api/v1")
```

- [ ] **Step 3: Verify the app imports and the route is registered**

```bash
python -c "
from app.main import app
routes = [r.path for r in app.routes]
assert '/api/v1/dashboard/stats' in routes, f'Missing route. Found: {routes}'
print('OK — /api/v1/dashboard/stats registered')
"
```
Expected: `OK — /api/v1/dashboard/stats registered`

- [ ] **Step 4: Commit**

```bash
git add psicogest/backend/app/api/v1/dashboard.py psicogest/backend/app/main.py
git commit -m "feat(sprint4): dashboard API endpoint GET /api/v1/dashboard/stats"
```

---

### Task 7: Dashboard frontend

**Files:**
- Modify: `psicogest/frontend/src/lib/api.ts`
- Create: `psicogest/frontend/src/hooks/useDashboard.ts`
- Modify: `psicogest/frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Add dashboard types and method to api.ts**

Open `psicogest/frontend/src/lib/api.ts` and add after the appointments section (before the closing `};` of the `api` object):

After line `export interface CancelPayload { ... }` (the last interface), add:

```typescript
// --- Dashboard ---------------------------------------------------------------

export interface DashboardStats {
  appointments_today: number;
  pending_to_close: number;
  attendance_rate_30d: number | null;
  upcoming: AppointmentSummary[];
}
```

And inside the `api` object, add the `dashboard` key after `appointments`:

```typescript
  dashboard: {
    getStats: () => request<DashboardStats>("GET", "/dashboard/stats"),
  },
```

The full `api` object's closing section should look like:

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
  dashboard: {
    getStats: () => request<DashboardStats>("GET", "/dashboard/stats"),
  },
};
```

- [ ] **Step 2: Create useDashboard hook**

Create `psicogest/frontend/src/hooks/useDashboard.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => api.dashboard.getStats(),
    staleTime: 60_000, // refresh every minute
  });
}
```

- [ ] **Step 3: Implement DashboardPage.tsx**

Replace the full content of `psicogest/frontend/src/pages/DashboardPage.tsx`:

```tsx
import { useDashboardStats } from "@/hooks/useDashboard";
import type { AppointmentSummary } from "@/lib/api";

const SESSION_TYPE_LABELS: Record<string, string> = {
  individual: "Individual",
  couple: "Pareja",
  family: "Familia",
  followup: "Seguimiento",
};

const MODALITY_LABELS: Record<string, string> = {
  presential: "Presencial",
  virtual: "Virtual",
};

function StatCard({
  label,
  value,
  sublabel,
  accent,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  accent: "blue" | "orange" | "green";
}) {
  const accentClass = {
    blue: "border-l-[#2E86AB]",
    orange: "border-l-amber-500",
    green: "border-l-[#27AE60]",
  }[accent];

  return (
    <div className={`bg-white rounded-lg border border-gray-100 border-l-4 ${accentClass} p-5 shadow-sm`}>
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className="text-3xl font-bold text-[#1E3A5F]">{value}</p>
      {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
    </div>
  );
}

function UpcomingRow({ appt }: { appt: AppointmentSummary }) {
  const start = new Date(appt.scheduled_start);
  const dateStr = start.toLocaleDateString("es-CO", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeStr = start.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3">
        <div className="text-center min-w-[48px]">
          <p className="text-xs text-muted-foreground">{dateStr.split(" ")[0]}</p>
          <p className="text-sm font-semibold text-[#1E3A5F]">{timeStr}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-[#1E3A5F]">
            {SESSION_TYPE_LABELS[appt.session_type] ?? appt.session_type}
          </p>
          <p className="text-xs text-muted-foreground">
            {dateStr} · {MODALITY_LABELS[appt.modality] ?? appt.modality}
          </p>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { data, isLoading, isError } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="p-8 text-[#1E3A5F] text-sm">Cargando...</div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-8 text-[#E74C3C] text-sm">
        Error al cargar el dashboard.
      </div>
    );
  }

  const attendanceDisplay =
    data.attendance_rate_30d !== null ? `${data.attendance_rate_30d}%` : "—";

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Resumen de actividad de tu consulta
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Citas hoy"
          value={data.appointments_today}
          sublabel="Pendientes de atender"
          accent="blue"
        />
        <StatCard
          label="Pendientes de cerrar"
          value={data.pending_to_close}
          sublabel="Pasadas sin marcar como completadas"
          accent="orange"
        />
        <StatCard
          label="Asistencia 30 días"
          value={attendanceDisplay}
          sublabel={data.attendance_rate_30d !== null ? "Completadas / (Completadas + No asistió)" : "Sin datos suficientes"}
          accent="green"
        />
      </div>

      {data.upcoming.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b">
            <h2 className="text-sm font-semibold text-[#1E3A5F] uppercase tracking-wide">
              Próximas citas
            </h2>
          </div>
          <div className="px-5">
            {data.upcoming.map((appt) => (
              <UpcomingRow key={appt.id} appt={appt} />
            ))}
          </div>
        </div>
      )}

      {data.upcoming.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6 text-center text-muted-foreground text-sm">
          No hay citas próximas agendadas.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run from `psicogest/frontend/`:
```bash
npx tsc --noEmit
```
Expected: no errors (exit code 0)

- [ ] **Step 5: Commit**

```bash
git add psicogest/frontend/src/lib/api.ts psicogest/frontend/src/hooks/useDashboard.ts psicogest/frontend/src/pages/DashboardPage.tsx
git commit -m "feat(sprint4): dashboard frontend — stat cards + upcoming appointments"
```

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|---|---|
| 48h reminder emails | Tasks 2, 3 |
| 2h reminder emails | Tasks 2, 3 |
| APScheduler every 15 min | Task 4 |
| Mark reminder_sent_48h / reminder_sent_2h flags | Task 3 |
| Silently skip if patient has no email | Task 3 (mark_sent anyway) |
| resend_api_key already in config | Task 1 (adds resend_from_email) |
| Dashboard: citas del día | Task 5, 6, 7 |
| Dashboard: pendientes de cerrar | Task 5, 6, 7 |
| Dashboard: tasa de asistencia 30 días | Task 5, 6, 7 |
| Dashboard: próximas citas | Task 5, 6, 7 |

### Placeholder Scan
No placeholders — all steps contain complete code.

### Type Consistency
- `DashboardStats` in `dashboard.py` schema uses `list[AppointmentSummary]` — `AppointmentSummary` is imported from `app.schemas.appointment` ✓
- `useDashboardStats()` returns `DashboardStats` interface defined in `api.ts` ✓
- `DashboardStats.upcoming` is `AppointmentSummary[]` — same type used in `UpcomingRow` ✓
- `run_reminder_check(session_factory, email_service=None)` — called in `main.py` as `kwargs={"session_factory": SessionLocal}` ✓
- `ReminderService.mark_48h_sent(db, appt)` — used same way in both `reminders.py` and `test_reminders.py` ✓
