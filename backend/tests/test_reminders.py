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