"""Video call endpoints — integración 100ms.live con auth tokens."""
import uuid
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.core.deps import get_tenant_db, TenantDB
from app.models.appointment import Appointment
from app.services.hms_service import HmsService

router = APIRouter(prefix="/appointments", tags=["video"])


class VideoRoomResponse(BaseModel):
    room_id: str
    host_token: str
    guest_token: str
    patient_join_url: str


class PublicVideoTokenResponse(BaseModel):
    room_id: str
    token: str


def _ensure_patient_join_key(appt: Appointment, db: Session) -> str:
    if appt.patient_join_key:
        return appt.patient_join_key

    appt.patient_join_key = str(uuid.uuid4())
    db.add(appt)
    db.commit()
    db.refresh(appt)
    return appt.patient_join_key


def _get_appointment(appointment_id: str, ctx: TenantDB) -> Appointment:
    appt = ctx.db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.tenant_id == ctx.tenant.tenant_id,
    ).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    if appt.modality != "virtual":
        raise HTTPException(status_code=422, detail="La cita no es virtual")
    return appt


def _build_response(
    room_id: str,
    appointment_id: str,
    patient_join_key: str,
    svc: HmsService,
) -> VideoRoomResponse:
    host_token = svc.create_app_token(room_id, f"host-{uuid.uuid4()}", "host")
    guest_token = svc.create_app_token(room_id, f"patient-{uuid.uuid4()}", "host")
    patient_url = f"{settings.app_url}/join/{appointment_id}?k={patient_join_key}&role=host"
    return VideoRoomResponse(
        room_id=room_id,
        host_token=host_token,
        guest_token=guest_token,
        patient_join_url=patient_url,
    )


@router.post("/{appointment_id}/video-room", response_model=VideoRoomResponse)
def create_video_room(
    appointment_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> VideoRoomResponse:
    """Create (or reuse) a 100ms room. Returns auth tokens for psychologist and patient."""
    if not settings.hms_app_key:
        raise HTTPException(status_code=503, detail="Video no configurado")

    appt = _get_appointment(appointment_id, ctx)
    svc = HmsService()

    if not appt.video_room_id:
        try:
            room_id = svc.create_room(appointment_id)
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=502, detail=f"Error al crear sala: {e.response.text}")
        appt.video_room_id = room_id
        ctx.db.commit()
    else:
        room_id = appt.video_room_id

    patient_join_key = _ensure_patient_join_key(appt, ctx.db)
    return _build_response(room_id, appointment_id, patient_join_key, svc)


@router.get("/{appointment_id}/video-room/token", response_model=VideoRoomResponse)
def refresh_video_token(
    appointment_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> VideoRoomResponse:
    """Return fresh auth tokens for an existing video room."""
    if not settings.hms_app_key:
        raise HTTPException(status_code=503, detail="Video no configurado")

    appt = _get_appointment(appointment_id, ctx)
    if not appt.video_room_id:
        raise HTTPException(status_code=404, detail="La sala de video no ha sido creada")

    svc = HmsService()
    patient_join_key = _ensure_patient_join_key(appt, ctx.db)
    return _build_response(appt.video_room_id, appointment_id, patient_join_key, svc)


@router.get("/public/{appointment_id}/video-room/token", response_model=PublicVideoTokenResponse)
def get_public_video_token(
    appointment_id: str,
    join_key: str,
    db: Annotated[Session, Depends(get_db)],
) -> PublicVideoTokenResponse:
    """Return a fresh patient token for a stable public join link."""
    appt = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.patient_join_key == join_key,
    ).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Enlace de videollamada no disponible")
    if appt.modality != "virtual":
        raise HTTPException(status_code=422, detail="La cita no es virtual")
    if appt.status != "scheduled":
        raise HTTPException(status_code=409, detail="La videollamada ya no está disponible")
    if not appt.video_room_id:
        raise HTTPException(status_code=404, detail="La sala de video no ha sido creada")

    svc = HmsService()
    token = svc.create_app_token(appt.video_room_id, f"patient-{uuid.uuid4()}", "host")
    return PublicVideoTokenResponse(room_id=appt.video_room_id, token=token)
