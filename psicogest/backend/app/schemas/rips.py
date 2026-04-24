"""Pydantic schemas for RIPS export endpoints."""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class RipsGenerateRequest(BaseModel):
    year: int = Field(..., ge=2020, le=2030)
    month: int = Field(..., ge=1, le=12)


class RipsValidateRequest(BaseModel):
    year: int = Field(..., ge=2020, le=2030)
    month: int = Field(..., ge=1, le=12)


class RipsErrorItem(BaseModel):
    session_id: str | None = None
    field: str
    value: str | None = None
    message: str


class RipsWarningItem(BaseModel):
    session_id: str | None = None
    field: str
    value: str | None = None
    message: str


class RipsValidateResponse(BaseModel):
    valid: bool
    errors: list[RipsErrorItem]
    warnings: list[RipsWarningItem]
    sessions_count: int


class RipsExportSummary(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    period_year: int
    period_month: int
    status: str
    sessions_count: int
    total_value_cop: int
    file_hash: str | None
    generated_at: datetime | None


class RipsGenerationResponse(BaseModel):
    export: RipsExportSummary
    message: str