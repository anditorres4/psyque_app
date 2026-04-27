"""Booking requests router — autenticado para psicólogos."""
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import get_tenant_db, TenantDB
from app.schemas.booking import BookingRequestSummary
from app.services.booking_service import BookingNotFoundError, BookingService

router = APIRouter(prefix="/booking-requests", tags=["booking-requests"])


def _svc(ctx: TenantDB) -> BookingService:
    return BookingService(ctx.db)


@router.get("", response_model=list[BookingRequestSummary])
def list_booking_requests(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    req_status: str | None = None,
):
    return _svc(ctx).list_by_tenant(uuid.UUID(ctx.tenant.tenant_id), req_status)


@router.post("/{request_id}/confirm", response_model=BookingRequestSummary)
def confirm_request(request_id: uuid.UUID, ctx: Annotated[TenantDB, Depends(get_tenant_db)]):
    try:
        return _svc(ctx).confirm(request_id, uuid.UUID(ctx.tenant.tenant_id))
    except BookingNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")


@router.post("/{request_id}/reject", response_model=BookingRequestSummary)
def reject_request(request_id: uuid.UUID, ctx: Annotated[TenantDB, Depends(get_tenant_db)]):
    try:
        return _svc(ctx).reject(request_id, uuid.UUID(ctx.tenant.tenant_id))
    except BookingNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")