"""Pydantic schemas for billing endpoints."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class CheckoutSessionRequest(BaseModel):
    plan: Literal["estandar", "premium"]


class CheckoutSessionResponse(BaseModel):
    checkout_url: str


class CustomerPortalResponse(BaseModel):
    portal_url: str


class BillingStatusResponse(BaseModel):
    plan: Literal["free_trial", "estandar", "premium"]
    subscription_status: str
    plan_expires_at: datetime
    days_remaining: int
    in_grace_period: bool
