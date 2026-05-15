"""AppointmentSeries — defines a recurring appointment schedule."""
import uuid
from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import DateTime, func

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPrimaryKey


class AppointmentSeries(Base, UUIDPrimaryKey, TenantMixin, TimestampMixin):
    """Recurring appointment template.

    Stores the recurrence rule; individual Appointment rows are generated
    from it and linked via appointments.series_id.
    """

    __tablename__ = "appointment_series"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    # day_of_week: 0=Monday … 6=Sunday (Python weekday convention)
    day_of_week: Mapped[int] = mapped_column(sa.SmallInteger(), nullable=False)
    time_hour: Mapped[int] = mapped_column(sa.SmallInteger(), nullable=False)
    time_minute: Mapped[int] = mapped_column(sa.SmallInteger(), nullable=False, server_default=sa.text("0"))
    duration_minutes: Mapped[int] = mapped_column(sa.SmallInteger(), nullable=False, server_default=sa.text("50"))
    session_type: Mapped[str] = mapped_column(
        sa.Enum("individual", "couple", "family", "followup", name="session_type"),
        nullable=False,
    )
    modality: Mapped[str] = mapped_column(
        sa.Enum("presential", "virtual", name="modality"),
        nullable=False,
    )
    n_repetitions: Mapped[int] = mapped_column(sa.SmallInteger(), nullable=False)
    first_date: Mapped[date] = mapped_column(sa.Date(), nullable=False)
    notes: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    status: Mapped[str] = mapped_column(
        sa.String(20), nullable=False, server_default=sa.text("'active'")
    )
