"""Pydantic schemas for appointment endpoints."""
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


SessionType = Literal["individual", "couple", "family", "followup"]
Modality = Literal["presential", "virtual"]
AppointmentStatus = Literal["scheduled", "completed", "cancelled", "noshow"]
CancelledBy = Literal["psychologist", "patient"]


class AppointmentCreate(BaseModel):
    patient_id: uuid.UUID
    scheduled_start: datetime
    scheduled_end: datetime
    session_type: SessionType
    modality: Modality
    notes: str | None = Field(None, max_length=1000)

    @model_validator(mode="after")
    def end_after_start(self) -> "AppointmentCreate":
        if self.scheduled_end <= self.scheduled_start:
            raise ValueError("scheduled_end must be after scheduled_start")
        duration = (self.scheduled_end - self.scheduled_start).total_seconds() / 60
        if duration < 15:
            raise ValueError("Appointment must be at least 15 minutes long")
        if duration > 180:
            raise ValueError("Appointment cannot exceed 3 hours")
        return self


class AppointmentUpdate(BaseModel):
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    session_type: SessionType | None = None
    modality: Modality | None = None
    notes: str | None = Field(None, max_length=1000)

    @model_validator(mode="after")
    def end_after_start(self) -> "AppointmentUpdate":
        if self.scheduled_start and self.scheduled_end:
            if self.scheduled_end <= self.scheduled_start:
                raise ValueError("scheduled_end must be after scheduled_start")
            duration = (self.scheduled_end - self.scheduled_start).total_seconds() / 60
            if duration < 15:
                raise ValueError("Appointment must be at least 15 minutes long")
            if duration > 180:
                raise ValueError("Appointment cannot exceed 3 hours")
        return self


class CancelRequest(BaseModel):
    cancelled_by: CancelledBy
    cancellation_reason: str = Field(..., min_length=5, max_length=500)


class AppointmentSummary(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    patient_id: uuid.UUID
    scheduled_start: datetime
    scheduled_end: datetime
    session_type: str
    modality: str
    status: str
    notes: str | None
    created_at: datetime


class AppointmentDetail(AppointmentSummary):
    cancellation_reason: str | None
    cancelled_by: str | None
    reminder_sent_48h: bool
    reminder_sent_2h: bool
    updated_at: datetime
    video_room_id: str | None = None
    patient_join_key: str | None = None


class PaginatedAppointments(BaseModel):
    items: list[AppointmentSummary]
    total: int
    page: int
    page_size: int
    pages: int
