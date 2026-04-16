"""Patients router — RF-PAC-01, RF-PAC-02, RF-PAC-03 from PRD §7.1."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.core.deps import get_tenant_db, TenantDB
from app.schemas.patient import (
    PaginatedPatients,
    PatientCreate,
    PatientDetail,
    PatientSummary,
    PatientUpdate,
)
from app.services.patient_service import (
    DuplicateDocumentError,
    PatientNotFoundError,
    PatientService,
)

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


@router.get("/{patient_id}/sessions", response_model=list[dict])
def get_patient_sessions(
    patient_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    page: int = Query(1, ge=1),
) -> list[dict]:
    """List clinical sessions for a patient.

    Sessions module (Sprint 5) will replace this stub with full SessionSummary.
    """
    try:
        _service(ctx).get_by_id(patient_id)
    except PatientNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado.")
    return []


@router.get("/{patient_id}/appointments", response_model=list[dict])
def get_patient_appointments(
    patient_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> list[dict]:
    """List appointments for a patient.

    Appointments module (Sprint 3) will replace this stub.
    """
    try:
        _service(ctx).get_by_id(patient_id)
    except PatientNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado.")
    return []
