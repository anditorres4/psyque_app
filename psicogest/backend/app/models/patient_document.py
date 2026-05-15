"""PatientDocument — signed onboarding documents for the patient portal flow."""
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import DateTime, func

from app.models.base import Base

# doc_type values and their order in the onboarding wizard
DOC_TYPE_ORDER = [
    "service_conditions",
    "consent_therapeutic",
    "assent_minor_u13",
    "assent_minor_13_18",
    "consent_guardian",
    "intake_questionnaire",
]


class PatientDocument(Base):
    """Record of a document signed by the patient during portal onboarding.

    Immutable after creation — represents legal acceptance at a point in time.
    content_version lets us detect if a newer version needs re-signing.
    """

    __tablename__ = "patient_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    psychologist_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    doc_type: Mapped[str] = mapped_column(
        sa.Enum(
            "service_conditions",
            "consent_therapeutic",
            "assent_minor_u13",
            "assent_minor_13_18",
            "consent_guardian",
            "intake_questionnaire",
            name="patient_doc_type",
        ),
        nullable=False,
    )
    signed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ip: Mapped[str] = mapped_column(sa.String(45), nullable=False)
    content_version: Mapped[str] = mapped_column(
        sa.String(20), nullable=False, server_default=sa.text("'1.0'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
