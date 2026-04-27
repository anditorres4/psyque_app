"""AI Clinical Record Summary model."""
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import DateTime, func

from app.models.base import Base


class AiClinicalRecordSummary(Base):
    """AI-generated summary of a clinical record."""

    __tablename__ = "ai_clinical_record_summaries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    summary: Mapped[str] = mapped_column(sa.Text(), nullable=False)
    key_aspects: Mapped[list] = mapped_column(
        JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")
    )
    recommendations: Mapped[list] = mapped_column(
        JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")
    )
    model_version: Mapped[str] = mapped_column(sa.String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )