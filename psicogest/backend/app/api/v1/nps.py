"""NPS survey router — post-session satisfaction surveys."""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_tenant_db, TenantDB
from app.models.nps_survey import NpsSurvey
from app.services.nps_service import NpsService

router = APIRouter(tags=["nps"])


class NpsRespondBody(BaseModel):
    score: int = Field(..., ge=0, le=10)
    feedback: str | None = Field(None, max_length=1000)


class NpsSurveyOut(BaseModel):
    id: str
    session_id: str
    patient_email: str
    patient_name: str
    score: int | None
    feedback: str | None
    sent_at: str
    responded_at: str | None


class NpsPublicOut(BaseModel):
    token: str
    patient_name: str
    already_responded: bool
    score: int | None


# ── Public endpoints (no auth) — patient submits survey ──────────────────────

@router.get("/public/nps/{token}", response_model=NpsPublicOut)
def get_nps_public(token: str, db: Annotated[Session, Depends(get_db)]) -> NpsPublicOut:
    survey = db.query(NpsSurvey).filter(NpsSurvey.token == token).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Encuesta no encontrada.")
    return NpsPublicOut(
        token=token,
        patient_name=survey.patient_name,
        already_responded=survey.responded_at is not None,
        score=survey.score,
    )


@router.post("/public/nps/{token}/respond", status_code=status.HTTP_200_OK)
def respond_nps(
    token: str,
    body: NpsRespondBody,
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    survey = db.query(NpsSurvey).filter(NpsSurvey.token == token).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Encuesta no encontrada.")
    if survey.responded_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Esta encuesta ya fue respondida.")
    survey.score = body.score
    survey.feedback = body.feedback
    survey.responded_at = datetime.now(tz=timezone.utc)
    db.commit()
    return {"ok": True}


# ── Authenticated endpoints — psychologist views results ─────────────────────

@router.get("/nps", response_model=list[NpsSurveyOut])
def list_nps(ctx: Annotated[TenantDB, Depends(get_tenant_db)]) -> list[NpsSurveyOut]:
    svc = NpsService(ctx.db, ctx.tenant.tenant_id)
    return [
        NpsSurveyOut(
            id=str(s.id),
            session_id=str(s.session_id),
            patient_email=s.patient_email,
            patient_name=s.patient_name,
            score=s.score,
            feedback=s.feedback,
            sent_at=s.sent_at.isoformat(),
            responded_at=s.responded_at.isoformat() if s.responded_at else None,
        )
        for s in svc.list_for_tenant()
    ]
