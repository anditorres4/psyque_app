"""Tests for AppointmentService — conflict detection and CRUD."""
import uuid
from datetime import datetime, timezone, timedelta

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.models.base import Base
from app.models.appointment import Appointment
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
    # Only create the appointments table — Patient model uses PostgreSQL-specific
    # INET type which SQLite does not support. Tests only need Appointment.
    Appointment.__table__.create(eng, checkfirst=True)
    return eng


@pytest.fixture
def db(engine):
    """Fresh session per test, rolled back after."""
    with engine.connect() as conn:
        conn.execute(text("PRAGMA journal_mode=WAL"))
        with Session(conn) as session:
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
    # SQLite strips timezone info when storing datetimes; compare naive UTC values.
    ts_naive = tomorrow_start.replace(tzinfo=None)
    assert any(
        (a.scheduled_start.replace(tzinfo=None) if a.scheduled_start.tzinfo else a.scheduled_start) == ts_naive
        for a in results
    )


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
