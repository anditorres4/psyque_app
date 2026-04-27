"""Public booking router — no authentication required."""
from typing import Annotated
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.booking import BookingInfo, BookingRequestCreate, BookingRequestCreated
from app.services.booking_service import BookingNotFoundError, BookingService
from app.services.email_service import EmailService

router = APIRouter(prefix="/public/booking", tags=["booking-public"])


def _send_notification_bg(
    to_email: str,
    tenant_name: str,
    patient_name: str,
    patient_email: str,
    patient_phone: str | None,
    requested_start,
    session_type: str,
    notes: str | None,
):
    try:
        EmailService().send_booking_notification(
            to_email=to_email, tenant_name=tenant_name,
            patient_name=patient_name, patient_email=patient_email,
            patient_phone=patient_phone, requested_start=requested_start,
            session_type=session_type, notes=notes,
        )
    except Exception:
        pass


@router.get("/{slug}", response_model=BookingInfo)
def get_booking_info(slug: str, db: Annotated[Session, Depends(get_db)]):
    svc = BookingService(db)
    try:
        tenant = svc.get_tenant_by_slug(slug)
    except BookingNotFoundError:
        raise HTTPException(status_code=404, detail="Página de agendamiento no disponible.")
    return BookingInfo(
        tenant_name=tenant.full_name,
        welcome_message=tenant.booking_welcome_message or "",
        session_duration_min=tenant.session_duration_min,
        slots=svc.get_available_slots(tenant),
    )


@router.post("/{slug}/request", response_model=BookingRequestCreated, status_code=status.HTTP_201_CREATED)
def create_booking_request(
    slug: str, body: BookingRequestCreate, db: Annotated[Session, Depends(get_db)],
    bg: BackgroundTasks,
):
    svc = BookingService(db)
    try:
        tenant = svc.get_tenant_by_slug(slug)
    except BookingNotFoundError:
        raise HTTPException(status_code=404, detail="Página de agendamiento no disponible.")

    req = svc.create_request(
        tenant=tenant, patient_name=body.patient_name, patient_email=body.patient_email,
        patient_phone=body.patient_phone, session_type=body.session_type,
        requested_start=body.requested_start, notes=body.notes,
    )

    if tenant.email:
        bg.add_task(
            _send_notification_bg,
            tenant.email, tenant.full_name,
            body.patient_name, body.patient_email,
            body.patient_phone, body.requested_start,
            body.session_type, body.notes,
        )

    return BookingRequestCreated(id=str(req.id), status=req.status)