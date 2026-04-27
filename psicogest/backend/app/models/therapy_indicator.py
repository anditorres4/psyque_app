"""TherapyIndicator and TherapyMeasurement ORM models."""
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKey, TenantMixin, TimestampMixin


class TherapyIndicator(Base, UUIDPrimaryKey, TenantMixin, TimestampMixin):
    __tablename__ = "therapy_indicators"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    unit: Mapped[str | None] = mapped_column(sa.String(50), nullable=True)
    initial_value: Mapped[float | None] = mapped_column(sa.Numeric(10, 2), nullable=True)
    target_value: Mapped[float | None] = mapped_column(sa.Numeric(10, 2), nullable=True)
    is_active: Mapped[bool] = mapped_column(sa.Boolean(), server_default=sa.text("true"), nullable=False)


class TherapyMeasurement(Base, UUIDPrimaryKey, TenantMixin):
    __tablename__ = "therapy_measurements"

    indicator_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    session_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    value: Mapped[float] = mapped_column(sa.Numeric(10, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    measured_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
    )
