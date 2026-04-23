"""Pydantic schemas for availability blocks."""
import uuid
from datetime import time

from pydantic import BaseModel, Field, field_validator


class AvailabilityBlockRead(BaseModel):
    id: uuid.UUID
    day_of_week: int
    start_time: str
    end_time: str
    is_active: bool

    model_config = {"from_attributes": True}

    @field_validator("start_time", "end_time", mode="before")
    @classmethod
    def time_to_str(cls, v: object) -> str:
        if isinstance(v, time):
            return v.strftime("%H:%M:%S")
        return str(v)


class AvailabilityBlockCreate(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: str = Field(..., pattern=r"^\d{2}:\d{2}(:\d{2})?$")
    end_time: str = Field(..., pattern=r"^\d{2}:\d{2}(:\d{2})?$")