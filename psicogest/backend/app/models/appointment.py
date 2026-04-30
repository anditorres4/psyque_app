"""Appointment model — citas agendadas."""
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, TenantMixin, UUIDPrimaryKey


class Appointment(Base, UUIDPrimaryKey, TenantMixin, TimestampMixin):
    """Scheduled appointment between psychologist and patient."""

    __tablename__ = "appointments"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    scheduled_start: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False
    )
    scheduled_end: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False
    )
    session_type: Mapped[str] = mapped_column(
        sa.Enum("individual", "couple", "family", "followup", name="session_type"),
        nullable=False,
    )
    modality: Mapped[str] = mapped_column(
        sa.Enum("presential", "virtual", name="modality"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        sa.Enum("scheduled", "completed", "cancelled", "noshow", name="appointment_status"),
        nullable=False,
        server_default=sa.text("'scheduled'"),
    )
    cancellation_reason: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    cancelled_by: Mapped[str | None] = mapped_column(
        sa.Enum("psychologist", "patient", name="cancelled_by"), nullable=True
    )
    reminder_sent_48h: Mapped[bool] = mapped_column(
        sa.Boolean(), nullable=False, server_default=sa.text("false")
    )
    reminder_sent_2h: Mapped[bool] = mapped_column(
        sa.Boolean(), nullable=False, server_default=sa.text("false")
    )
    notes: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    gcal_event_id: Mapped[str | None] = mapped_column(sa.String(200), nullable=True)
    video_room_id: Mapped[str | None] = mapped_column(sa.String(100), nullable=True)
    patient_join_key: Mapped[str | None] = mapped_column(
        sa.String(36), nullable=True, unique=True, index=True
    )
