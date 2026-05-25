"""Public booking router — no authentication required."""
import logging
import uuid
from datetime import date
from typing import Annotated

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.schemas.booking import (
    BookingInfo, BookingRequestCreate, BookingRequestCreated,
    RegistrationTokenInfo, PatientRegistrationBody, PatientRegistrationResult,
)
from app.services.booking_service import BookingNotFoundError, BookingService
from app.services.email_service import EmailService
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

_SUPABASE_ADMIN_HEADERS = {
    "apikey": settings.supabase_service_key,
    "Authorization": f"Bearer {settings.supabase_service_key}",
    "Content-Type": "application/json",
}

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

    # Create in-app notification for the psychologist
    NotificationService(db).create(
        psychologist_auth_id=tenant.auth_user_id,
        type="new_booking_request",
        title=f"Nueva solicitud de cita — {body.patient_name}",
        body=f"{body.session_type.capitalize()} · {body.requested_start.strftime('%d/%m/%Y %H:%M')}",
        extra_data={"booking_request_id": str(req.id)},
    )

    db.commit()

    if tenant.email:
        bg.add_task(
            _send_notification_bg,
            tenant.email, tenant.full_name,
            body.patient_name, body.patient_email,
            body.patient_phone, body.requested_start,
            body.session_type, body.notes,
        )

    return BookingRequestCreated(id=str(req.id), status=req.status)


@router.get("/registration/{token}", response_model=RegistrationTokenInfo)
def get_registration_info(token: str, db: Annotated[Session, Depends(get_db)]):
    """Return pre-fill data for the patient registration form. No auth required."""
    svc = BookingService(db)
    try:
        req, tenant = svc.get_registration_info(token)
    except BookingNotFoundError as e:
        msg = str(e)
        if "used" in msg:
            raise HTTPException(status_code=410, detail="Este enlace ya fue utilizado.")
        if "expired" in msg:
            raise HTTPException(status_code=410, detail="Este enlace expiró. Pide a tu psicólogo que lo reenvíe.")
        raise HTTPException(status_code=404, detail="Enlace no encontrado.")
    return RegistrationTokenInfo(
        patient_name=req.patient_name,
        patient_email=req.patient_email,
        psychologist_name=tenant.full_name if tenant else "tu psicólogo",
        requested_start=req.requested_start,
        session_type=req.session_type,
    )


@router.post("/registration/{token}", response_model=PatientRegistrationResult, status_code=201)
def complete_registration(
    token: str,
    body: PatientRegistrationBody,
    db: Annotated[Session, Depends(get_db)],
    bg: BackgroundTasks,
):
    """Complete patient registration: create Patient + Appointment + Supabase auth user."""
    svc = BookingService(db)
    try:
        birth_date = date.fromisoformat(body.birth_date)
        req, patient, appt = svc.complete_registration(
            token,
            doc_type=body.doc_type,
            doc_number=body.doc_number,
            birth_date=birth_date,
            biological_sex=body.biological_sex,
            phone=body.phone,
        )
    except BookingNotFoundError as e:
        msg = str(e)
        if "used" in msg:
            raise HTTPException(status_code=410, detail="Este enlace ya fue utilizado.")
        if "expired" in msg:
            raise HTTPException(status_code=410, detail="Este enlace expiró. Pide a tu psicólogo que lo reenvíe.")
        raise HTTPException(status_code=404, detail="Enlace no encontrado.")

    db.commit()

    bg.add_task(
        _activate_portal_and_invite,
        patient_id=str(patient.id),
        tenant_id=str(patient.tenant_id),
        patient_email=patient.email,
        patient_name=patient.first_name,
    )

    return PatientRegistrationResult(
        patient_name=req.patient_name,
        appointment_start=appt.scheduled_start,
    )


def _activate_portal_and_invite(
    *,
    patient_id: str,
    tenant_id: str,
    patient_email: str,
    patient_name: str,
) -> None:
    """Background: create Supabase auth user + send portal invite email."""
    from app.core.database import SessionLocal
    from app.models.patient import Patient as PatientModel
    from app.models.tenant import Tenant as TenantModel

    try:
        db = SessionLocal()
        try:
            tenant = db.get(TenantModel, uuid.UUID(tenant_id))
            psych_name = tenant.full_name if tenant else "tu psicólogo"

            resp = httpx.post(
                f"{settings.supabase_url}/auth/v1/admin/users",
                json={
                    "email": patient_email,
                    "email_confirm": True,
                    "app_metadata": {
                        "role": "patient",
                        "patient_id": patient_id,
                        "tenant_id": tenant_id,
                    },
                },
                headers=_SUPABASE_ADMIN_HEADERS,
                timeout=15.0,
            )
            email_existed = resp.status_code == 422 and "email_exists" in resp.text
            if not email_existed:
                resp.raise_for_status()
                auth_user_id = uuid.UUID(resp.json()["id"])
                patient = db.get(PatientModel, uuid.UUID(patient_id))
                if patient:
                    patient.auth_user_id = auth_user_id
                    db.commit()

            link_resp = httpx.post(
                f"{settings.supabase_url}/auth/v1/admin/generate_link",
                json={"type": "recovery", "email": patient_email},
                headers=_SUPABASE_ADMIN_HEADERS,
                timeout=10.0,
            )
            link_resp.raise_for_status()
            action_link = link_resp.json().get("action_link", "")

            EmailService().send_portal_invite(
                to_email=patient_email,
                patient_name=patient_name,
                psychologist_name=psych_name,
                action_link=action_link,
            )
        finally:
            db.close()
    except Exception:
        logger.exception("Failed to activate portal for patient %s", patient_id)