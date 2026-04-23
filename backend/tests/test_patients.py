"""Tests for patient service — business logic including HC number generation."""
import uuid
from datetime import date

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.patient_service import (
    PatientService,
    DuplicateDocumentError,
    PatientNotFoundError,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _tenant(db: Session) -> str:
    """Create a tenant and return its UUID string."""
    auth_id = str(uuid.uuid4())
    result = db.execute(
        text("""
            INSERT INTO tenants (auth_user_id, full_name, colpsic_number, plan,
                                 plan_expires_at, city)
            VALUES (:auth_id, 'Test Psicólogo', 'TEST-001', 'starter',
                    NOW() + INTERVAL '30 days', 'Bogotá')
            RETURNING id
        """),
        {"auth_id": auth_id},
    )
    tenant_id = str(result.mappings().one()["id"])
    db.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": tenant_id})
    return tenant_id


PATIENT_DATA = {
    "doc_type": "CC",
    "doc_number": "12345678",
    "first_surname": "García",
    "second_surname": "López",
    "first_name": "Ana",
    "second_name": None,
    "birth_date": date(1990, 6, 15),
    "biological_sex": "F",
    "gender_identity": None,
    "marital_status": "S",
    "occupation": "Profesora",
    "address": "Calle 1 # 2-3, Bogotá",
    "municipality_dane": "11001",
    "zone": "U",
    "phone": "3001234567",
    "email": "ana.garcia@test.com",
    "emergency_contact_name": None,
    "emergency_contact_phone": None,
    "payer_type": "PA",
    "eps_name": None,
    "eps_code": None,
    "authorization_number": None,
    "consent_accepted": True,
}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
def test_create_patient_generates_hc_number(db: Session) -> None:
    """First patient for a tenant gets HC-YYYY-0001."""
    from datetime import date as date_type
    tenant_id = _tenant(db)
    service = PatientService(db, tenant_id)

    patient = service.create(PATIENT_DATA, client_ip="127.0.0.1")

    year = date_type.today().year
    assert patient.hc_number == f"HC-{year}-0001"


def test_second_patient_gets_sequential_hc(db: Session) -> None:
    """Second patient for the same tenant gets HC-YYYY-0002."""
    from datetime import date as date_type
    tenant_id = _tenant(db)
    service = PatientService(db, tenant_id)

    service.create(PATIENT_DATA, client_ip="127.0.0.1")
    second_data = {**PATIENT_DATA, "doc_number": "99999999"}
    patient2 = service.create(second_data, client_ip="127.0.0.1")

    year = date_type.today().year
    assert patient2.hc_number == f"HC-{year}-0002"


def test_duplicate_doc_number_raises_error(db: Session) -> None:
    """Creating two patients with the same doc_number raises DuplicateDocumentError."""
    tenant_id = _tenant(db)
    service = PatientService(db, tenant_id)

    service.create(PATIENT_DATA, client_ip="127.0.0.1")

    with pytest.raises(DuplicateDocumentError):
        service.create(PATIENT_DATA, client_ip="127.0.0.1")


def test_consent_ip_stored_immutably(db: Session) -> None:
    """consent_ip and consent_signed_at are stored from creation, never null."""
    tenant_id = _tenant(db)
    service = PatientService(db, tenant_id)

    patient = service.create(PATIENT_DATA, client_ip="192.168.1.1")

    assert str(patient.consent_ip) == "192.168.1.1"
    assert patient.consent_signed_at is not None


def test_get_existing_patient(db: Session) -> None:
    """get_by_id returns the patient when it exists for the tenant."""
    tenant_id = _tenant(db)
    service = PatientService(db, tenant_id)

    created = service.create(PATIENT_DATA, client_ip="127.0.0.1")
    fetched = service.get_by_id(str(created.id))

    assert fetched.id == created.id
    assert fetched.first_name == "Ana"


def test_get_nonexistent_patient_raises_not_found(db: Session) -> None:
    """get_by_id raises PatientNotFoundError for an unknown UUID."""
    tenant_id = _tenant(db)
    service = PatientService(db, tenant_id)

    with pytest.raises(PatientNotFoundError):
        service.get_by_id(str(uuid.uuid4()))


def test_search_by_surname(db: Session) -> None:
    """search() returns patients whose first_surname starts with the query."""
    tenant_id = _tenant(db)
    service = PatientService(db, tenant_id)

    service.create(PATIENT_DATA, client_ip="127.0.0.1")
    other = {**PATIENT_DATA, "doc_number": "00000001", "first_surname": "Martínez", "first_name": "Carlos"}
    service.create(other, client_ip="127.0.0.1")

    results = service.search("gar")
    assert len(results) == 1
    assert results[0].first_surname == "García"


def test_list_paginated(db: Session) -> None:
    """list() returns paginated results with correct total count."""
    tenant_id = _tenant(db)
    service = PatientService(db, tenant_id)

    for i in range(5):
        service.create({**PATIENT_DATA, "doc_number": f"1000000{i}"}, client_ip="127.0.0.1")

    page1 = service.list(page=1, page_size=3)
    assert len(page1.items) == 3
    assert page1.total == 5
    assert page1.pages == 2


def test_update_patient(db: Session) -> None:
    """update() modifies only provided fields."""
    tenant_id = _tenant(db)
    service = PatientService(db, tenant_id)

    patient = service.create(PATIENT_DATA, client_ip="127.0.0.1")
    updated = service.update(str(patient.id), {"phone": "3009999999"})

    assert updated.phone == "3009999999"
    assert updated.first_name == "Ana"  # unchanged
