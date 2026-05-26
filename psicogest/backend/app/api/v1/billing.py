"""Billing router — Stripe Checkout, status, portal, and webhook."""
import logging
from datetime import datetime, timezone, timedelta
from typing import Annotated

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import TenantDB, get_tenant_db
from app.schemas.billing import (
    BillingStatusResponse,
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    CustomerPortalResponse,
)
from app.services import billing_service

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/status", response_model=BillingStatusResponse)
def get_billing_status(ctx: Annotated[TenantDB, Depends(get_tenant_db)]) -> BillingStatusResponse:
    """Return current plan, subscription status, expiry, and computed day counts."""
    row = ctx.db.execute(
        text("""
            SELECT plan, subscription_status, plan_expires_at
            FROM tenants WHERE id = :tid
        """),
        {"tid": ctx.tenant.tenant_id},
    ).fetchone()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tenant no encontrado")

    now = datetime.now(timezone.utc)
    delta = row.plan_expires_at - now
    days_remaining = max(0, delta.days)
    in_grace_period = (now > row.plan_expires_at) and (
        now <= row.plan_expires_at + timedelta(days=3)
    )

    return BillingStatusResponse(
        plan=row.plan,
        subscription_status=row.subscription_status,
        plan_expires_at=row.plan_expires_at,
        days_remaining=days_remaining,
        in_grace_period=in_grace_period,
    )


@router.post("/create-checkout-session", response_model=CheckoutSessionResponse)
def create_checkout_session(
    body: CheckoutSessionRequest,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> CheckoutSessionResponse:
    """Create a Stripe Checkout Session for the given plan. Returns checkout_url."""
    # Use a deterministic email placeholder derived from user_id
    email = f"{ctx.tenant.user_id}@psycent.local"

    try:
        url = billing_service.create_checkout_session(
            db=ctx.db,
            tenant_id=ctx.tenant.tenant_id,
            email=email,
            plan=body.plan,
        )
    except Exception as exc:
        logger.exception("create_checkout_session failed for tenant %s", ctx.tenant.tenant_id)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Error al crear sesión de pago. Intenta nuevamente.")

    return CheckoutSessionResponse(checkout_url=url)


@router.post("/customer-portal", response_model=CustomerPortalResponse)
def create_customer_portal(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> CustomerPortalResponse:
    """Create a Stripe Customer Portal session. Returns portal_url."""
    try:
        url = billing_service.create_portal_session(
            db=ctx.db,
            tenant_id=ctx.tenant.tenant_id,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    except Exception as exc:
        logger.exception("create_portal_session failed for tenant %s", ctx.tenant.tenant_id)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Error al crear portal de pago. Intenta nuevamente.")

    return CustomerPortalResponse(portal_url=url)


@router.post("/webhook", status_code=200)
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
    stripe_signature: str = Header(alias="stripe-signature", default=""),
) -> dict:
    """Stripe webhook — no JWT auth, verified by Stripe-Signature header."""
    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, settings.stripe_webhook_secret
        )
    except (stripe.error.SignatureVerificationError, ValueError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid Stripe signature")

    event_type = event["type"]
    event_data = event["data"]

    logger.info("Processing Stripe event: %s", event_type)
    try:
        if event_type == "checkout.session.completed":
            billing_service.handle_checkout_completed(db, event_data)
        elif event_type == "invoice.payment_succeeded":
            billing_service.handle_invoice_payment_succeeded(db, event_data)
        elif event_type == "invoice.payment_failed":
            billing_service.handle_invoice_payment_failed(db, event_data)
        elif event_type == "customer.subscription.deleted":
            billing_service.handle_subscription_deleted(db, event_data)
    except Exception:
        logger.exception("Error processing Stripe event %s", event_type)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Error procesando evento de pago")

    return {"received": True}


@router.post("/activate-from-session")
def activate_from_session(
    session_id: str,
    db: Session = Depends(get_db),
) -> dict:
    """Activate plan from a completed Stripe Checkout Session — no JWT required.

    tenant_id is read from Stripe-signed session metadata, not from client input.
    Called by BillingSuccessPage immediately after Stripe redirect so activation
    is independent of both webhook timing and Supabase session rehydration.
    """
    try:
        return billing_service.activate_from_checkout_session_public(
            db=db,
            session_id=session_id,
        )
    except Exception as exc:
        logger.exception("activate_from_session failed for session_id %s", session_id)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Error al activar el plan. Intenta nuevamente.")


@router.post("/sync-from-stripe")
def sync_from_stripe_endpoint(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> dict:
    """Force-sync the DB plan from Stripe — use when plan is out of sync after webhook failure."""
    try:
        return billing_service.sync_from_stripe(
            db=ctx.db,
            tenant_id=ctx.tenant.tenant_id,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    except Exception as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Error al consultar Stripe: {exc}")
