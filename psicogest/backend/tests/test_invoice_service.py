"""Tests for InvoiceService and invoice PDF generation."""
import uuid
from datetime import date, datetime, timezone, timedelta
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.models.invoice import Invoice
from app.models.patient import Patient
from app.models.session import Session as SessionModel
from app.models.tenant import Tenant
from app.services.invoice_service import InvoiceService, InvoiceNotFoundError
from app.services.invoice_pdf_service import build_invoice_pdf


TENANT_ID = str(uuid.uuid4())
PATIENT_ID = str(uuid.uuid4())
SESSION_ID = str(uuid.uuid4())


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Invoice.__table__.create(eng, checkfirst=True)
    Tenant.__table__.create(eng, checkfirst=True)
    Patient.__table__.create(eng, checkfirst=True)
    SessionModel.__table__.create(eng, checkfirst=True)
    return eng


@pytest.fixture
def db(engine):
    with engine.connect() as conn:
        conn.execute(text("PRAGMA journal_mode=WAL"))
        with Session(conn) as session:
            yield session
            session.rollback()


def _make_tenant(db: Session) -> Tenant:
    tenant = Tenant(
        id=uuid.UUID(TENANT_ID),
        auth_user_id=uuid.uuid4(),
        full_name="Dra. García",
        colpsic_number="123456",
        reps_code="RPS001",
        nit="901234567",
        plan="starter",
        plan_expires_at=datetime.now(tz=timezone.utc) + timedelta(days=30),
        city="Bogotá",
    )
    db.add(tenant)
    db.flush()
    return tenant


def _make_patient(db: Session) -> Patient:
    patient = Patient(
        id=uuid.UUID(PATIENT_ID),
        tenant_id=uuid.UUID(TENANT_ID),
        hc_number="HC-2026-0001",
        doc_type="CC",
        doc_number="12345678",
        first_surname="López",
        second_surname=None,
        first_name="Ana",
        second_name=None,
        birth_date=date(1990, 1, 1),
        biological_sex="F",
        marital_status="S",
        occupation="Profesora",
        address="Calle 1 # 2-3",
        municipality_dane="11001",
        zone="U",
        phone="3001234567",
        payer_type="PA",
        consent_signed_at=datetime.now(tz=timezone.utc),
        consent_ip="127.0.0.1",
    )
    db.add(patient)
    db.flush()
    return patient


def _make_session(db: Session) -> SessionModel:
    sess = SessionModel(
        id=uuid.UUID(SESSION_ID),
        tenant_id=uuid.UUID(TENANT_ID),
        patient_id=uuid.UUID(PATIENT_ID),
        appointment_id=uuid.uuid4(),
        actual_start=datetime.now(tz=timezone.utc) - timedelta(days=1),
        actual_end=datetime.now(tz=timezone.utc) - timedelta(days=1) + timedelta(minutes=50),
        diagnosis_cie11="6A70",
        diagnosis_description="Trastorno depresivo leve",
        cups_code="890403",
        consultation_reason="Paciente refiere tristeza persistente",
        intervention="TCC, activación conductual",
        session_fee=150000,
        status="signed",
        session_hash="abc123",
        signed_at=datetime.now(tz=timezone.utc),
        rips_included=False,
    )
    db.add(sess)
    db.flush()
    return sess


@pytest.fixture
def svc(db):
    return InvoiceService(db, TENANT_ID)


# ---- Invoice creation ----

def test_create_draft_creates_invoice(svc, db):
    _make_tenant(db)
    _make_patient(db)
    _make_session(db)

    invoice = svc.create_draft(PATIENT_ID, [SESSION_ID])
    assert invoice.id is not None
    assert invoice.status == "draft"
    assert invoice.total_cop == 150000
    assert invoice.invoice_number.startswith("INV-")


def test_create_draft_calculates_total_from_multiple_sessions(svc, db):
    _make_tenant(db)
    _make_patient(db)
    _make_session(db)
    session_id2 = str(uuid.uuid4())
    sess2 = SessionModel(
        id=uuid.UUID(session_id2),
        tenant_id=uuid.UUID(TENANT_ID),
        patient_id=uuid.UUID(PATIENT_ID),
        appointment_id=uuid.uuid4(),
        actual_start=datetime.now(tz=timezone.utc) - timedelta(days=2),
        actual_end=datetime.now(tz=timezone.utc) - timedelta(days=2) + timedelta(minutes=50),
        diagnosis_cie11="6A70",
        diagnosis_description="Seguimiento",
        cups_code="890403",
        consultation_reason="Control",
        intervention="TCC",
        session_fee=120000,
        status="signed",
        session_hash="def456",
        signed_at=datetime.now(tz=timezone.utc),
        rips_included=False,
    )
    db.add(sess2)
    db.flush()

    invoice = svc.create_draft(PATIENT_ID, [SESSION_ID, session_id2])
    assert invoice.total_cop == 270000


def test_create_draft_rejects_unsigned_sessions(svc, db):
    _make_tenant(db)
    _make_patient(db)
    sess = _make_session(db)
    sess.status = "draft"
    db.flush()

    with pytest.raises(InvoiceNotFoundError, match="No se encontraron sesiones firmadas"):
        svc.create_draft(PATIENT_ID, [SESSION_ID])


def test_create_draft_rejects_wrong_tenant_patient(svc, db):
    _make_tenant(db)
    _make_patient(db)
    _make_session(db)

    other_patient_id = str(uuid.uuid4())
    other_patient = Patient(
        id=uuid.UUID(other_patient_id),
        tenant_id=uuid.uuid4(),  # different tenant
        hc_number="HC-OTHER",
        doc_type="CC",
        doc_number="99999999",
        first_surname="Pérez",
        first_name="Juan",
            birth_date=date(1985, 5, 15),
        biological_sex="M",
        marital_status="S",
        occupation="Ingeniero",
        address="Calle X",
        municipality_dane="11001",
        zone="U",
        phone="3009999999",
        payer_type="PA",
        consent_signed_at=datetime.now(tz=timezone.utc),
        consent_ip="127.0.0.1",
    )
    db.add(other_patient)
    db.flush()

    with pytest.raises(InvoiceNotFoundError, match="no encontrado"):
        svc.create_draft(other_patient_id, [])


# ---- Status transitions ----

def test_issue_changes_status_to_issued(svc, db):
    _make_tenant(db)
    _make_patient(db)
    _make_session(db)
    invoice = svc.create_draft(PATIENT_ID, [SESSION_ID])

    issued = svc.issue(str(invoice.id))
    assert issued.status == "issued"
    assert issued.issue_date is not None


def test_mark_paid_changes_status_to_paid(svc, db):
    _make_tenant(db)
    _make_patient(db)
    _make_session(db)
    invoice = svc.create_draft(PATIENT_ID, [SESSION_ID])
    svc.issue(str(invoice.id))

    paid = svc.mark_paid(str(invoice.id))
    assert paid.status == "paid"
    assert paid.paid_at is not None


# ---- PDF generation ----

def test_build_invoice_pdf_returns_bytes(svc, db):
    _make_tenant(db)
    _make_patient(db)
    _make_session(db)
    invoice = svc.create_draft(PATIENT_ID, [SESSION_ID])
    svc.issue(str(invoice.id))

    data = svc.get_pdf_data(str(invoice.id))
    pdf_bytes = build_invoice_pdf(data)

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes[:4] == b"%PDF"


def test_get_pdf_data_includes_all_required_fields(svc, db):
    _make_tenant(db)
    _make_patient(db)
    _make_session(db)
    invoice = svc.create_draft(PATIENT_ID, [SESSION_ID])
    svc.issue(str(invoice.id))

    data = svc.get_pdf_data(str(invoice.id))

    assert "invoice_number" in data
    assert "psychologist" in data
    assert "patient" in data
    assert "sessions" in data
    assert data["psychologist"]["name"] == "Dra. García"
    assert data["patient"]["name"] == "López Ana"
    assert len(data["sessions"]) == 1
    assert data["sessions"][0]["fee"] == 150000
