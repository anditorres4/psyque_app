"""Pytest fixtures for psyque app backend tests."""
import uuid
from collections.abc import Generator

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


@pytest.fixture(scope="session")
def db_engine():
    """Engine connected to Supabase test database (session-scoped, reused across tests)."""
    engine = create_engine(
        settings.supabase_database_url,
        pool_pre_ping=True,
        echo=False,
    )
    yield engine
    engine.dispose()


@pytest.fixture()
def db(db_engine) -> Generator[Session, None, None]:
    """Database session with full rollback after each test.

    Uses a savepoint pattern so each test gets a clean slate without
    needing to truncate tables.
    """
    connection = db_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


def _create_tenant(db: Session, *, name: str) -> dict:
    """Insert a minimal tenant row bypassing RLS (no context set yet).

    Args:
        db: Active database session.
        name: Display name for the tenant (for test debugging).

    Returns:
        dict with 'id' (str UUID) and 'auth_user_id' (str UUID).
    """
    auth_user_id = str(uuid.uuid4())
    # Temporarily reset tenant context to allow unrestricted insert into tenants
    db.execute(text("RESET app.tenant_id"))
    result = db.execute(
        text("""
            INSERT INTO tenants (auth_user_id, full_name, colpsic_number, plan,
                                 plan_expires_at, city)
            VALUES (:auth_user_id, :full_name, 'TEST-001', 'starter',
                    NOW() + INTERVAL '30 days', 'Bogotá')
            RETURNING id, auth_user_id
        """),
        {"auth_user_id": auth_user_id, "full_name": name},
    )
    row = result.mappings().one()
    return {"id": str(row["id"]), "auth_user_id": str(row["auth_user_id"])}


def _insert_patient(db: Session, tenant_id: str, *, hc_number: str, doc_number: str) -> str:
    """Insert a patient row with the given tenant context active.

    Args:
        db: Active database session (must have tenant context already set).
        tenant_id: UUID string of the owning tenant.
        hc_number: Historia clínica number (unique per tenant).
        doc_number: Document number for the patient.

    Returns:
        Patient UUID string.
    """
    db.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": tenant_id})
    result = db.execute(
        text("""
            INSERT INTO patients (
                tenant_id, hc_number, doc_type, doc_number,
                first_surname, first_name, birth_date, biological_sex,
                marital_status, occupation, address, municipality_dane,
                zone, phone, payer_type, consent_signed_at, consent_ip
            ) VALUES (
                :tenant_id, :hc_number, 'CC', :doc_number,
                'García', 'Ana', '1990-01-01', 'F',
                'S', 'Profesora', 'Calle 1 # 2-3', '11001',
                'U', '3001234567', 'PA', NOW(), '127.0.0.1'
            ) RETURNING id
        """),
        {"tenant_id": tenant_id, "hc_number": hc_number, "doc_number": doc_number},
    )
    return str(result.mappings().one()["id"])


@pytest.fixture()
def two_tenants(db: Session) -> dict:
    """Fixture: two independent tenants, one patient each.

    Returns:
        dict with tenant_a, tenant_b (each has 'id'), patient_a_id, patient_b_id.
    """
    tenant_a = _create_tenant(db, name="Psicólogo Tenant A")
    tenant_b = _create_tenant(db, name="Psicólogo Tenant B")

    patient_a_id = _insert_patient(
        db, tenant_a["id"], hc_number="HC-2026-0001", doc_number="11111111"
    )
    patient_b_id = _insert_patient(
        db, tenant_b["id"], hc_number="HC-2026-0001", doc_number="22222222"
    )

    return {
        "tenant_a": tenant_a,
        "tenant_b": tenant_b,
        "patient_a_id": patient_a_id,
        "patient_b_id": patient_b_id,
    }
