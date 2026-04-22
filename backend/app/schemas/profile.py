"""Pydantic schemas for tenant profile."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class TenantProfileRead(BaseModel):
    id: str
    full_name: str
    colpsic_number: str
    reps_code: str | None
    nit: str | None
    city: str
    session_duration_min: int
    plan: Literal["starter", "pro", "clinic"]
    plan_expires_at: datetime

    model_config = {"from_attributes": True}


class TenantProfileUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=200)
    colpsic_number: str | None = Field(None, max_length=20)
    reps_code: str | None = Field(None, max_length=30)
    nit: str | None = Field(None, max_length=15)
    city: str | None = Field(None, max_length=100)
    session_duration_min: int | None = Field(None, ge=30, le=120)