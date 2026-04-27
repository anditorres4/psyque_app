"""BookingRequest model — solicitudes públicas de cita."""
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import DateTime, func

from app.models.base import Base, UUIDPrimaryKey


class BookingRequest(Base, UUIDPrimaryKey):
    """Solicitud de cita creada por un paciente via enlace público.
    
    No tiene RLS — filtrada por tenant_id en las consultas del servicio.
    """
    __tablename__ = "booking_requests"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    patient_name: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    patient_email: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    patient_phone: Mapped[str | None] = mapped_column(sa.String(20), nullable=True)
    session_type: Mapped[str] = mapped_column(sa.String(20), nullable=False, server_default="individual")
    requested_start: Mapped[datetime] = mapped_column(sa.TIMESTAMP(timezone=True), nullable=False)
    requested_end: Mapped[datetime] = mapped_column(sa.TIMESTAMP(timezone=True), nullable=False)
    notes: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    status: Mapped[str] = mapped_column(
        sa.Enum("pending", "confirmed", "rejected", name="booking_request_status"),
        nullable=False,
        server_default=sa.text("'pending'"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )