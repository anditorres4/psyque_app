"""Pydantic schemas for therapeutic goals."""
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class TherapeuticGoalCreate(BaseModel):
    patient_id: uuid.UUID
    goal_text: str = Field(..., min_length=5, max_length=500)


class TherapeuticGoalUpdate(BaseModel):
    status: Literal["active", "achieved", "abandoned"]


class TherapeuticGoalOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    patient_id: uuid.UUID
    goal_text: str
    status: str
    created_at: datetime
    updated_at: datetime
