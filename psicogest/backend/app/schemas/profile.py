"""Pydantic schemas for tenant profile."""
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class TenantProfileRead(BaseModel):
    id: uuid.UUID
    full_name: str
    colpsic_number: str
    reps_code: str | None
    nit: str | None
    city: str
    session_duration_min: int
    plan: Literal["starter", "pro", "clinic"]
    plan_expires_at: datetime
    booking_enabled: bool
    booking_slug: str | None
    booking_welcome_message: str | None
    ai_provider: str | None
    ai_model: str | None
    features: dict = {}

    model_config = {"from_attributes": True}


class TenantProfileUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=200)
    colpsic_number: str | None = Field(None, max_length=20)
    reps_code: str | None = Field(None, max_length=30)
    nit: str | None = Field(None, max_length=15)
    city: str | None = Field(None, max_length=100)
    session_duration_min: int | None = Field(None, ge=30, le=120)
    booking_enabled: bool | None = None
    booking_welcome_message: str | None = Field(None, max_length=500)