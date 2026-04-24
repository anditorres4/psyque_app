"""CashSession ORM model — user's cash drawer turn.

Table: cash_sessions
"""
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKey


class CashSession(Base, UUIDPrimaryKey):
    """Represents an open/closed cash drawer shift for a user."""

    __tablename__ = "cash_sessions"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    opened_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
    )
    closed_at: Mapped[datetime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        sa.Enum("open", "closed", name="cash_session_status"),
        nullable=False,
        default="open",
    )
    notes: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)