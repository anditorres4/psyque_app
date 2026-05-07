"""Notifications router — in-app alerts for the authenticated psychologist."""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import TenantDB, get_tenant_db
from app.schemas.notification import NotificationListResponse, NotificationOut
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _svc(ctx: TenantDB) -> NotificationService:
    return NotificationService(ctx.db)


def _auth_id(ctx: TenantDB) -> uuid.UUID:
    return uuid.UUID(ctx.tenant.user_id)


@router.get("", response_model=NotificationListResponse)
def list_notifications(ctx: Annotated[TenantDB, Depends(get_tenant_db)]):
    svc = _svc(ctx)
    auth_id = _auth_id(ctx)
    items = svc.list_recent(auth_id)
    unread = svc.unread_count(auth_id)
    return NotificationListResponse(
        items=[NotificationOut.model_validate(n) for n in items],
        unread_count=unread,
    )


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_read(
    notification_id: uuid.UUID,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
):
    svc = _svc(ctx)
    n = svc.mark_read(notification_id, _auth_id(ctx))
    if not n:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notificación no encontrada.")
    ctx.db.commit()
    return NotificationOut.model_validate(n)


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(ctx: Annotated[TenantDB, Depends(get_tenant_db)]):
    _svc(ctx).mark_all_read(_auth_id(ctx))
    ctx.db.commit()
