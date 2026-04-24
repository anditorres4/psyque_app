"""RipsExport ORM model — RIPS export registry (Res. 2275/2023).

Table already exists from migration 0001 — model mirrors existing schema for ORM access.
"""
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, TenantMixin, UUIDPrimaryKey


class RipsExport(Base, UUIDPrimaryKey, TenantMixin, TimestampMixin):
    """RIPS export registry with hash integrity."""

    __tablename__ = "rips_exports"

    period_year: Mapped[int] = mapped_column(sa.SmallInteger(), nullable=False)
    period_month: Mapped[int] = mapped_column(sa.SmallInteger(), nullable=False)
    status: Mapped[str] = mapped_column(
        sa.Enum("pending", "generated", "submitted", name="rips_export_status"),
        nullable=False,
        server_default=sa.text("'pending'"),
    )
    sessions_count: Mapped[int] = mapped_column(sa.Integer(), nullable=False)
    total_value_cop: Mapped[int] = mapped_column(sa.Integer(), nullable=False)
    json_file_path: Mapped[str] = mapped_column(sa.Text(), nullable=False)
    file_hash: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)
    generated_at: Mapped[datetime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=True
    )
    validation_errors: Mapped[dict | None] = mapped_column(JSONB(), nullable=True)
    snapshot: Mapped[dict | None] = mapped_column(JSONB(), nullable=True)