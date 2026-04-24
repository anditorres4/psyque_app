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
    amount_paid: Mapped[int] = mapped_column(sa.Integer(), nullable=False, default=0)
    payment_status: Mapped[str] = mapped_column(
        sa.Enum("unpaid", "partial", "paid", name="payment_status_enum"),
        nullable=False,
        server_default=sa.text("'unpaid'"),
    )
    session_ids: Mapped[list] = mapped_column(JSONB(), nullable=False)
    notes: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=True
    )
    pdf_file_path: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    amount_paid: Mapped[int] = mapped_column(
        sa.BigInteger(),
        nullable=False,
        default=0,
    )
    payment_status: Mapped[str] = mapped_column(
        sa.Enum("unpaid", "partial", "paid", name="payment_status"),
        nullable=False,
        default="unpaid",
    )

    def update_payment_status(self) -> None:
        """Recalculate payment_status based on amount_paid vs total_cop."""
        if self.amount_paid == 0:
            self.payment_status = "unpaid"
        elif self.amount_paid >= self.total_cop:
            self.payment_status = "paid"
        else:
            self.payment_status = "partial"