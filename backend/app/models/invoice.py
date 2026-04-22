"""Invoice ORM model — liquidations for private patients.

Table: invoices
"""
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import DateTime, func

from app.models.base import Base, TimestampMixin, TenantMixin, UUIDPrimaryKey


class Invoice(Base, UUIDPrimaryKey, TenantMixin, TimestampMixin):
    """Invoice/liquidation for private patient services."""

    __tablename__ = "invoices"

    invoice_number: Mapped[str] = mapped_column(sa.String(20), nullable=False)
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        sa.Enum("draft", "issued", "paid", name="invoice_status"),
        nullable=False,
        server_default=sa.text("'draft'"),
    )
    issue_date: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=True
    )
    due_date: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=True
    )
    subtotal_cop: Mapped[int] = mapped_column(sa.Integer(), nullable=False)
    tax_cop: Mapped[int] = mapped_column(sa.Integer(), nullable=False)
    total_cop: Mapped[int] = mapped_column(sa.Integer(), nullable=False)
    session_ids: Mapped[list] = mapped_column(JSONB(), nullable=False)
    notes: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=True
    )
    pdf_file_path: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)