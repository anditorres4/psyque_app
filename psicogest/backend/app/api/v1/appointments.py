"""Appointments router — RF-AGE-01 to RF-AGE-05."""
import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status

from app.core.deps import get_tenant_db, TenantDB
from app.models.patient import Patient
from app.models.tenant import Tenant
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentDetail,
    AppointmentSummary,
    AppointmentUpdate,
    CancelRequest,
    PaginatedAppointments,
    SeriesCreate,
    SeriesOut,
)
from app.models.appointment import Appointment
from app.models.appointment_series import AppointmentSeries
from app.services.appointment_service import (
    AppointmentConflictError,
    AppointmentNotFoundError,
    AppointmentService,
)
from app.services.email_service import EmailService
from app.services.gcal_sync_service import sync_appointment_background

logger = logging.getLogger(__name__)


def _send_confirmation_email(
    *,
    to_email: str,
    patient_name: str,
    psychologist_name: str,
    appointment_start: datetime,
    modality: str,
) -> None:
    try:
        EmailService().send_appointment_confirmation(
            to_email=to_email,
            patient_name=patient_name,
            psychologist_name=psychologist_name,
            appointment_start=appointment_start,
            modality=modality,
        )
    except Exception:
        logger.exception("Failed to send appointment confirmation to %s", to_email)

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
    background_tasks: BackgroundTasks,
) -> AppointmentDetail:
    try:
        appt = _service(ctx).create(body.model_dump())
        ctx.db.commit()
        ctx.db.refresh(appt)
        background_tasks.add_task(
            sync_appointment_background, ctx.tenant.tenant_id, str(appt.id), "create"
        )
        patient = ctx.db.get(Patient, appt.patient_id)
        if patient and patient.email:
            tenant = ctx.db.get(Tenant, uuid.UUID(ctx.tenant.tenant_id))
            background_tasks.add_task(
                _send_confirmation_email,
                to_email=patient.email,
                patient_name=patient.full_name,
                psychologist_name=tenant.full_name if tenant else "tu psicólogo",
                appointment_start=appt.scheduled_start,
                modality=appt.modality,
            )
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
    background_tasks: BackgroundTasks,
) -> AppointmentDetail:
    try:
        appt = _service(ctx).update(appointment_id, body.model_dump(exclude_none=True))
        ctx.db.commit()
        ctx.db.refresh(appt)
        background_tasks.add_task(
            sync_appointment_background, ctx.tenant.tenant_id, str(appt.id), "update"
        )
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
    background_tasks: BackgroundTasks,
) -> AppointmentDetail:
    try:
        appt = _service(ctx).cancel(
            appointment_id,
            cancelled_by=body.cancelled_by,
            reason=body.cancellation_reason,
        )
        ctx.db.commit()
        ctx.db.refresh(appt)
        background_tasks.add_task(
            sync_appointment_background, ctx.tenant.tenant_id, str(appt.id), "cancel"
        )
        return AppointmentDetail.model_validate(appt)
    except AppointmentNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada.")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/{appointment_id}/complete", response_model=AppointmentDetail)
def complete_appointment(
    appointment_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    background_tasks: BackgroundTasks,
) -> AppointmentDetail:
    try:
        appt = _service(ctx).complete(appointment_id)
        ctx.db.commit()
        ctx.db.refresh(appt)
        background_tasks.add_task(
            sync_appointment_background, ctx.tenant.tenant_id, str(appt.id), "update"
        )
        return AppointmentDetail.model_validate(appt)
    except AppointmentNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada.")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/{appointment_id}/noshow", response_model=AppointmentDetail)
def noshow_appointment(
    appointment_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    background_tasks: BackgroundTasks,
) -> AppointmentDetail:
    try:
        appt = _service(ctx).mark_noshow(appointment_id)
        ctx.db.commit()
        ctx.db.refresh(appt)
        background_tasks.add_task(
            sync_appointment_background, ctx.tenant.tenant_id, str(appt.id), "update"
        )
        return AppointmentDetail.model_validate(appt)
    except AppointmentNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada.")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ── Recurring series ──────────────────────────────────────────────────────────

@router.post("/series", response_model=SeriesOut, status_code=status.HTTP_201_CREATED)
def create_appointment_series(
    body: SeriesCreate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    background_tasks: BackgroundTasks,
) -> SeriesOut:
    """Create a recurring series and generate N individual appointments.

    Skips slots with conflicts rather than aborting the whole series.
    """
    tenant_id = uuid.UUID(ctx.tenant.tenant_id)

    series = AppointmentSeries(
        tenant_id=tenant_id,
        patient_id=body.patient_id,
        day_of_week=body.day_of_week,
        time_hour=body.time_hour,
        time_minute=body.time_minute,
        duration_minutes=body.duration_minutes,
        session_type=body.session_type,
        modality=body.modality,
        n_repetitions=body.n_repetitions,
        first_date=body.first_date,
        notes=body.notes,
        status="active",
    )
    ctx.db.add(series)
    ctx.db.flush()

    svc = _service(ctx)
    created = 0
    current = body.first_date

    # Advance to the target day_of_week on or after first_date
    days_ahead = (body.day_of_week - current.weekday()) % 7
    current = current + timedelta(days=days_ahead)

    patient = ctx.db.get(Patient, body.patient_id)
    tenant = ctx.db.get(Tenant, tenant_id)

    for _ in range(body.n_repetitions):
        start_dt = datetime(
            current.year, current.month, current.day,
            body.time_hour, body.time_minute, tzinfo=timezone.utc,
        )
        end_dt = start_dt + timedelta(minutes=body.duration_minutes)
        try:
            appt = svc.create({
                "patient_id": body.patient_id,
                "scheduled_start": start_dt,
                "scheduled_end": end_dt,
                "session_type": body.session_type,
                "modality": body.modality,
                "notes": body.notes,
            })
            appt.series_id = series.id
            ctx.db.flush()
            created += 1

            if patient and patient.email:
                background_tasks.add_task(
                    _send_confirmation_email,
                    to_email=patient.email,
                    patient_name=patient.full_name,
                    psychologist_name=tenant.full_name if tenant else "tu psicólogo",
                    appointment_start=start_dt,
                    modality=body.modality,
                )
        except AppointmentConflictError:
            pass  # Skip conflicting slot, continue series

        current = current + timedelta(weeks=1)

    ctx.db.commit()
    ctx.db.refresh(series)

    result = SeriesOut.model_validate(series)
    result.appointments_created = created
    return result


@router.delete("/series/{series_id}", status_code=status.HTTP_200_OK)
def cancel_appointment_series(
    series_id: uuid.UUID,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> dict:
    """Cancel a series and all its future scheduled appointments."""
    tenant_id = uuid.UUID(ctx.tenant.tenant_id)
    series = ctx.db.get(AppointmentSeries, series_id)
    if not series or series.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Serie no encontrada.")

    series.status = "cancelled"

    now = datetime.now(timezone.utc)
    future_appts = (
        ctx.db.query(Appointment)
        .filter(
            Appointment.series_id == series_id,
            Appointment.status == "scheduled",
            Appointment.scheduled_start > now,
        )
        .all()
    )
    cancelled_count = 0
    for appt in future_appts:
        appt.status = "cancelled"
        appt.cancelled_by = "psychologist"
        appt.cancellation_reason = "Serie cancelada"
        cancelled_count += 1

    ctx.db.commit()
    return {"ok": True, "appointments_cancelled": cancelled_count}
