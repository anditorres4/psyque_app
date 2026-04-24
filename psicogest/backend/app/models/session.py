"""Session and SessionNote ORM models — clinical records (Res. 1995/1999).

Tables already exist from migration 0001 — no new migration needed.
Signed sessions are immutable by law; enforcement is in SessionService.
SessionNote is append-only: no updated_at column.
"""
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import DateTime, func

from app.models.base import Base, TimestampMixin, TenantMixin, UUIDPrimaryKey


class Session(Base, UUIDPrimaryKey, TenantMixin, TimestampMixin):
    """Clinical session note linked to one appointment."""

    __tablename__ = "sessions"

    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    actual_start: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False
    )
    actual_end: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False
    )
    diagnosis_cie11: Mapped[str] = mapped_column(sa.String(20), nullable=False)
    diagnosis_description: Mapped[str] = mapped_column(sa.Text(), nullable=False)
    cups_code: Mapped[str] = mapped_column(sa.String(10), nullable=False)
    consultation_reason: Mapped[str] = mapped_column(sa.Text(), nullable=False)
    intervention: Mapped[str] = mapped_column(sa.Text(), nullable=False)
    evolution: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    next_session_plan: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    session_fee: Mapped[int] = mapped_column(sa.Integer(), nullable=False)
    authorization_number: Mapped[str | None] = mapped_column(
        sa.String(30), nullable=True
    )
    status: Mapped[str] = mapped_column(
        sa.Enum("draft", "signed", name="session_status"),
        nullable=False,
        server_default=sa.text("'draft'"),
    )
    session_hash: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)
    signed_at: Mapped[datetime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=True
    )
    rips_included: Mapped[bool] = mapped_column(
        sa.Boolean(), nullable=False, server_default=sa.text("false")
    )
    tipo_dx_principal: Mapped[str] = mapped_column(
        sa.String(1), nullable=False, server_default=sa.text("'1'")
    )


class SessionNote(Base, UUIDPrimaryKey, TenantMixin):
    """Append-only clarification note added after a session is signed.

    No updated_at — modifications are forbidden by Res. 1995/1999.
    """

    __tablename__ = "session_notes"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    content: Mapped[str] = mapped_column(sa.Text(), nullable=False)
    note_hash: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
