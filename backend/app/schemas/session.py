"""Pydantic schemas for session endpoints — clinical notes (Res. 1995/1999)."""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class SessionCreate(BaseModel):
    appointment_id: uuid.UUID
    patient_id: uuid.UUID
    actual_start: datetime
    actual_end: datetime
    diagnosis_cie11: str = Field(..., max_length=20)
    diagnosis_description: str = Field(..., min_length=5)
    cups_code: str = Field(..., max_length=10)
    consultation_reason: str = Field(..., min_length=10)
    intervention: str = Field(..., min_length=10)
    evolution: str | None = None
    next_session_plan: str | None = None
    session_fee: int = Field(..., ge=0)
    authorization_number: str | None = Field(None, max_length=30)

    @model_validator(mode="after")
    def end_after_start(self) -> "SessionCreate":
        if self.actual_end <= self.actual_start:
            raise ValueError("actual_end must be after actual_start")
        return self


class SessionUpdate(BaseModel):
    actual_start: datetime | None = None
    actual_end: datetime | None = None
    diagnosis_cie11: str | None = Field(None, max_length=20)
    diagnosis_description: str | None = Field(None, min_length=5)
    cups_code: str | None = Field(None, max_length=10)
    consultation_reason: str | None = Field(None, min_length=10)
    intervention: str | None = Field(None, min_length=10)
    evolution: str | None = None
    next_session_plan: str | None = None
    session_fee: int | None = Field(None, ge=0)
    authorization_number: str | None = Field(None, max_length=30)

    @model_validator(mode="after")
    def end_after_start(self) -> "SessionUpdate":
        if self.actual_start and self.actual_end:
            if self.actual_end <= self.actual_start:
                raise ValueError("actual_end must be after actual_start")
        return self


class SessionSummary(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    appointment_id: uuid.UUID
    patient_id: uuid.UUID
    actual_start: datetime
    actual_end: datetime
    diagnosis_cie11: str
    cups_code: str
    session_fee: int
    status: str
    created_at: datetime


class SessionDetail(SessionSummary):
    diagnosis_description: str
    consultation_reason: str
    intervention: str
    evolution: str | None
    next_session_plan: str | None
    authorization_number: str | None
    session_hash: str | None
    signed_at: datetime | None
    rips_included: bool
    updated_at: datetime


class PaginatedSessions(BaseModel):
    items: list[SessionSummary]
    total: int
    page: int
    page_size: int
    pages: int


class SessionNoteCreate(BaseModel):
    content: str = Field(..., min_length=5, max_length=5000)


class SessionNoteDetail(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    session_id: uuid.UUID
    content: str
    note_hash: str
    created_at: datetime
