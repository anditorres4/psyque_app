"""AvailabilityBlock ORM model — psychologist weekly availability.

Table already exists from migration 0001.
"""
import uuid
from datetime import time

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, TenantMixin, UUIDPrimaryKey


class AvailabilityBlock(Base, UUIDPrimaryKey, TenantMixin, TimestampMixin):
    """Weekly availability block for appointments."""

    __tablename__ = "availability_blocks"

    day_of_week: Mapped[int] = mapped_column(sa.SmallInteger(), nullable=False)
    start_time: Mapped[time] = mapped_column(sa.Time(), nullable=False)
    end_time: Mapped[time] = mapped_column(sa.Time(), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        sa.Boolean(), nullable=False, server_default=sa.text("true")
    )