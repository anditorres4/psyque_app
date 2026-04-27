"""Referral ORM model — patient referrals to other professionals."""
import uuid

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKey, TenantMixin, TimestampMixin


class Referral(Base, UUIDPrimaryKey, TenantMixin, TimestampMixin):
    __tablename__ = "referrals"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    session_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    referred_to_name: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    referred_to_specialty: Mapped[str] = mapped_column(sa.String(100), nullable=False)
    referred_to_institution: Mapped[str | None] = mapped_column(sa.String(200), nullable=True)
    reason: Mapped[str] = mapped_column(sa.Text(), nullable=False)
    priority: Mapped[str] = mapped_column(
        sa.Enum("urgente", "preferente", "programado", name="referral_priority"),
        nullable=False,
        server_default="programado",
    )
    notes: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
