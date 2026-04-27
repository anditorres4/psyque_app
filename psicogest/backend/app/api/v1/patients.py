"""Patients router — RF-PAC-01, RF-PAC-02, RF-PAC-03 from PRD §7.1."""
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.core.deps import get_tenant_db, TenantDB
from app.models.clinical_record import ClinicalRecord
from app.models.patient import Patient
from app.schemas.clinical_record import ClinicalRecordDetail, ClinicalRecordUpsert
from app.schemas.patient import (
    PaginatedPatients,
    PatientCreate,
    PatientDetail,
    PatientSummary,
    PatientUpdate,
)
from app.schemas.session import SessionSummary
from app.schemas.appointment import AppointmentSummary
from app.services.patient_service import (
    DuplicateDocumentError,
    PatientNotFoundError,
    PatientService,
)
from app.services.history_pdf_service import HistoryPDFService, PDFOptions
from app.services.session_service import SessionService
from app.services.appointment_service import AppointmentService

router = APIRouter(prefix="/patients", tags=["patients"])


def _service(ctx: TenantDB) -> PatientService:
    """Create PatientService from TenantDB context."""
    return PatientService(ctx.db, ctx.tenant.tenant_id)


@router.get("", response_model=PaginatedPatients)
def list_patients(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    active: bool | None = Query(None, description="Filter by active status"),
    has_eps: bool | None = Query(None, description="Filter patients with EPS"),
    search: str | None = Query(None, description="Search by name or document"),
) -> PaginatedPatients:
    """List patients with pagination and optional filters.

    Returns:
        Paginated list of PatientSummary. If search is provided, returns
        matching patients regardless of pagination params.
    """
    svc = _service(ctx)
    if search and search.strip():
        items = svc.search(search.strip(), limit=page_size)
        return PaginatedPatients(
            items=items,
            total=len(items),
            page=1,
            page_size=page_size,
            pages=1,
        )
    return svc.list(page=page, page_size=page_size, active_only=active, has_eps=has_eps)


@router.post("", response_model=PatientDetail, status_code=status.HTTP_201_CREATED)
def create_patient(
    body: PatientCreate,
    request: Request,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> PatientDetail:
    """Register a new patient.

    The client IP is extracted from the HTTP request and stored immutably
    for Ley 1581/2012 compliance (Habeas Data).

    Returns:
        PatientDetail of the created patient.

    Raises:
        422: If consent_accepted is False or required fields missing.
        409: If doc_type + doc_number already exists for this tenant.
    """
    client_ip = request.client.host if request.client else "unknown"
    try:
        patient = _service(ctx).create(body.model_dump(), client_ip=client_ip)
        ctx.db.commit()
        ctx.db.refresh(patient)
        return PatientDetail.model_validate(patient)
    except DuplicateDocumentError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.get("/{patient_id}", response_model=PatientDetail)
def get_patient(
    patient_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> PatientDetail:
    """Get full patient detail by UUID.

    Returns:
        PatientDetail.

    Raises:
        404: If patient not found (or belongs to another tenant — perfect isolation).
    """
    try:
        patient = _service(ctx).get_by_id(patient_id)
        return PatientDetail.model_validate(patient)
    except PatientNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado.")


@router.put("/{patient_id}", response_model=PatientDetail)
def update_patient(
    patient_id: str,
    body: PatientUpdate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> PatientDetail:
    """Partial update of a patient record.

    Immutable fields (doc_type, doc_number, birth_date, consent_*, hc_number)
    are silently ignored even if provided.

    Returns:
        Updated PatientDetail.

    Raises:
        404: If patient not found.
    """
    try:
        patient = _service(ctx).update(patient_id, body.model_dump(exclude_none=True))
        ctx.db.commit()
        ctx.db.refresh(patient)
        return PatientDetail.model_validate(patient)
    except PatientNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado.")


@router.get("/{patient_id}/sessions", response_model=list[SessionSummary])
def get_patient_sessions(
    patient_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> list[SessionSummary]:
    """List clinical sessions for a patient.

    Returns:
        List of SessionSummary ordered by date (newest first).
    """
    try:
        _service(ctx).get_by_id(patient_id)
    except PatientNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado.")
    return SessionService(ctx.db, ctx.tenant.tenant_id).list_paginated(
        page=page, page_size=page_size, patient_id=patient_id
    ).items


@router.get("/{patient_id}/appointments", response_model=list[AppointmentSummary])
def get_patient_appointments(
    patient_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> list[AppointmentSummary]:
    """List appointments for a patient.

    Returns:
        List of AppointmentSummary ordered by scheduled_start.
    """
    try:
        _service(ctx).get_by_id(patient_id)
    except PatientNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado.")
    return AppointmentService(ctx.db, ctx.tenant.tenant_id).list_by_patient(patient_id)


@router.get("/{patient_id}/history-export")
def export_patient_history(
    patient_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    include_diagnosis: bool = Query(True),
    include_treatment: bool = Query(True),
    include_evolution: bool = Query(True),
    patient_profile: Literal["adulto", "infante", "familiar"] = Query("adulto"),
) -> StreamingResponse:
    """Generate and download clinical history PDF (Res. 1995/1999 Art. 15)."""
    try:
        _service(ctx).get_by_id(patient_id)
    except PatientNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado.")

    opts = PDFOptions(
        include_diagnosis=include_diagnosis,
        include_treatment=include_treatment,
        include_evolution=include_evolution,
        patient_profile=patient_profile,
    )

    try:
        pdf_bytes = HistoryPDFService(ctx.db, ctx.tenant.tenant_id).generate(patient_id, opts)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    filename = f"HC_{patient_id}_{datetime.now(tz=timezone.utc).strftime('%Y%m%d_%H%M')}.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Type": "application/pdf",
        },
    )


@router.get("/{patient_id}/clinical-record", response_model=ClinicalRecordDetail)
def get_clinical_record(
    patient_id: uuid.UUID,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> ClinicalRecordDetail:
    """Return clinical record for patient, or an empty default if not yet created."""
    result = ctx.db.execute(
        select(ClinicalRecord).where(
            ClinicalRecord.patient_id == patient_id,
            ClinicalRecord.tenant_id == uuid.UUID(ctx.tenant.tenant_id),
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        return ClinicalRecordDetail(
            id=uuid.uuid4(),
            patient_id=patient_id,
            chief_complaint=None,
            antecedentes_personales=None,
            antecedentes_familiares=None,
            antecedentes_medicos=None,
            antecedentes_psicologicos=None,
            initial_diagnosis_cie11=None,
            initial_diagnosis_description=None,
            treatment_plan=None,
            therapeutic_goals=None,
            created_at=datetime.now(tz=timezone.utc),
            updated_at=datetime.now(tz=timezone.utc),
        )
    return record


@router.put("/{patient_id}/clinical-record", response_model=ClinicalRecordDetail)
def upsert_clinical_record(
    patient_id: uuid.UUID,
    body: ClinicalRecordUpsert,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> ClinicalRecordDetail:
    """Create or update clinical record for patient."""
    result = ctx.db.execute(
        select(ClinicalRecord).where(
            ClinicalRecord.patient_id == patient_id,
            ClinicalRecord.tenant_id == uuid.UUID(ctx.tenant.tenant_id),
        )
    )
    record = result.scalar_one_or_none()

    data = body.model_dump(exclude_unset=False)
    for key in ("antecedentes_personales", "antecedentes_familiares",
                "antecedentes_medicos", "antecedentes_psicologicos"):
        if data.get(key) is not None:
            data[key] = data[key].model_dump() if hasattr(data[key], "model_dump") else data[key]

    if record is None:
        record = ClinicalRecord(
            tenant_id=ctx.tenant.tenant_id,
            patient_id=patient_id,
            **data,
        )
        ctx.db.add(record)
    else:
        for k, v in data.items():
            setattr(record, k, v)

    ctx.db.commit()
    ctx.db.refresh(record)
    return record
