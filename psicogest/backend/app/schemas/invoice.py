"""Pydantic schemas for invoice endpoints."""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class InvoiceCreate(BaseModel):
    patient_id: uuid.UUID
    session_ids: list[uuid.UUID] = Field(..., min_length=1)


class InvoiceUpdate(BaseModel):
    notes: str | None = None


class InvoiceSummary(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    invoice_number: str
    patient_id: uuid.UUID
    status: str
    issue_date: datetime | None
    due_date: datetime | None
    subtotal_cop: int
    tax_cop: int
    total_cop: int
    created_at: datetime


class InvoiceDetail(InvoiceSummary):
    session_ids: list[str]
    notes: str | None
    paid_at: datetime | None
    pdf_file_path: str | None


class InvoiceListResponse(BaseModel):
    items: list[InvoiceSummary]
    total: int