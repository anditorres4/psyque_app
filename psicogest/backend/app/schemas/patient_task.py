"""Pydantic schemas for PatientTask."""
import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class PatientTaskCreate(BaseModel):
    patient_id: uuid.UUID
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=5, max_length=2000)
    due_date: date | None = None
    session_id: uuid.UUID | None = None


class PatientTaskReview(BaseModel):
    reviewer_notes: str | None = Field(None, max_length=1000)


class PatientTaskOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    tenant_id: uuid.UUID
    patient_id: uuid.UUID
    session_id: uuid.UUID | None
    title: str
    description: str
    due_date: date | None
    status: Literal["pending", "submitted", "reviewed"]
    submission_text: str | None
    submission_file_path: str | None
    reviewed_at: datetime | None
    reviewer_notes: str | None
    created_at: datetime
    updated_at: datetime
