"""Pydantic schemas for CashTransaction endpoints."""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class CashTransactionCreate(BaseModel):
    type: str
    amount: int = Field(..., gt=0)
    category: str
    description: str | None = None
    invoice_id: uuid.UUID | None = None
    patient_id: uuid.UUID | None = None
    payment_method: str | None = None
    eps_name: str | None = None


class CashTransactionUpdate(BaseModel):
    amount: int | None = Field(None, gt=0)
    category: str | None = None
    description: str | None = None
    payment_method: str | None = None
    eps_name: str | None = None


class CashTransactionSummary(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    tenant_id: uuid.UUID
    session_id: uuid.UUID | None
    type: str
    amount: int
    category: str
    description: str | None
    invoice_id: uuid.UUID | None
    patient_id: uuid.UUID | None
    payment_method: str | None
    eps_name: str | None
    created_at: datetime
    updated_at: datetime
    created_by: uuid.UUID


class CashTransactionListResponse(BaseModel):
    items: list[CashTransactionSummary]
    total: int


class CarteraInvoicePaymentCreate(BaseModel):
    amount: int = Field(..., gt=0)
    description: str = "Abono a factura"


class PatientCarteraSummary(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    patient_name: str
    payer_type: str
    eps_name: str | None
    total_billed: int
    total_paid: int
    balance: int
    total_pending: int
    last_activity: datetime | None
    invoices_count: int
    invoice_ids: list[uuid.UUID]


class CarteraListResponse(BaseModel):
    items: list[PatientCarteraSummary]
    total: int


class CarteraSummaryResponse(BaseModel):
    total_particular: int
    total_eps: int
    grand_total: int
