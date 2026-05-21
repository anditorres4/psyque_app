"""Patient self-registration portal — public endpoints (no tenant auth).

Flow:
1. Psychologist sends a registration link with their slug to the patient.
2. Patient fills intake survey → POST /public/patient-registration/{slug}
3. Backend creates PatientRegistration record + sends welcome email.
4. Psychologist reviews intake data → POST /patient-registrations/{id}/approve
   (creates the Patient record and links it).
"""
from __future__ import annotations

import hashlib
import os
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_tenant_db, TenantDB
from app.models.patient_registration import PatientRegistration
from app.models.tenant import Tenant
from app.services.email_service import EmailService

router = APIRouter(tags=["patient-portal"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class IntakeData(BaseModel):
    """Sociodemographic and intake survey data filled by the patient."""
    # Personal
    first_name: str = Field(..., min_length=2, max_length=100)
    first_surname: str = Field(..., min_length=2, max_length=100)
    second_surname: str | None = Field(None, max_length=100)
    doc_type: str = Field(..., pattern="^(CC|TI|CE|PA|RC|MS)$")
    doc_number: str = Field(..., min_length=3, max_length=20)
    birth_date: str  # YYYY-MM-DD
    biological_sex: str = Field(..., pattern="^(M|F|I)$")
    gender_identity: str | None = None
    marital_status: str = Field(..., pattern="^(S|C|U|D|V|SE)$")
    occupation: str = Field(..., min_length=2, max_length=150)
    email: EmailStr | None = None
    phone: str = Field(..., min_length=7, max_length=20)
    address: str = Field(..., min_length=5)
    municipality_dane: str = Field(..., max_length=10)
    zone: str = Field(..., pattern="^(U|R)$")
    payer_type: str = Field(..., pattern="^(PA|CC|SS|PE|SE)$")
    eps_name: str | None = None

    # Antecedentes
    motivo_consulta: str = Field(..., min_length=10)
    antecedentes_medicos: str | None = None
    medicamentos_actuales: str | None = None
    antecedentes_psicologicos: str | None = None
    antecedentes_familiares: str | None = None
    condiciones_actuales: list[str] = []
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None

    # Consent
    consent_accepted: bool = Field(..., description="Patient explicitly accepted consent")


class PatientRegistrationOut(BaseModel):
    id: str
    status: str
    created_at: str
    first_name: str | None = None
    first_surname: str | None = None
    email: str | None


class RegistrationPublicOut(BaseModel):
    token: str
    status: str
    psychologist_name: str


# ── Public: patient fills intake form ────────────────────────────────────────

@router.get("/public/patient-registration/{slug}", response_model=RegistrationPublicOut)
def get_registration_info(slug: str, db: Annotated[Session, Depends(get_db)]) -> RegistrationPublicOut:
    """Return basic info about the psychologist for the registration form."""
    tenant = db.query(Tenant).filter(Tenant.booking_slug == slug, Tenant.booking_enabled == True).first()  # noqa: E712
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enlace de registro no válido.")
    return RegistrationPublicOut(
        token=slug,
        status="active",
        psychologist_name=tenant.full_name,
    )


@router.post("/public/patient-registration/{slug}", status_code=status.HTTP_201_CREATED)
def submit_registration(
    slug: str,
    body: IntakeData,
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """Patient submits intake data. Backend stores it for psychologist review."""
    tenant = db.query(Tenant).filter(Tenant.booking_slug == slug, Tenant.booking_enabled == True).first()  # noqa: E712
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enlace no válido.")
    if not body.consent_accepted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Debe aceptar el consentimiento informado.")

    token = hashlib.sha256(f"{tenant.id}{os.urandom(16).hex()}".encode()).hexdigest()[:48]
    email = str(body.email) if body.email else None

    reg = PatientRegistration(
        id=uuid.uuid4(),
        psychologist_id=tenant.id,
        email=email,
        registration_token=token,
        intake_data=body.model_dump(),
        consent_signed_at=datetime.now(tz=timezone.utc),
        status="pending",
    )
    db.add(reg)
    db.commit()

    if email:
        try:
            EmailService().send_welcome(
                to_email=email,
                patient_name=body.first_name,
                psychologist_name=tenant.full_name,
            )
        except Exception:
            pass

    return {"ok": True, "token": token}


# ── Authenticated: psychologist manages registrations ────────────────────────

@router.get("/patient-registrations", response_model=list[PatientRegistrationOut])
def list_registrations(ctx: Annotated[TenantDB, Depends(get_tenant_db)]) -> list[PatientRegistrationOut]:
    """List all pending patient self-registrations for review."""
    regs = (
        ctx.db.query(PatientRegistration)
        .filter(PatientRegistration.psychologist_id == uuid.UUID(ctx.tenant.tenant_id))
        .order_by(PatientRegistration.created_at.desc())
        .all()
    )
    return [
        PatientRegistrationOut(
            id=str(r.id),
            status=r.status,
            created_at=r.created_at.isoformat(),
            first_name=r.intake_data.get("first_name") if r.intake_data else None,
            first_surname=r.intake_data.get("first_surname") if r.intake_data else None,
            email=r.email,
        )
        for r in regs
    ]


@router.get("/patient-registrations/{reg_id}")
def get_registration(reg_id: str, ctx: Annotated[TenantDB, Depends(get_tenant_db)]) -> dict:
    """Get full intake data for a specific registration."""
    reg = ctx.db.get(PatientRegistration, uuid.UUID(reg_id))
    if not reg or reg.psychologist_id != uuid.UUID(ctx.tenant.tenant_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registro no encontrado.")
    return {
        "id": str(reg.id),
        "status": reg.status,
        "email": reg.email,
        "intake_data": reg.intake_data,
        "consent_signed_at": reg.consent_signed_at.isoformat() if reg.consent_signed_at else None,
        "created_at": reg.created_at.isoformat(),
    }


@router.post("/patient-registrations/{reg_id}/approve", status_code=status.HTTP_201_CREATED)
def approve_registration(reg_id: str, ctx: Annotated[TenantDB, Depends(get_tenant_db)]) -> dict:
    """Approve a patient registration — creates a Patient record from intake data."""
    import uuid as _uuid
    from app.models.patient import Patient
    from app.services.patient_service import PatientService
    from sqlalchemy.dialects.postgresql import INET
    import sqlalchemy as sa

    reg = ctx.db.get(PatientRegistration, _uuid.UUID(reg_id))
    if not reg or reg.psychologist_id != _uuid.UUID(ctx.tenant.tenant_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registro no encontrado.")
    if reg.status != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este registro ya fue procesado.")

    d = reg.intake_data or {}
    svc = PatientService(ctx.db, ctx.tenant.tenant_id)

    patient_data = {
        "doc_type": d.get("doc_type", "CC"),
        "doc_number": d.get("doc_number", ""),
        "first_surname": d.get("first_surname", ""),
        "second_surname": d.get("second_surname"),
        "first_name": d.get("first_name", ""),
        "second_name": None,
        "birth_date": d.get("birth_date"),
        "biological_sex": d.get("biological_sex", "I"),
        "gender_identity": d.get("gender_identity"),
        "marital_status": d.get("marital_status", "S"),
        "occupation": d.get("occupation", "No especificado"),
        "address": d.get("address", "No especificada"),
        "municipality_dane": d.get("municipality_dane", "11001"),
        "zone": d.get("zone", "U"),
        "phone": d.get("phone", ""),
        "email": reg.email or d.get("email"),
        "emergency_contact_name": d.get("emergency_contact_name"),
        "emergency_contact_phone": d.get("emergency_contact_phone"),
        "payer_type": d.get("payer_type", "PA"),
        "eps_name": d.get("eps_name"),
        "eps_code": None,
        "authorization_number": None,
        "consent_signed_at": reg.consent_signed_at or datetime.now(tz=timezone.utc),
        "consent_ip": reg.consent_ip or "0.0.0.0",
    }
    patient = svc.create(patient_data)
    ctx.db.flush()

    reg.patient_id = patient.id
    reg.status = "approved"
    reg.completed_at = datetime.now(tz=timezone.utc)
    ctx.db.commit()

    return {"ok": True, "patient_id": str(patient.id)}


@router.post("/patient-registrations/{reg_id}/reject")
def reject_registration(reg_id: str, ctx: Annotated[TenantDB, Depends(get_tenant_db)]) -> dict:
    reg = ctx.db.get(PatientRegistration, uuid.UUID(reg_id))
    if not reg or reg.psychologist_id != uuid.UUID(ctx.tenant.tenant_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registro no encontrado.")
    reg.status = "rejected"
    reg.completed_at = datetime.now(tz=timezone.utc)
    ctx.db.commit()
    return {"ok": True}
