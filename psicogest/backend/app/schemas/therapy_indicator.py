"""Pydantic schemas for therapy indicators and measurements."""
import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class TherapyIndicatorCreate(BaseModel):
    name: str
    description: str | None = None
    unit: str | None = None
    initial_value: Decimal | None = None
    target_value: Decimal | None = None


class TherapyIndicatorUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    unit: str | None = None
    initial_value: Decimal | None = None
    target_value: Decimal | None = None
    is_active: bool | None = None


class TherapyIndicatorDetail(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    patient_id: uuid.UUID
    name: str
    description: str | None
    unit: str | None
    initial_value: Decimal | None
    target_value: Decimal | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class TherapyMeasurementCreate(BaseModel):
    value: Decimal
    notes: str | None = None
    session_id: uuid.UUID | None = None
    measured_at: datetime


class TherapyMeasurementDetail(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    indicator_id: uuid.UUID
    session_id: uuid.UUID | None
    value: Decimal
    notes: str | None
    measured_at: datetime
    created_at: datetime


class TherapyIndicatorWithMeasurements(TherapyIndicatorDetail):
    measurements: list[TherapyMeasurementDetail] = []
