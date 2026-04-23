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