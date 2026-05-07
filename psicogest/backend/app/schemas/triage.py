"""Pydantic schemas for WhatsApp triage webhook and API responses."""
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class TriageResponse(BaseModel):
    """One PHQ-9 item response from the WhatsApp conversation."""
    item: int  # 1–9
    question: str
    score: int  # 0–3


class TriageWebhookPayload(BaseModel):
    """Payload sent by n8n after completing a triage conversation."""
    tenant_id: str
    patient_name: str
    patient_phone: str
    whatsapp_message_id: str | None = None
    responses: list[TriageResponse] = []
    summary: str | None = None
    phq9_score: int | None = None
    phq9_item9_score: int | None = None


class TriageSessionOut(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    tenant_id: UUID
    patient_name: str
    patient_phone: str
    status: str
    urgency_level: str | None
    phq9_score: int | None
    phq9_item9_score: int | None
    summary: str | None
    responses: list[Any]
    booking_request_id: UUID | None
    created_at: datetime
    completed_at: datetime | None


class TriageListResponse(BaseModel):
    items: list[TriageSessionOut]
    total: int
