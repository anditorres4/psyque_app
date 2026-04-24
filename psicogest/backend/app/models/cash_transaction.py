"""CashTransaction ORM model — income/expense movement within a cash session.

Table: cash_transactions
"""
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKey


class CashTransaction(Base, UUIDPrimaryKey):
    """Each money movement within a cash drawer session."""

    __tablename__ = "cash_transactions"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )
    type: Mapped[str] = mapped_column(
        sa.Enum("income", "expense", name="cash_transaction_type"),
        nullable=False,
    )
    amount: Mapped[int] = mapped_column(
        sa.Integer(),
        nullable=False,
    )
    category: Mapped[str] = mapped_column(
        sa.Enum(
            "particular", "eps", "nomina", "servicios", "compras", "otro",
            name="transaction_category",
        ),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    invoice_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )
    patient_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )
    payment_method: Mapped[str | None] = mapped_column(
        sa.String(20),
        nullable=True,
    )
    eps_name: Mapped[str | None] = mapped_column(
        sa.String(200),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )
