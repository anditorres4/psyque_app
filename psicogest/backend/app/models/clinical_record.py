"""ClinicalRecord ORM model — one per patient, stores clinical intake data."""
import uuid

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKey, TenantMixin, TimestampMixin


class ClinicalRecord(Base, UUIDPrimaryKey, TenantMixin, TimestampMixin):
    """Initial clinical intake record — antecedentes + treatment plan."""

    __tablename__ = "clinical_records"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    chief_complaint: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    antecedentes_personales: Mapped[dict | None] = mapped_column(JSONB(), nullable=True)
    antecedentes_familiares: Mapped[dict | None] = mapped_column(JSONB(), nullable=True)
    antecedentes_medicos: Mapped[dict | None] = mapped_column(JSONB(), nullable=True)
    antecedentes_psicologicos: Mapped[dict | None] = mapped_column(JSONB(), nullable=True)
    initial_diagnosis_cie11: Mapped[str | None] = mapped_column(sa.String(20), nullable=True)
    initial_diagnosis_description: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    treatment_plan: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    therapeutic_goals: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    presenting_problems: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    symptom_description: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    mental_exam: Mapped[dict | None] = mapped_column(JSONB(), nullable=True)