"""Webhook router — receives events from n8n automations."""
import hmac
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
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


def _verify_secret(x_webhook_secret: str | None) -> None:
    """Verify webhook secret via constant-time comparison.

    Skips verification in development when webhook_triage_secret is unset.
    """
    if not settings.webhook_triage_secret:
        if not settings.is_development:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Webhook secret not configured.",
            )
        return  # allow unauthenticated in dev

    if not x_webhook_secret or not hmac.compare_digest(
        x_webhook_secret, settings.webhook_triage_secret
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook secret.",
        )


@router.post(
    "/whatsapp-triage",
    response_model=TriageSessionOut,
    status_code=status.HTTP_201_CREATED,
)
def receive_triage_webhook(
    payload: TriageWebhookPayload,
    db: Annotated[Session, Depends(get_db)],
    x_webhook_secret: Annotated[str | None, Header()] = None,
) -> TriageSessionOut:
    """Receive a completed WhatsApp triage session from n8n.

    Authentication: X-Webhook-Secret header must match WEBHOOK_TRIAGE_SECRET env var.
    """
    _verify_secret(x_webhook_secret)

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
