"""TriageService — manage WhatsApp PHQ-9 triage sessions."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.triage_session import TriageSession
from app.schemas.triage import TriageWebhookPayload


def _compute_urgency(phq9_score: int | None, phq9_item9_score: int | None) -> str:
    # Item 9 (self-harm) score ≥ 2 always forces critical per clinical protocol
    if phq9_item9_score is not None and phq9_item9_score >= 2:
        return "critical"
    if phq9_score is None:
        return "medium"
    if phq9_score <= 4:
        return "low"
    if phq9_score <= 9:
        return "medium"
    if phq9_score <= 14:
        return "high"
    return "critical"


class TriageService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_from_webhook(self, payload: TriageWebhookPayload) -> TriageSession:
        tenant_uuid = uuid.UUID(payload.tenant_id)
        urgency = _compute_urgency(payload.phq9_score, payload.phq9_item9_score)
        status = "escalated" if urgency == "critical" else "completed"

        session = TriageSession(
            tenant_id=tenant_uuid,
            patient_name=payload.patient_name,
            patient_phone=payload.patient_phone,
            whatsapp_message_id=payload.whatsapp_message_id,
            status=status,
            urgency_level=urgency,
            phq9_score=payload.phq9_score,
            phq9_item9_score=payload.phq9_item9_score,
            responses=[r.model_dump() for r in payload.responses],
            summary=payload.summary,
            completed_at=datetime.now(tz=timezone.utc),
        )
        self.db.add(session)
        self.db.flush()
        return session

    def list_by_tenant(
        self,
        tenant_id: uuid.UUID,
        status: str | None = None,
        limit: int = 50,
    ) -> list[TriageSession]:
        q = self.db.query(TriageSession).filter(TriageSession.tenant_id == tenant_id)
        if status:
            q = q.filter(TriageSession.status == status)
        return q.order_by(TriageSession.created_at.desc()).limit(limit).all()

    def get(self, session_id: uuid.UUID, tenant_id: uuid.UUID) -> TriageSession | None:
        s = self.db.get(TriageSession, session_id)
        if not s or s.tenant_id != tenant_id:
            return None
        return s
