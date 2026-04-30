"""Video call endpoints — integración 100ms.live con auth tokens."""
import uuid
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.deps import get_tenant_db, TenantDB
from app.models.appointment import Appointment
from app.services.hms_service import HmsService
from app.core.config import settings

router = APIRouter(prefix="/appointments", tags=["video"])


class VideoRoomResponse(BaseModel):
    room_id: str
    host_token: str
    guest_token: str
    patient_join_url: str


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


def _build_response(room_id: str, appointment_id: str, svc: HmsService) -> VideoRoomResponse:
    host_token = svc.create_app_token(room_id, f"host-{uuid.uuid4()}", "psychologist")
    guest_token = svc.create_app_token(room_id, f"patient-{uuid.uuid4()}", "patient")
    patient_url = f"{settings.app_url}/join/{appointment_id}?t={guest_token}&role=patient"
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

    return _build_response(room_id, appointment_id, svc)


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
    return _build_response(appt.video_room_id, appointment_id, svc)
