"""Tests for RipsService — generation and ZIP download."""
import uuid
from datetime import datetime, timezone, timedelta
from zipfile import ZipFile

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.models.patient import Patient
from app.models.rips_export import RipsExport
from app.models.session import Session as SessionModel
from app.models.tenant import Tenant
from app.services.rips_service import RipsService, RipsGenerationError


TENANT_ID = str(uuid.uuid4())
PATIENT_ID = str(uuid.uuid4())


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    RipsExport.__table__.create(eng, checkfirst=True)
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


def _make_patient(db: Session, patient_id: str = PATIENT_ID) -> Patient:
    patient = Patient(
        id=uuid.UUID(patient_id),
        tenant_id=uuid.UUID(TENANT_ID),
        hc_number="HC-2026-0001",
        doc_type="CC",
        doc_number="12345678",
        first_surname="López",
        second_surname=None,
        first_name="Ana",
        second_name=None,
        birth_date="1990-01-01",
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


def _make_session(
    db: Session,
    patient_id: str = PATIENT_ID,
    year: int | None = None,
    month: int | None = None,
) -> SessionModel:
    if year is None:
        year = datetime.now(tz=timezone.utc).year
    if month is None:
        month = datetime.now(tz=timezone.utc).month
    sess_date = datetime(year, month, 15, 10, 0, 0, tzinfo=timezone.utc)
    sess = SessionModel(
        id=uuid.uuid4(),
        tenant_id=uuid.UUID(TENANT_ID),
        patient_id=uuid.UUID(patient_id),
        appointment_id=uuid.uuid4(),
        actual_start=sess_date,
        actual_end=sess_date + timedelta(minutes=50),
        diagnosis_cie11="6A70",
        diagnosis_description="Trastorno depresivo leve",
        cups_code="890403",
        consultation_reason="Paciente refiere tristeza persistente",
        intervention="TCC",
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
    return RipsService(db, TENANT_ID)


# ---- Generation ----

def test_generate_creates_export_with_rips_json(svc, db):
    _make_tenant(db)
    _make_patient(db)
    sess = _make_session(db)

    export = svc.generate(2026, 4)
    assert export.id is not None
    assert export.status == "generated"
    assert export.sessions_count == 1
    assert export.total_value_cop == 150000
    assert "rips_202604" in export.json_file_path


def test_generate_marks_sessions_as_rips_included(svc, db):
    _make_tenant(db)
    _make_patient(db)
    sess = _make_session(db)
    assert sess.rips_included is False

    svc.generate(2026, 4)
    db.refresh(sess)
    assert sess.rips_included is True


def test_generate_raises_if_no_signed_sessions(svc, db):
    _make_tenant(db)
    _make_patient(db)
    sess = _make_session(db)
    sess.status = "draft"
    db.flush()

    with pytest.raises(RipsGenerationError, match="No hay sesiones firmadas"):
        svc.generate(2026, 4)


def test_generate_raises_if_duplicate_for_period(svc, db):
    _make_tenant(db)
    _make_patient(db)
    _make_session(db)

    svc.generate(2026, 4)
    with pytest.raises(RipsGenerationError, match="Ya existe"):
        svc.generate(2026, 4)


# ---- Download ZIP ----

def test_download_zip_returns_valid_zip(svc, db):
    _make_tenant(db)
    _make_patient(db)
    _make_session(db)
    export = svc.generate(2026, 4)

    zip_bytes = svc.download_zip(str(export.id))
    assert isinstance(zip_bytes, bytes)
    assert zip_bytes[:2] == b"PK"  # ZIP magic bytes


def test_download_zip_contains_required_rips_files(svc, db):
    _make_tenant(db)
    _make_patient(db)
    _make_session(db)
    export = svc.generate(2026, 4)

    zip_bytes = svc.download_zip(str(export.id))
    buffer = __import__("io").BytesIO(zip_bytes)
    with ZipFile(buffer) as zf:
        names = zf.namelist()
        assert any("_AC.json" in n for n in names), "Missing AC (usuarios) file"
        assert any("_AD.json" in n for n in names), "Missing AD (consultas) file"
        assert any("_AP.json" in n for n in names), "Missing AP (procedimientos) file"


def test_download_zip_contains_session_data(svc, db):
    _make_tenant(db)
    _make_patient(db)
    _make_session(db)
    export = svc.generate(2026, 4)

    zip_bytes = svc.download_zip(str(export.id))
    buffer = __import__("io").BytesIO(zip_bytes)
    with ZipFile(buffer) as zf:
        ad_file = [n for n in zf.namelist() if "_AD.json" in n][0]
        ad_content = zf.read(ad_file).decode()
        assert "890403" in ad_content  # CUPS code
        assert "6A70" in ad_content    # CIE-11 code
        assert "12345678" in ad_content  # patient doc number


def test_download_zip_raises_if_not_generated(svc, db):
    _make_tenant(db)
    _make_patient(db)
    _make_session(db)
    export = svc.generate(2026, 4)

    export.status = "pending"
    db.flush()

    with pytest.raises(RipsGenerationError, match="aún no está generada"):
        svc.download_zip(str(export.id))