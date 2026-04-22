"""ClinicalDocument ORM model — patient document attachments.

Table: clinical_documents
Documents are append-only (no UPDATE) per Res. 1995/1999.
"""
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import DateTime, func

from app.models.base import Base, UUIDPrimaryKey, TenantMixin


class ClinicalDocument(Base, UUIDPrimaryKey, TenantMixin):
    """Clinical document attached to a patient."""

    __tablename__ = "clinical_documents"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(sa.String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(sa.Integer(), nullable=False)
    storage_path: Mapped[str] = mapped_column(sa.String(500), nullable=False)
    document_type: Mapped[str] = mapped_column(sa.String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )