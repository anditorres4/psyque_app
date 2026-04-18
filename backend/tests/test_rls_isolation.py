"""
Sprint 1 success criterion: RLS multitenant isolation.

A tenant authenticated as tenant A must NOT be able to read
records belonging to tenant B. The expected behavior is that
the query returns ZERO rows — the record appears to not exist
(not a 403, but a 404-like invisible response).

This is the "perfect isolation" pattern required by:
- Res. 1995/1999: confidencialidad de historia clínica
- PRD Sección 4.2: arquitectura multitenant con RLS
"""
import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session


def test_tenant_a_cannot_read_tenant_b_patient(two_tenants: dict, db: Session) -> None:
    """Autenticado como tenant A, el paciente de tenant B es invisible."""
    tenant_a_id = two_tenants["tenant_a"]["id"]
    patient_b_id = two_tenants["patient_b_id"]

    # Switch to non-superuser role so RLS policies are enforced.
    # postgres is a superuser and bypasses RLS even with FORCE ROW LEVEL SECURITY.
    db.execute(text("SET LOCAL ROLE authenticated"))
    db.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": tenant_a_id})

    result = db.execute(
        text("SELECT id FROM patients WHERE id = :pid"),
        {"pid": patient_b_id},
    ).fetchall()

    assert len(result) == 0, (
        f"RLS VIOLATION: Tenant A ({tenant_a_id}) puede leer el paciente "
        f"{patient_b_id} de Tenant B. Fallo de seguridad crítico."
    )


def test_tenant_a_can_read_own_patient(two_tenants: dict, db: Session) -> None:
    """Autenticado como tenant A, puede leer su propio paciente normalmente."""
    tenant_a_id = two_tenants["tenant_a"]["id"]
    patient_a_id = two_tenants["patient_a_id"]

    db.execute(text("SET LOCAL ROLE authenticated"))
    db.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": tenant_a_id})

    result = db.execute(
        text("SELECT id FROM patients WHERE id = :pid"),
        {"pid": patient_a_id},
    ).fetchall()

    assert len(result) == 1, (
        f"Tenant A ({tenant_a_id}) debería ver su propio paciente "
        f"{patient_a_id} pero la query retornó vacío."
    )


def test_tenant_b_cannot_read_tenant_a_patient(two_tenants: dict, db: Session) -> None:
    """Autenticado como tenant B, el paciente de tenant A es invisible."""
    tenant_b_id = two_tenants["tenant_b"]["id"]
    patient_a_id = two_tenants["patient_a_id"]

    db.execute(text("SET LOCAL ROLE authenticated"))
    db.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": tenant_b_id})

    result = db.execute(
        text("SELECT id FROM patients WHERE id = :pid"),
        {"pid": patient_a_id},
    ).fetchall()

    assert len(result) == 0, (
        f"RLS VIOLATION: Tenant B ({tenant_b_id}) puede leer el paciente "
        f"{patient_a_id} de Tenant A."
    )


def test_no_tenant_context_returns_empty(two_tenants: dict, db: Session) -> None:
    """Sin contexto de tenant, la tabla patients devuelve cero registros."""
    db.execute(text("SET LOCAL ROLE authenticated"))
    # RESET elimina la variable de sesión — simula request sin autenticación
    db.execute(text("RESET app.tenant_id"))

    result = db.execute(text("SELECT COUNT(*) AS cnt FROM patients")).mappings().one()

    assert result["cnt"] == 0, (
        f"Sin tenant context, patients debe retornar 0 filas. "
        f"Retornó {result['cnt']} — RLS no está configurado correctamente."
    )


def test_rls_prevents_cross_tenant_write(two_tenants: dict, db: Session) -> None:
    """Autenticado como tenant A, no puede insertar pacientes para tenant B."""
    tenant_a_id = two_tenants["tenant_a"]["id"]
    tenant_b_id = two_tenants["tenant_b"]["id"]

    db.execute(text("SET LOCAL ROLE authenticated"))
    db.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": tenant_a_id})

    with pytest.raises(DBAPIError):
        db.execute(
            text("""
                INSERT INTO patients (
                    tenant_id, hc_number, doc_type, doc_number,
                    first_surname, first_name, birth_date, biological_sex,
                    marital_status, occupation, address, municipality_dane,
                    zone, phone, payer_type, consent_signed_at, consent_ip
                ) VALUES (
                    :tenant_id, 'HC-2026-HACK', 'CC', '99999999',
                    'Malicioso', 'Actor', '2000-01-01', 'M',
                    'S', 'N/A', 'Dirección falsa', '11001',
                    'U', '3000000000', 'PA', NOW(), '1.2.3.4'
                )
            """),
            {"tenant_id": tenant_b_id},
        )
        db.flush()


def test_tenant_list_only_shows_own_patients(two_tenants: dict, db: Session) -> None:
    """SELECT * FROM patients solo retorna los pacientes del tenant activo."""
    tenant_a_id = two_tenants["tenant_a"]["id"]

    db.execute(text("SET LOCAL ROLE authenticated"))
    db.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": tenant_a_id})

    rows = db.execute(text("SELECT tenant_id FROM patients")).mappings().fetchall()

    assert len(rows) >= 1, "Tenant A debe ver al menos su propio paciente."
    for row in rows:
        assert str(row["tenant_id"]) == tenant_a_id, (
            f"Tenant A recibió un paciente con tenant_id={row['tenant_id']} "
            f"(esperado: {tenant_a_id}). RLS no está filtrando correctamente."
        )
