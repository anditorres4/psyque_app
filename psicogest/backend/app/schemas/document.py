"""Pydantic schemas for clinical documents."""
import uuid
from datetime import datetime

from pydantic import BaseModel


class DocumentRead(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    filename: str
    content_type: str
    file_size: int
    document_type: str
    description: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentCreate(BaseModel):
    document_type: str
    description: str | None = None