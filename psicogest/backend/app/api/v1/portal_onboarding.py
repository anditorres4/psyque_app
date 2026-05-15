"""Portal onboarding — document signing gate for patients."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.core.deps import CurrentPatientDB, PatientDB, get_patient_db
from app.models.patient import Patient
from app.models.patient_document import PatientDocument

router = APIRouter(prefix="/portal", tags=["portal-onboarding"])

CURRENT_CONTENT_VERSION = "1.0"


def _age(birth_date: date) -> int:
    today = date.today()
    return today.year - birth_date.year - (
        (today.month, today.day) < (birth_date.month, birth_date.day)
    )


def _required_docs(birth_date: date) -> list[str]:
    age = _age(birth_date)
    docs = ["service_conditions", "consent_therapeutic"]
    if age < 13:
        docs += ["assent_minor_u13", "consent_guardian"]
    elif age < 18:
        docs += ["assent_minor_13_18", "consent_guardian"]
    docs.append("intake_questionnaire")
    return docs


def _age_group(birth_date: date) -> str:
    age = _age(birth_date)
    if age < 13:
        return "minor_u13"
    if age < 18:
        return "minor_13_18"
    return "adult"


def _get_patient(ctx: PatientDB) -> Patient:
    p = ctx.db.get(Patient, uuid.UUID(ctx.patient.patient_id))
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado.")
    return p


# ── Schemas ───────────────────────────────────────────────────────────────────

class SignedDoc(BaseModel):
    doc_type: str
    signed_at: datetime
    content_version: str


class OnboardingStatus(BaseModel):
    status: str  # "pending" | "active"
    age_group: str
    required_docs: list[str]
    signed_docs: list[SignedDoc]
    pending_docs: list[str]


class SignDocRequest(BaseModel):
    doc_type: str


class SignDocResponse(BaseModel):
    ok: bool
    onboarding_complete: bool


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/onboarding/status", response_model=OnboardingStatus)
def onboarding_status(
    ctx: Annotated[PatientDB, Depends(get_patient_db)],
) -> OnboardingStatus:
    """Return the patient's current onboarding state."""
    patient = _get_patient(ctx)

    # Legacy patients with no onboarding_status are considered active
    if patient.onboarding_status is None or patient.onboarding_status == "active":
        return OnboardingStatus(
            status="active",
            age_group=_age_group(patient.birth_date),
            required_docs=_required_docs(patient.birth_date),
            signed_docs=[],
            pending_docs=[],
        )

    required = _required_docs(patient.birth_date)

    signed_rows = (
        ctx.db.query(PatientDocument)
        .filter(PatientDocument.patient_id == patient.id)
        .order_by(PatientDocument.signed_at.asc())
        .all()
    )
    signed_types = {row.doc_type for row in signed_rows}
    pending = [d for d in required if d not in signed_types]

    return OnboardingStatus(
        status="active" if not pending else "pending",
        age_group=_age_group(patient.birth_date),
        required_docs=required,
        signed_docs=[
            SignedDoc(
                doc_type=row.doc_type,
                signed_at=row.signed_at,
                content_version=row.content_version,
            )
            for row in signed_rows
            if row.doc_type in required
        ],
        pending_docs=pending,
    )


@router.post("/onboarding/sign", response_model=SignDocResponse)
def sign_document(
    body: SignDocRequest,
    request: Request,
    ctx: Annotated[PatientDB, Depends(get_patient_db)],
) -> SignDocResponse:
    """Sign an onboarding document. Marks patient as active when all docs are done."""
    patient = _get_patient(ctx)

    if patient.onboarding_status == "active":
        return SignDocResponse(ok=True, onboarding_complete=True)

    required = _required_docs(patient.birth_date)
    if body.doc_type not in required:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"'{body.doc_type}' no es un documento requerido para este paciente.",
        )

    # Idempotent — skip if already signed
    existing = (
        ctx.db.query(PatientDocument)
        .filter(
            PatientDocument.patient_id == patient.id,
            PatientDocument.doc_type == body.doc_type,
        )
        .first()
    )
    if not existing:
        ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown")
        ip = ip.split(",")[0].strip()

        doc = PatientDocument(
            patient_id=patient.id,
            psychologist_id=patient.tenant_id,
            doc_type=body.doc_type,
            signed_at=datetime.now(timezone.utc),
            ip=ip,
            content_version=CURRENT_CONTENT_VERSION,
        )
        ctx.db.add(doc)
        ctx.db.flush()

    # Check if all docs are now signed
    signed_types = {
        row.doc_type
        for row in ctx.db.query(PatientDocument.doc_type)
        .filter(PatientDocument.patient_id == patient.id)
        .all()
    }
    pending = [d for d in required if d not in signed_types]
    complete = len(pending) == 0

    if complete:
        patient.onboarding_status = "active"

    ctx.db.commit()
    return SignDocResponse(ok=True, onboarding_complete=complete)
