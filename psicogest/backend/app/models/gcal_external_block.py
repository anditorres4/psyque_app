"""GCalExternalBlock — eventos externos de Google Calendar que bloquean slots."""
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import DateTime, UniqueConstraint, func

from app.models.base import Base


class GCalExternalBlock(Base):
    __tablename__ = "gcal_external_blocks"
    __table_args__ = (
        UniqueConstraint("tenant_id", "gcal_event_id", name="uix_gcal_ext_blocks_tenant_event"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    gcal_event_id: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    start_time: Mapped[datetime] = mapped_column(sa.TIMESTAMP(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(sa.TIMESTAMP(timezone=True), nullable=False)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )