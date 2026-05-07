"""Notification model — in-app alerts for the psychologist."""
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    # auth.users UUID — matches auth.uid() for Supabase Realtime RLS
    psychologist_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    type: Mapped[str] = mapped_column(sa.String(50), nullable=False)
    title: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    body: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(sa.TIMESTAMP(timezone=True), nullable=True)
    extra_data: Mapped[dict] = mapped_column("metadata", JSONB(), nullable=False, server_default=sa.text("'{}'"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
