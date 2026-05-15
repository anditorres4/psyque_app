"""Patient portal API — read-only endpoints for authenticated patients."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.deps import CurrentPatientDB, PatientDB, get_patient_db
from app.models.appointment import Appointment
from app.models.invoice import Invoice
from app.models.patient import Patient
from app.models.session import Session
from app.models.tenant import Tenant

router = APIRouter(prefix="/portal", tags=["patient-portal"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class PortalMe(BaseModel):
    patient_id: str
    full_name: str
    email: str | None
    phone: str
    psychologist_name: str
    psychologist_city: str
    onboarding_status: str  # "active" | "pending" — null DB value treated as "active"

class PortalAppointment(BaseModel):
    id: str
    scheduled_start: datetime
    scheduled_end: datetime
    session_type: str
    modality: str
    status: str
    notes: str | None

class PortalSession(BaseModel):
    id: str
    actual_start: datetime
    diagnosis_cie11: str
    cups_code: str

class PortalInvoice(BaseModel):
    id: str
    invoice_number: str
    status: str
    total_cop: int
    issue_date: datetime | None
    created_at: datetime


# ── Helper ───────────────────────────────────────────────────────────────────

def _get_patient(ctx: PatientDB) -> Patient:
    p = ctx.db.get(Patient, uuid.UUID(ctx.patient.patient_id))
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado.")
    return p


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/me", response_model=PortalMe)
def portal_me(ctx: Annotated[PatientDB, Depends(get_patient_db)]) -> PortalMe:
    """Return the authenticated patient's own profile."""
    patient = _get_patient(ctx)
    tenant = ctx.db.get(Tenant, patient.tenant_id)
    return PortalMe(
        patient_id=str(patient.id),
        full_name=patient.full_name,
        email=patient.email,
        phone=patient.phone,
        psychologist_name=tenant.full_name if tenant else "",
        psychologist_city=tenant.city if tenant else "",
        onboarding_status=patient.onboarding_status or "active",
    )


@router.get("/appointments", response_model=list[PortalAppointment])
def portal_appointments(ctx: Annotated[PatientDB, Depends(get_patient_db)]) -> list[PortalAppointment]:
    """Return upcoming and recent appointments for the patient."""
    patient = _get_patient(ctx)
    appts = (
        ctx.db.query(Appointment)
        .filter(
            Appointment.patient_id == patient.id,
            Appointment.tenant_id == patient.tenant_id,
        )
        .order_by(Appointment.scheduled_start.desc())
        .limit(50)
        .all()
    )
    return [
        PortalAppointment(
            id=str(a.id),
            scheduled_start=a.scheduled_start,
            scheduled_end=a.scheduled_end,
            session_type=a.session_type,
            modality=a.modality,
            status=a.status,
            notes=a.notes,
        )
        for a in appts
    ]


@router.get("/sessions", response_model=list[PortalSession])
def portal_sessions(ctx: Annotated[PatientDB, Depends(get_patient_db)]) -> list[PortalSession]:
    """Return signed session records (no clinical notes for privacy)."""
    patient = _get_patient(ctx)
    sessions = (
        ctx.db.query(Session)
        .filter(
            Session.patient_id == patient.id,
            Session.tenant_id == patient.tenant_id,
            Session.status == "signed",
        )
        .order_by(Session.actual_start.desc())
        .limit(50)
        .all()
    )
    return [
        PortalSession(
            id=str(s.id),
            actual_start=s.actual_start,
            diagnosis_cie11=s.diagnosis_cie11,
            cups_code=s.cups_code,
        )
        for s in sessions
    ]


@router.get("/invoices", response_model=list[PortalInvoice])
def portal_invoices(ctx: Annotated[PatientDB, Depends(get_patient_db)]) -> list[PortalInvoice]:
    """Return issued invoices for the patient."""
    patient = _get_patient(ctx)
    invoices = (
        ctx.db.query(Invoice)
        .filter(
            Invoice.patient_id == patient.id,
            Invoice.tenant_id == patient.tenant_id,
            Invoice.status.in_(["issued", "paid"]),
        )
        .order_by(Invoice.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        PortalInvoice(
            id=str(inv.id),
            invoice_number=inv.invoice_number,
            status=inv.status,
            total_cop=inv.total_cop,
            issue_date=inv.issue_date,
            created_at=inv.created_at,
        )
        for inv in invoices
    ]
