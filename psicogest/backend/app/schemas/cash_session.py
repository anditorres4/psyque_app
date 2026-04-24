"""Pydantic schemas for CashSession endpoints."""
import uuid
from datetime import datetime

from pydantic import BaseModel


class CashSessionCreate(BaseModel):
    pass


class CashSessionClose(BaseModel):
    notes: str | None = None


class CashSessionSummary(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    opened_at: datetime
    closed_at: datetime | None
    status: str
    notes: str | None


class CashSessionDetail(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    opened_at: datetime
    closed_at: datetime | None
    status: str
    notes: str | None
    total_income: int = 0
    total_expense: int = 0
    net: int = 0


class CashSessionListResponse(BaseModel):
    items: list[CashSessionSummary]
    total: int