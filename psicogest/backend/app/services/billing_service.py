"""Stripe integration — checkout sessions, portal, and webhook event handling."""
from datetime import datetime, timezone, timedelta

import stripe
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings


def _init_stripe() -> None:
    stripe.api_key = settings.stripe_secret_key


PRICE_MAP = {
    "estandar": lambda: settings.stripe_price_id_estandar,
    "premium": lambda: settings.stripe_price_id_premium,
}


def get_or_create_stripe_customer(db: Session, tenant_id: str, email: str) -> str:
    """Return existing stripe_customer_id or create a new Stripe Customer."""
    _init_stripe()
    row = db.execute(
        text("SELECT stripe_customer_id FROM tenants WHERE id = :tid"),
        {"tid": tenant_id},
    ).fetchone()

    if row and row.stripe_customer_id:
        return row.stripe_customer_id

    customer = stripe.Customer.create(
        email=email,
        metadata={"tenant_id": tenant_id},
    )
    db.execute(
        text("UPDATE tenants SET stripe_customer_id = :cid WHERE id = :tid"),
        {"cid": customer.id, "tid": tenant_id},
    )
    db.commit()
    return customer.id


def create_checkout_session(db: Session, tenant_id: str, email: str, plan: str) -> str:
    """Create a Stripe Checkout Session and return its URL."""
    _init_stripe()
    customer_id = get_or_create_stripe_customer(db, tenant_id, email)
    price_id = PRICE_MAP[plan]()

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.app_url}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{settings.app_url}/select-plan",
        metadata={"tenant_id": tenant_id, "plan": plan},
    )
    return session.url


def create_portal_session(db: Session, tenant_id: str) -> str:
    """Create a Stripe Customer Portal session and return its URL."""
    _init_stripe()
    row = db.execute(
        text("SELECT stripe_customer_id FROM tenants WHERE id = :tid"),
        {"tid": tenant_id},
    ).fetchone()
    if not row or not row.stripe_customer_id:
        raise ValueError("No Stripe customer found for tenant")

    portal = stripe.billing_portal.Session.create(
        customer=row.stripe_customer_id,
        return_url=f"{settings.app_url}/settings?tab=plan",
    )
    return portal.url


def handle_checkout_completed(db: Session, event_data: dict) -> None:
    """checkout.session.completed → activate plan, store subscription_id."""
    obj = event_data["object"]
    tenant_id = obj.get("metadata", {}).get("tenant_id")
    plan = obj.get("metadata", {}).get("plan", "estandar")
    if plan not in {"estandar", "premium"}:
        plan = "estandar"
    subscription_id = obj.get("subscription")
    if not tenant_id or not subscription_id:
        return

    db.execute(
        text("""
            UPDATE tenants
            SET plan = :plan,
                stripe_subscription_id = :sub_id,
                subscription_status = 'active',
                plan_expires_at = NOW() + INTERVAL '1 month'
            WHERE id = :tid
        """),
        {"plan": plan, "sub_id": subscription_id, "tid": tenant_id},
    )
    db.commit()


def handle_invoice_payment_succeeded(db: Session, event_data: dict) -> None:
    """invoice.payment_succeeded → renew plan_expires_at, ensure status=active."""
    obj = event_data["object"]
    customer_id = obj.get("customer")
    if not customer_id:
        return

    db.execute(
        text("""
            UPDATE tenants
            SET plan_expires_at = NOW() + INTERVAL '1 month',
                subscription_status = 'active'
            WHERE stripe_customer_id = :cid
        """),
        {"cid": customer_id},
    )
    db.commit()


def handle_invoice_payment_failed(db: Session, event_data: dict) -> None:
    """invoice.payment_failed → mark past_due."""
    obj = event_data["object"]
    customer_id = obj.get("customer")
    if not customer_id:
        return

    db.execute(
        text("UPDATE tenants SET subscription_status = 'past_due' WHERE stripe_customer_id = :cid"),
        {"cid": customer_id},
    )
    db.commit()


def handle_subscription_deleted(db: Session, event_data: dict) -> None:
    """customer.subscription.deleted → revert to free_trial, mark canceled."""
    obj = event_data["object"]
    customer_id = obj.get("customer")
    if not customer_id:
        return

    db.execute(
        text("""
            UPDATE tenants
            SET plan = 'free_trial',
                subscription_status = 'canceled',
                stripe_subscription_id = NULL
            WHERE stripe_customer_id = :cid
        """),
        {"cid": customer_id},
    )
    db.commit()


def activate_from_checkout_session_public(db: Session, session_id: str) -> dict:
    """Activate plan from a Stripe Checkout Session — no JWT required.

    Security: tenant_id is read from Stripe-signed session metadata, not from
    client input. The session_id is an unguessable Stripe token.
    """
    _init_stripe()
    session = stripe.checkout.Session.retrieve(session_id)

    if session.get("payment_status") != "paid":
        raise ValueError("La sesión de pago no está completada")

    tenant_id = session.get("metadata", {}).get("tenant_id")
    if not tenant_id:
        raise ValueError("Metadata de tenant no encontrada en la sesión")

    plan = session.get("metadata", {}).get("plan", "estandar")
    if plan not in {"estandar", "premium"}:
        plan = "estandar"

    subscription_id = session.get("subscription")
    if not subscription_id:
        raise ValueError("No hay suscripción en la sesión")

    db.execute(
        text("""
            UPDATE tenants
            SET plan = :plan,
                stripe_subscription_id = :sub_id,
                subscription_status = 'active',
                plan_expires_at = NOW() + INTERVAL '1 month'
            WHERE id = :tid
        """),
        {"plan": plan, "sub_id": subscription_id, "tid": tenant_id},
    )
    db.commit()
    return {"plan": plan, "activated": True}


def activate_from_checkout_session(db: Session, tenant_id: str, session_id: str) -> dict:
    """Retrieve a completed Checkout Session from Stripe and activate the plan in DB.

    Called by BillingSuccessPage immediately after redirect so the plan is
    activated even when the webhook hasn't arrived yet.
    """
    _init_stripe()
    session = stripe.checkout.Session.retrieve(session_id)

    if session.get("payment_status") != "paid":
        raise ValueError("La sesión de pago no está completada")

    session_tenant = session.get("metadata", {}).get("tenant_id")
    if session_tenant != str(tenant_id):
        raise ValueError("Session no pertenece a este tenant")

    plan = session.get("metadata", {}).get("plan", "estandar")
    if plan not in {"estandar", "premium"}:
        plan = "estandar"

    subscription_id = session.get("subscription")
    if not subscription_id:
        raise ValueError("No hay suscripción en la sesión")

    db.execute(
        text("""
            UPDATE tenants
            SET plan = :plan,
                stripe_subscription_id = :sub_id,
                subscription_status = 'active',
                plan_expires_at = NOW() + INTERVAL '1 month'
            WHERE id = :tid
        """),
        {"plan": plan, "sub_id": subscription_id, "tid": tenant_id},
    )
    db.commit()
    return {"plan": plan, "activated": True}


def sync_from_stripe(db: Session, tenant_id: str) -> dict:
    """Fetch the tenant's active Stripe subscription and sync plan/status/expiry to DB.

    Use when the DB plan is out of sync with Stripe (e.g. webhook delivery failure).
    """
    _init_stripe()

    row = db.execute(
        text("SELECT stripe_subscription_id FROM tenants WHERE id = :tid"),
        {"tid": tenant_id},
    ).fetchone()

    if not row or not row.stripe_subscription_id:
        raise ValueError("No hay suscripción activa de Stripe para sincronizar")

    subscription = stripe.Subscription.retrieve(
        row.stripe_subscription_id,
        expand=["items.data.price"],
    )

    price_id = subscription["items"]["data"][0]["price"]["id"]

    if price_id == settings.stripe_price_id_premium:
        plan = "premium"
    elif price_id == settings.stripe_price_id_estandar:
        plan = "estandar"
    else:
        raise ValueError(f"Price ID desconocido en Stripe: {price_id}")

    period_end: int = subscription["current_period_end"]

    db.execute(
        text("""
            UPDATE tenants
            SET plan = :plan,
                subscription_status = 'active',
                plan_expires_at = to_timestamp(:period_end)
            WHERE id = :tid
        """),
        {"plan": plan, "period_end": period_end, "tid": tenant_id},
    )
    db.commit()

    return {"plan": plan, "synced": True}
