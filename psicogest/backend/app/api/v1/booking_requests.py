"""Booking requests router — autenticado para psicólogos."""
import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status

from app.core.config import settings
from app.core.deps import get_tenant_db, TenantDB
from app.models.tenant import Tenant
from app.schemas.booking import BookingRequestSummary
from app.services.booking_service import BookingNotFoundError, BookingService
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/booking-requests", tags=["booking-requests"])


def _send_booking_confirmation(
    *,
    to_email: str,
    patient_name: str,
    psychologist_name: str,
    requested_start,
) -> None:
    try:
        EmailService().send_appointment_confirmation(
            to_email=to_email,
            patient_name=patient_name,
            psychologist_name=psychologist_name,
            appointment_start=requested_start,
            modality="virtual",
        )
    except Exception:
        logger.exception("Failed to send booking confirmation to %s", to_email)


def _send_registration_email(
    *,
    to_email: str,
    patient_name: str,
    psychologist_name: str,
    registration_link: str,
    appointment_start,
) -> None:
    try:
        EmailService().send_patient_registration_request(
            to_email=to_email,
            patient_name=patient_name,
            psychologist_name=psychologist_name,
            registration_link=registration_link,
            appointment_start=appointment_start,
        )
    except Exception:
        logger.exception("Failed to send registration email to %s", to_email)


def _svc(ctx: TenantDB) -> BookingService:
    return BookingService(ctx.db)


def _to_summary(req, registration_pending: bool = False) -> BookingRequestSummary:
    return BookingRequestSummary(
        id=str(req.id),
        patient_name=req.patient_name,
        patient_email=req.patient_email,
        patient_phone=req.patient_phone,
        session_type=req.session_type,
        requested_start=req.requested_start,
        requested_end=req.requested_end,
        status=req.status,
        notes=req.notes,
        created_at=req.created_at,
        registration_pending=registration_pending,
        registration_token_expires_at=req.registration_token_expires_at,
    )


@router.get("", response_model=list[BookingRequestSummary])
def list_booking_requests(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    req_status: Annotated[str | None, Query(alias="status")] = None,
):
    requests = _svc(ctx).list_by_tenant(uuid.UUID(ctx.tenant.tenant_id), req_status)
    return [
        _to_summary(
            req,
            registration_pending=(
                req.registration_token is not None
                and req.registration_token_used_at is None
            ),
        )
        for req in requests
    ]


@router.post("/{request_id}/confirm", response_model=BookingRequestSummary)
def confirm_request(
    request_id: uuid.UUID,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    background_tasks: BackgroundTasks,
):
    try:
        req = _svc(ctx).confirm(request_id, uuid.UUID(ctx.tenant.tenant_id))
        ctx.db.commit()

        registration_pending = (
            req.registration_token is not None
            and req.registration_token_used_at is None
        )

        if registration_pending:
            tenant = ctx.db.get(Tenant, uuid.UUID(ctx.tenant.tenant_id))
            psychologist_name = tenant.full_name if tenant else "tu psicólogo"
            registration_link = f"{settings.frontend_url}/completar-registro/{req.registration_token}"
            background_tasks.add_task(
                _send_registration_email,
                to_email=req.patient_email,
                patient_name=req.patient_name,
                psychologist_name=psychologist_name,
                registration_link=registration_link,
                appointment_start=req.requested_start,
            )
        elif req.patient_email:
            tenant = ctx.db.get(Tenant, uuid.UUID(ctx.tenant.tenant_id))
            psychologist_name = tenant.full_name if tenant else "tu psicólogo"
            background_tasks.add_task(
                _send_booking_confirmation,
                to_email=req.patient_email,
                patient_name=req.patient_name,
                psychologist_name=psychologist_name,
                requested_start=req.requested_start,
            )

        return _to_summary(req, registration_pending=registration_pending)
    except BookingNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")


@router.post("/{request_id}/reject", response_model=BookingRequestSummary)
def reject_request(request_id: uuid.UUID, ctx: Annotated[TenantDB, Depends(get_tenant_db)]):
    try:
        req = _svc(ctx).reject(request_id, uuid.UUID(ctx.tenant.tenant_id))
        ctx.db.commit()
        return _to_summary(req)
    except BookingNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")


@router.post("/{request_id}/resend-registration", response_model=BookingRequestSummary)
def resend_registration(
    request_id: uuid.UUID,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    background_tasks: BackgroundTasks,
):
    try:
        req = _svc(ctx).resend_registration(request_id, uuid.UUID(ctx.tenant.tenant_id))
        ctx.db.commit()
        tenant = ctx.db.get(Tenant, uuid.UUID(ctx.tenant.tenant_id))
        psychologist_name = tenant.full_name if tenant else "tu psicólogo"
        registration_link = f"{settings.frontend_url}/completar-registro/{req.registration_token}"
        background_tasks.add_task(
            _send_registration_email,
            to_email=req.patient_email,
            patient_name=req.patient_name,
            psychologist_name=psychologist_name,
            registration_link=registration_link,
            appointment_start=req.requested_start,
        )
        return _to_summary(req, registration_pending=True)
    except BookingNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")
