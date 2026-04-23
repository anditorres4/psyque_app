"""Appointments router — RF-AGE-01 to RF-AGE-05."""
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.deps import get_tenant_db, TenantDB
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentDetail,
    AppointmentSummary,
    AppointmentUpdate,
    CancelRequest,
    PaginatedAppointments,
)
from app.services.appointment_service import (
    AppointmentConflictError,
    AppointmentNotFoundError,
    AppointmentService,
)

router = APIRouter(prefix="/appointments", tags=["appointments"])


def _service(ctx: TenantDB) -> AppointmentService:
    return AppointmentService(ctx.db, ctx.tenant.tenant_id)


@router.get("", response_model=PaginatedAppointments)
def list_appointments(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    patient_id: str | None = Query(None),
    appt_status: str | None = Query(None, alias="status"),
) -> PaginatedAppointments:
    return _service(ctx).list_paginated(
        page=page, page_size=page_size, patient_id=patient_id, status=appt_status
    )


@router.get("/range", response_model=list[AppointmentSummary])
def list_appointments_by_range(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    start: datetime = Query(..., description="ISO datetime (UTC)"),
    end: datetime = Query(..., description="ISO datetime (UTC)"),
) -> list[AppointmentSummary]:
    """Return appointments overlapping a datetime range. Used by FullCalendar."""
    appts = _service(ctx).list_by_range(start=start, end=end)
    return [AppointmentSummary.model_validate(a) for a in appts]


@router.post("", response_model=AppointmentDetail, status_code=status.HTTP_201_CREATED)
def create_appointment(
    body: AppointmentCreate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> AppointmentDetail:
    try:
        appt = _service(ctx).create(body.model_dump())
        ctx.db.commit()
        ctx.db.refresh(appt)
        return AppointmentDetail.model_validate(appt)
    except AppointmentConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.get("/{appointment_id}", response_model=AppointmentDetail)
def get_appointment(
    appointment_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> AppointmentDetail:
    try:
        return AppointmentDetail.model_validate(_service(ctx).get_by_id(appointment_id))
    except AppointmentNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada.")


@router.put("/{appointment_id}", response_model=AppointmentDetail)
def update_appointment(
    appointment_id: str,
    body: AppointmentUpdate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> AppointmentDetail:
    try:
        appt = _service(ctx).update(appointment_id, body.model_dump(exclude_none=True))
        ctx.db.commit()
        ctx.db.refresh(appt)
        return AppointmentDetail.model_validate(appt)
    except AppointmentNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada.")
    except AppointmentConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.post("/{appointment_id}/cancel", response_model=AppointmentDetail)
def cancel_appointment(
    appointment_id: str,
    body: CancelRequest,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> AppointmentDetail:
    try:
        appt = _service(ctx).cancel(
            appointment_id,
            cancelled_by=body.cancelled_by,
            reason=body.cancellation_reason,
        )
        ctx.db.commit()
        ctx.db.refresh(appt)
        return AppointmentDetail.model_validate(appt)
    except AppointmentNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada.")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/{appointment_id}/complete", response_model=AppointmentDetail)
def complete_appointment(
    appointment_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> AppointmentDetail:
    try:
        appt = _service(ctx).complete(appointment_id)
        ctx.db.commit()
        ctx.db.refresh(appt)
        return AppointmentDetail.model_validate(appt)
    except AppointmentNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada.")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/{appointment_id}/noshow", response_model=AppointmentDetail)
def noshow_appointment(
    appointment_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> AppointmentDetail:
    try:
        appt = _service(ctx).mark_noshow(appointment_id)
        ctx.db.commit()
        ctx.db.refresh(appt)
        return AppointmentDetail.model_validate(appt)
    except AppointmentNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada.")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
