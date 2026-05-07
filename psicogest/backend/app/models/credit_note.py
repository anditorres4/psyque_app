"""CreditDebitNote — adjustments referencing an issued invoice (NC/ND)."""
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin


class CreditDebitNote(Base, TenantMixin):
    __tablename__ = "credit_debit_notes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    type: Mapped[str] = mapped_column(
        sa.Enum("credit", "debit", name="note_type_enum"), nullable=False
    )
    number: Mapped[str] = mapped_column(sa.String(30), nullable=False)
    reason: Mapped[str] = mapped_column(sa.Text(), nullable=False)
    amount_cop: Mapped[int] = mapped_column(sa.Integer(), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
