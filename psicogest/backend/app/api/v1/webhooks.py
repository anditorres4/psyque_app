"""Webhook router — receives events from n8n automations."""
import hashlib
import hmac
import time
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import TenantDB, get_tenant_db
from app.schemas.triage import TriageListResponse, TriageSessionOut, TriageWebhookPayload
from app.services.notification_service import NotificationService
from app.models.tenant import Tenant

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

URGENCY_LABELS = {
    "low": "Bajo",
    "medium": "Moderado",
    "high": "Alto",
    "critical": "CRÍTICO",
}


_MAX_TIMESTAMP_SKEW = 300   # 5 minutes — reject replays older than this
_MAX_FUTURE_SKEW = 60       # 1 minute tolerance for clock drift


def _verify_hmac(
    body: bytes,
    x_webhook_signature: str | None,
    x_webhook_timestamp: str | None,
) -> None:
    """Verify HMAC-SHA256 signature + timestamp to prevent replay attacks.

    Expected headers:
      X-Webhook-Signature: sha256=<hex digest of body using WEBHOOK_TRIAGE_SECRET>
      X-Webhook-Timestamp: <unix timestamp as decimal string>
    """
    if not settings.webhook_triage_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook secret not configured. Set WEBHOOK_TRIAGE_SECRET environment variable.",
        )

    if not x_webhook_timestamp:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing X-Webhook-Timestamp header.")
    try:
        request_ts = int(x_webhook_timestamp)
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid X-Webhook-Timestamp value.")

    now = int(time.time())
    age = now - request_ts
    if age > _MAX_TIMESTAMP_SKEW or age < -_MAX_FUTURE_SKEW:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Request timestamp is too old or too far in the future.")

    if not x_webhook_signature or not x_webhook_signature.startswith("sha256="):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing or malformed X-Webhook-Signature header.")

    provided = x_webhook_signature[len("sha256="):]
    expected = hmac.new(
        settings.webhook_triage_secret.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(provided, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid webhook signature.")


@router.post(
    "/whatsapp-triage",
    response_model=TriageSessionOut,
    status_code=status.HTTP_201_CREATED,
)
async def receive_triage_webhook(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    x_webhook_signature: Annotated[str | None, Header()] = None,
    x_webhook_timestamp: Annotated[str | None, Header()] = None,
) -> TriageSessionOut:
    """Receive a completed WhatsApp triage session from n8n.

    Authentication: HMAC-SHA256 via X-Webhook-Signature + X-Webhook-Timestamp headers.
    """
    body = await request.body()
    _verify_hmac(body, x_webhook_signature, x_webhook_timestamp)

    import json as _json
    try:
        payload = TriageWebhookPayload.model_validate(_json.loads(body))
    except Exception:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid payload.")

    from app.services.triage_service import TriageService
    svc = TriageService(db)

    try:
        uuid.UUID(payload.tenant_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="tenant_id must be a valid UUID.",
        )

    session = svc.create_from_webhook(payload)

    # Create in-app notification for the psychologist
    tenant = (
        db.query(Tenant)
        .filter(Tenant.id == session.tenant_id)
        .first()
    )
    if tenant:
        urgency_label = URGENCY_LABELS.get(session.urgency_level or "medium", "")
        NotificationService(db).create(
            psychologist_auth_id=tenant.auth_user_id,
            type="triage_completed",
            title=f"Triage completado — {payload.patient_name}",
            body=f"PHQ-9: {payload.phq9_score or 'N/A'} · Urgencia: {urgency_label}",
            extra_data={
                "triage_session_id": str(session.id),
                "urgency_level": session.urgency_level,
                "patient_phone": session.patient_phone,
            },
        )

    db.commit()
    db.refresh(session)
    return TriageSessionOut.model_validate(session)


@router.get("/triage-sessions", response_model=TriageListResponse)
def list_triage_sessions(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    req_status: Annotated[str | None, Query(alias="status")] = None,
    limit: int = Query(50, ge=1, le=200),
) -> TriageListResponse:
    """List triage sessions for the authenticated psychologist."""
    from app.services.triage_service import TriageService
    sessions = TriageService(ctx.db).list_by_tenant(
        uuid.UUID(ctx.tenant.tenant_id),
        status=req_status,
        limit=limit,
    )
    return TriageListResponse(
        items=[TriageSessionOut.model_validate(s) for s in sessions],
        total=len(sessions),
    )
