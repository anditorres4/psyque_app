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


def test_list_by_patient_filters_by_status(svc):
    fresh_patient = str(uuid.uuid4())
    data = _session_data()
    data["patient_id"] = fresh_patient
    draft_sess = svc.create(data)

    data2 = _session_data()
    data2["patient_id"] = fresh_patient
    signed_sess = svc.create(data2)
    svc.sign(str(signed_sess.id))

    signed_results = svc.list_by_patient(fresh_patient, status="signed")
    assert all(r.status == "signed" for r in signed_results)
    assert str(signed_sess.id) in [str(r.id) for r in signed_results]
    assert str(draft_sess.id) not in [str(r.id) for r in signed_results]


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
