"""Pydantic schemas for referral endpoints."""
import uuid
from datetime import datetime

from pydantic import BaseModel


class ReferralCreate(BaseModel):
    referred_to_name: str
    referred_to_specialty: str
    referred_to_institution: str | None = None
    reason: str
    priority: str = "programado"
    notes: str | None = None
    session_id: uuid.UUID | None = None


class ReferralUpdate(BaseModel):
    referred_to_name: str | None = None
    referred_to_specialty: str | None = None
    referred_to_institution: str | None = None
    reason: str | None = None
    priority: str | None = None
    notes: str | None = None


class ReferralDetail(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    patient_id: uuid.UUID
    session_id: uuid.UUID | None
    referred_to_name: str
    referred_to_specialty: str
    referred_to_institution: str | None
    reason: str
    priority: str
    notes: str | None
    created_at: datetime
    updated_at: datetime
