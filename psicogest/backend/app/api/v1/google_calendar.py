"""Google Calendar integration router."""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_tenant_db, TenantDB
from app.core.database import get_db
from app.services.gcal_service import GCalNotConfiguredError, GCalAuthError, GCalService
from app.services.gcal_sync_service import GCalSyncService

router = APIRouter(prefix="/google-calendar", tags=["google-calendar"])


class GCalStatusResponse(BaseModel):
    connected: bool
    sync_enabled: bool
    calendar_id: str | None


class GCalAuthUrlResponse(BaseModel):
    auth_url: str


@router.get("/auth-url", response_model=GCalAuthUrlResponse)
def get_auth_url(ctx: Annotated[TenantDB, Depends(get_tenant_db)]):
    """Return the Google OAuth2 authorization URL for this tenant."""
    try:
        svc = GCalService(ctx.db)
        base_url = svc.build_auth_url()
        state = GCalService.sign_state(ctx.tenant.tenant_id)
        separator = "&" if "?" in base_url else "?"
        return GCalAuthUrlResponse(auth_url=f"{base_url}{separator}state={state}")
    except GCalNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/callback")
def oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
):
    """OAuth2 callback — exchanges code for tokens, redirects to frontend settings."""
    frontend_url = settings.app_url.rstrip("/")
    try:
        tenant_id_str = GCalService.verify_state(state)
        GCalService(db).exchange_code(code, uuid.UUID(tenant_id_str))
        return RedirectResponse(url=f"{frontend_url}/settings?gcal=connected")
    except (GCalAuthError, Exception):
        return RedirectResponse(
            url=f"{frontend_url}/settings?gcal=error&msg=No+se+pudo+conectar"
        )


@router.get("/status", response_model=GCalStatusResponse)
def get_status(ctx: Annotated[TenantDB, Depends(get_tenant_db)]):
    token = GCalService(ctx.db).get_token(uuid.UUID(ctx.tenant.tenant_id))
    if not token:
        return GCalStatusResponse(connected=False, sync_enabled=False, calendar_id=None)
    return GCalStatusResponse(
        connected=True, sync_enabled=token.sync_enabled, calendar_id=token.calendar_id
    )


@router.post("/disconnect", status_code=204)
def disconnect(ctx: Annotated[TenantDB, Depends(get_tenant_db)]):
    GCalService(ctx.db).disconnect(uuid.UUID(ctx.tenant.tenant_id))


@router.post("/sync", status_code=204)
def manual_sync(ctx: Annotated[TenantDB, Depends(get_tenant_db)]):
    """Trigger a manual pull of external GCal blocks for this tenant."""
    try:
        GCalSyncService(ctx.db).pull_external_blocks(uuid.UUID(ctx.tenant.tenant_id))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Google Calendar sync failed: {exc}")