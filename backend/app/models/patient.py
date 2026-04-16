"""Patient SQLAlchemy model — ficha de identificación Res. 1995/1999."""
import uuid
from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import INET, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, TenantMixin, UUIDPrimaryKey


class Patient(Base, UUIDPrimaryKey, TenantMixin, TimestampMixin):
    """Patient record. One row per patient per tenant.

    hc_number format: HC-YYYY-NNNN (auto-generated, unique per tenant).
    consent_signed_at and consent_ip are immutable after creation (Ley 1581/2012).
    """

    __tablename__ = "patients"

    hc_number: Mapped[str] = mapped_column(sa.String(20), nullable=False)
    doc_type: Mapped[str] = mapped_column(
        sa.Enum("CC", "TI", "CE", "PA", "RC", "MS", name="doc_type"),
        nullable=False,
    )
    doc_number: Mapped[str] = mapped_column(sa.String(20), nullable=False)
    first_surname: Mapped[str] = mapped_column(sa.String(100), nullable=False)
    second_surname: Mapped[str | None] = mapped_column(sa.String(100), nullable=True)
    first_name: Mapped[str] = mapped_column(sa.String(100), nullable=False)
    second_name: Mapped[str | None] = mapped_column(sa.String(100), nullable=True)
    birth_date: Mapped[date] = mapped_column(sa.Date(), nullable=False)
    biological_sex: Mapped[str] = mapped_column(
        sa.Enum("M", "F", "I", name="biological_sex"),
        nullable=False,
    )
    gender_identity: Mapped[str | None] = mapped_column(sa.String(50), nullable=True)
    marital_status: Mapped[str] = mapped_column(
        sa.Enum("S", "C", "U", "D", "V", "SE", name="marital_status"),
        nullable=False,
    )
    occupation: Mapped[str] = mapped_column(sa.String(150), nullable=False)
    address: Mapped[str] = mapped_column(sa.Text(), nullable=False)
    municipality_dane: Mapped[str] = mapped_column(sa.String(10), nullable=False)
    zone: Mapped[str] = mapped_column(
        sa.Enum("U", "R", name="zone"),
        nullable=False,
    )
    phone: Mapped[str] = mapped_column(sa.String(20), nullable=False)
    email: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    emergency_contact_name: Mapped[str | None] = mapped_column(sa.String(200), nullable=True)
    emergency_contact_phone: Mapped[str | None] = mapped_column(sa.String(20), nullable=True)
    payer_type: Mapped[str] = mapped_column(
        sa.Enum("PA", "CC", "SS", "PE", "SE", name="payer_type"),
        nullable=False,
    )
    eps_name: Mapped[str | None] = mapped_column(sa.String(200), nullable=True)
    eps_code: Mapped[str | None] = mapped_column(sa.String(10), nullable=True)
    authorization_number: Mapped[str | None] = mapped_column(sa.String(30), nullable=True)
    current_diagnosis_cie11: Mapped[str | None] = mapped_column(sa.String(20), nullable=True)
    # Consentimiento informado — inmutable tras creación (Ley 1581/2012)
    consent_signed_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False
    )
    consent_ip: Mapped[str] = mapped_column(INET(), nullable=False)
    is_active: Mapped[bool] = mapped_column(sa.Boolean(), nullable=False, default=True)

    @property
    def full_name(self) -> str:
        """Construct full name: APELLIDO1 [APELLIDO2] NOMBRE1 [NOMBRE2]."""
        parts = [self.first_surname]
        if self.second_surname:
            parts.append(self.second_surname)
        parts.append(self.first_name)
        if self.second_name:
            parts.append(self.second_name)
        return " ".join(parts)

    @property
    def age(self) -> int:
        """Calculate current age in years from birth_date."""
        from datetime import date as date_type
        today = date_type.today()
        return (
            today.year
            - self.birth_date.year
            - ((today.month, today.day) < (self.birth_date.month, self.birth_date.day))
        )
