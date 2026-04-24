"""Pydantic schemas for session endpoints — clinical notes (Res. 1995/1999)."""
import re
import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.constants import DIAGNOSIS_TYPE

_CIE11_RE = re.compile(r"^[0-9A-Z][0-9A-Z]{2,3}(?:\.[0-9A-Z]+)*(?:\/[A-Z0-9]+)?$")
_CUPS_RE = re.compile(r"^\d{6}$")


class SessionCreate(BaseModel):
    appointment_id: uuid.UUID | None = None
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
    tipo_dx_principal: str = Field(default="1", max_length=1)

    @field_validator("tipo_dx_principal")
    @classmethod
    def validate_tipo_dx(cls, v: str) -> str:
        if v not in DIAGNOSIS_TYPE:
            raise ValueError(f"tipo_dx_principal debe ser uno de: {', '.join(DIAGNOSIS_TYPE.keys())}")
        return v

    @model_validator(mode="after")
    def end_after_start(self) -> "SessionCreate":
        if self.actual_end <= self.actual_start:
            raise ValueError("actual_end must be after actual_start")
        return self

    @model_validator(mode="after")
    def codes_format(self) -> "SessionCreate":
        if not _CIE11_RE.match(self.diagnosis_cie11):
            raise ValueError(
                "diagnosis_cie11 must follow CIE-11 format (e.g. 6A70, 6A70.1, 11A6/Z)"
            )
        if not _CUPS_RE.match(self.cups_code):
            raise ValueError(
                "cups_code must be a 6-digit numeric code (e.g. 890403)"
            )
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
    tipo_dx_principal: str | None = Field(None, max_length=1)

    @field_validator("tipo_dx_principal")
    @classmethod
    def validate_tipo_dx(cls, v: str | None) -> str | None:
        if v is not None and v not in DIAGNOSIS_TYPE:
            raise ValueError(f"tipo_dx_principal debe ser uno de: {', '.join(DIAGNOSIS_TYPE.keys())}")
        return v

    @model_validator(mode="after")
    def end_after_start(self) -> "SessionUpdate":
        if self.actual_start and self.actual_end:
            if self.actual_end <= self.actual_start:
                raise ValueError("actual_end must be after actual_start")
        return self

    @model_validator(mode="after")
    def codes_format(self) -> "SessionUpdate":
        if self.diagnosis_cie11 and not _CIE11_RE.match(self.diagnosis_cie11):
            raise ValueError(
                "diagnosis_cie11 must follow CIE-11 format (e.g. 6A70, 6A70.1, 11A6/Z)"
            )
        if self.cups_code and not _CUPS_RE.match(self.cups_code):
            raise ValueError(
                "cups_code must be a 6-digit numeric code (e.g. 890403)"
            )
        return self


class SessionSummary(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    appointment_id: uuid.UUID | None
    patient_id: uuid.UUID
    actual_start: datetime
    actual_end: datetime
    diagnosis_cie11: str
    cups_code: str
    session_fee: int
    status: str
    created_at: datetime
    tipo_dx_principal: str


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
