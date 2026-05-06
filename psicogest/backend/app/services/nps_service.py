"""NPS survey service — create, send, and record patient responses."""
from __future__ import annotations

import hashlib
import os
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session as DBSession

from app.models.nps_survey import NpsSurvey
from app.models.patient import Patient
from app.models.session import Session
from app.models.tenant import Tenant
from app.core.config import settings
from app.services.email_service import EmailService


class NpsService:
    def __init__(self, db: DBSession, tenant_id: str) -> None:
        self.db = db
        self.tenant_id = uuid.UUID(tenant_id)
        self._email = EmailService()

    def _generate_token(self, session_id: uuid.UUID) -> str:
        raw = f"{session_id}{os.urandom(16).hex()}"
        return hashlib.sha256(raw.encode()).hexdigest()[:48]

    def create_and_send(self, session_id: str, frontend_url: str | None = None) -> NpsSurvey | None:
        """Create NPS survey and send email. Returns None if patient has no email."""
        sess = self.db.get(Session, uuid.UUID(session_id))
        if not sess or sess.tenant_id != self.tenant_id:
            return None

        patient = self.db.get(Patient, sess.patient_id)
        if not patient or not patient.email:
            return None

        tenant = self.db.get(Tenant, self.tenant_id)
        psychologist_name = tenant.full_name if tenant else "Tu psicólogo"

        token = self._generate_token(sess.id)
        survey = NpsSurvey(
            id=uuid.uuid4(),
            psychologist_id=self.tenant_id,
            session_id=sess.id,
            patient_email=patient.email,
            patient_name=patient.full_name,
            token=token,
        )
        self.db.add(survey)
        self.db.flush()

        base = frontend_url or settings.app_url
        survey_url = f"{base}/nps/{token}"
        try:
            self._email.send_nps_survey(
                to_email=patient.email,
                patient_name=patient.first_name,
                psychologist_name=psychologist_name,
                survey_url=survey_url,
            )
        except Exception:
            pass  # NPS email failure must never block session signing

        return survey

    def get_by_token(self, token: str) -> NpsSurvey | None:
        return self.db.query(NpsSurvey).filter(NpsSurvey.token == token).first()

    def respond(self, token: str, score: int, feedback: str | None) -> NpsSurvey | None:
        survey = self.get_by_token(token)
        if not survey or survey.responded_at is not None:
            return None
        if not (0 <= score <= 10):
            return None
        survey.score = score
        survey.feedback = feedback
        survey.responded_at = datetime.now(tz=timezone.utc)
        self.db.flush()
        return survey

    def list_for_tenant(self) -> list[NpsSurvey]:
        return (
            self.db.query(NpsSurvey)
            .filter(NpsSurvey.psychologist_id == self.tenant_id)
            .order_by(NpsSurvey.created_at.desc())
            .all()
        )
