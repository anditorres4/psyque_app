"""NPS survey model — post-session satisfaction survey."""
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import DateTime, func

from app.models.base import Base


class NpsSurvey(Base):
    __tablename__ = "nps_surveys"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"))
    psychologist_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    patient_email: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    patient_name: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    token: Mapped[str] = mapped_column(sa.String(64), nullable=False, unique=True)
    score: Mapped[int | None] = mapped_column(sa.SmallInteger(), nullable=True)
    feedback: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
