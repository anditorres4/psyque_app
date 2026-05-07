"""TriageSession — WhatsApp triage conversation result."""
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin


class TriageSession(Base, TenantMixin):
    __tablename__ = "triage_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    patient_name: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    patient_phone: Mapped[str] = mapped_column(sa.String(30), nullable=False)
    whatsapp_message_id: Mapped[str | None] = mapped_column(sa.String(100), nullable=True)
    status: Mapped[str] = mapped_column(
        sa.Enum("pending", "completed", "escalated", name="triage_status_enum"),
        nullable=False,
        server_default=sa.text("'pending'"),
    )
    urgency_level: Mapped[str | None] = mapped_column(
        sa.Enum("low", "medium", "high", "critical", name="urgency_level_enum"),
        nullable=True,
    )
    phq9_score: Mapped[int | None] = mapped_column(sa.Integer(), nullable=True)
    phq9_item9_score: Mapped[int | None] = mapped_column(sa.Integer(), nullable=True)
    responses: Mapped[list] = mapped_column(JSONB(), nullable=False, server_default=sa.text("'[]'"))
    summary: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    booking_request_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
