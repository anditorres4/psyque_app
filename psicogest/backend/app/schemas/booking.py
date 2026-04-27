"""Pydantic schemas for public booking endpoints."""
from datetime import datetime
from pydantic import BaseModel, Field


class BookingInfo(BaseModel):
    tenant_name: str
    welcome_message: str
    session_duration_min: int
    slots: list[str]


class BookingRequestCreate(BaseModel):
    patient_name: str = Field(..., min_length=2, max_length=200)
    patient_email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    patient_phone: str | None = Field(None, max_length=20)
    session_type: str = Field("individual", pattern="^(individual|couple|family|followup)$")
    requested_start: datetime
    notes: str | None = Field(None, max_length=500)


class BookingRequestCreated(BaseModel):
    id: str
    status: str


class BookingRequestSummary(BaseModel):
    id: str
    patient_name: str
    patient_email: str
    patient_phone: str | None
    session_type: str
    requested_start: datetime
    requested_end: datetime
    status: str
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}