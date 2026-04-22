"""Tenant SQLAlchemy model — psychologist/clinic subscription.

Table exists from migration 0001.
"""
import uuid
from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import DateTime, func

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class Tenant(Base, UUIDPrimaryKey):
    """Psychologist/clinic subscription — one per authenticated user."""

    __tablename__ = "tenants"

    auth_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, unique=True
    )
    full_name: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    colpsic_number: Mapped[str] = mapped_column(sa.String(20), nullable=False)
    reps_code: Mapped[str | None] = mapped_column(sa.String(30), nullable=True)
    nit: Mapped[str | None] = mapped_column(sa.String(15), nullable=True)
    plan: Mapped[str] = mapped_column(
        sa.Enum("starter", "pro", "clinic", name="saas_plan"),
        nullable=False,
        default="starter",
    )
    plan_expires_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False
    )
    city: Mapped[str] = mapped_column(sa.String(100), nullable=False)
    session_duration_min: Mapped[int] = mapped_column(sa.Integer(), nullable=False, default=50)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )