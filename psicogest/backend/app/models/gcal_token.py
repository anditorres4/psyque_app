"""GoogleCalendarToken model — OAuth2 credentials per tenant."""
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import DateTime, func

from app.models.base import Base


class GoogleCalendarToken(Base):
    __tablename__ = "google_calendar_tokens"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    access_token: Mapped[str] = mapped_column(sa.Text(), nullable=False)
    refresh_token: Mapped[str] = mapped_column(sa.Text(), nullable=False)
    token_expiry: Mapped[datetime] = mapped_column(sa.TIMESTAMP(timezone=True), nullable=False)
    calendar_id: Mapped[str] = mapped_column(sa.String(200), nullable=False, server_default=sa.text("'primary'"))
    sync_enabled: Mapped[bool] = mapped_column(sa.Boolean(), nullable=False, server_default=sa.text("true"))
    sync_token: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)