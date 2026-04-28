"""Booking requests router — autenticado para psicólogos."""
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.deps import get_tenant_db, TenantDB
from app.schemas.booking import BookingRequestSummary
from app.services.booking_service import BookingNotFoundError, BookingService

router = APIRouter(prefix="/booking-requests", tags=["booking-requests"])


def _svc(ctx: TenantDB) -> BookingService:
    return BookingService(ctx.db)


@router.get("", response_model=list[BookingRequestSummary])
def list_booking_requests(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    req_status: Annotated[str | None, Query(alias="status")] = None,
):
    requests = _svc(ctx).list_by_tenant(uuid.UUID(ctx.tenant.tenant_id), req_status)
    return [
        BookingRequestSummary(
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
        )
        for req in requests
    ]


@router.post("/{request_id}/confirm", response_model=BookingRequestSummary)
def confirm_request(request_id: uuid.UUID, ctx: Annotated[TenantDB, Depends(get_tenant_db)]):
    try:
        req = _svc(ctx).confirm(request_id, uuid.UUID(ctx.tenant.tenant_id))
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
        )
    except BookingNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")


@router.post("/{request_id}/reject", response_model=BookingRequestSummary)
def reject_request(request_id: uuid.UUID, ctx: Annotated[TenantDB, Depends(get_tenant_db)]):
    try:
        req = _svc(ctx).reject(request_id, uuid.UUID(ctx.tenant.tenant_id))
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
        )
    except BookingNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")
