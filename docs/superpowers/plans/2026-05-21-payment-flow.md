# Payment Flow & Subscriptions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full monetization flow for PsyCent: differentiated therapist/patient auth, 14-day free trial, Stripe Checkout subscription, plan-based feature gating, and subscription lifecycle management.

**Architecture:** Backend-first: Alembic migration renames the plan enum and adds Stripe tracking columns, then new billing routes handle Stripe Checkout/Portal/Webhooks, while FastAPI dependencies enforce subscription and plan requirements on existing routers. Frontend adds differentiated login/register pages, a post-registration plan selection screen, a paywall, and a billing settings tab. `require_active_subscription` is applied as a router-level dependency in `main.py` to all therapist routers without touching individual route files.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 + Alembic (backend), React 18 + Vite + TypeScript + shadcn/ui + React Query (frontend), `stripe>=7.0.0` Python SDK + Stripe Checkout hosted + Stripe Billing webhooks, Supabase Auth.

---

## File Map

### Backend — create
- `psicogest/backend/app/schemas/billing.py` — Pydantic schemas for billing endpoints
- `psicogest/backend/app/services/billing_service.py` — Stripe logic (checkout, portal, webhook handlers)
- `psicogest/backend/app/api/v1/billing.py` — Billing router (4 endpoints + webhook)
- `psicogest/backend/alembic/versions/XXXX_billing_stripe_columns.py` — Migration

### Backend — modify
- `psicogest/backend/requirements.txt` — add `stripe>=7.0.0`
- `psicogest/backend/app/core/config.py` — add 5 Stripe env vars
- `psicogest/backend/app/models/tenant.py` — update enum + add 3 Stripe columns
- `psicogest/backend/app/api/v1/auth_routes.py` — update plan/days in setup_profile, add setup-patient-profile endpoint
- `psicogest/backend/app/core/deps.py` — add `require_active_subscription`, `require_plan`
- `psicogest/backend/app/main.py` — register billing router + apply subscription dependencies
- `psicogest/backend/app/api/v1/ai.py` — add `require_plan("premium")` to feature POST routes

### Backend — tests
- `psicogest/backend/tests/test_billing_deps.py` — unit tests for the two new deps

### Frontend — create
- `psicogest/frontend/src/services/billing.ts` — typed billing API calls + types
- `psicogest/frontend/src/hooks/useBillingStatus.ts` — React Query hook (5-min stale)
- `psicogest/frontend/src/hooks/useUpgradePrompt.ts` — intercepts 403 errors from React Query
- `psicogest/frontend/src/components/billing/UpgradePromptDialog.tsx` — modal for 403 upgrade CTA
- `psicogest/frontend/src/components/layout/SubscriptionBanner.tsx` — amber banner when ≤3 days left
- `psicogest/frontend/src/pages/auth/TerapeutaLoginPage.tsx` — therapist login
- `psicogest/frontend/src/pages/auth/PacienteLoginPage.tsx` — patient login
- `psicogest/frontend/src/pages/auth/PacienteRegisterPage.tsx` — free patient registration
- `psicogest/frontend/src/pages/billing/PlanSelectPage.tsx` — 3-card post-registration pricing
- `psicogest/frontend/src/pages/billing/BillingSuccessPage.tsx` — Stripe return page
- `psicogest/frontend/src/pages/billing/PaywallPage.tsx` — full-page block when expired

### Frontend — modify
- `psicogest/frontend/src/lib/api.ts` — add `billing` namespace to the api object
- `psicogest/frontend/src/hooks/useAuth.ts` — add patient branch for setup-patient-profile
- `psicogest/frontend/src/pages/auth/LoginPage.tsx` — become a redirect to `/login/terapeuta`
- `psicogest/frontend/src/pages/auth/RegisterPage.tsx` — "14 días" copy + navigate to `/select-plan`
- `psicogest/frontend/src/pages/auth/CompleteProfilePage.tsx` — navigate to `/select-plan`
- `psicogest/frontend/src/pages/settings/SettingsPage.tsx` — add "Plan y facturación" tab
- `psicogest/frontend/src/components/layout/AppLayout.tsx` — render `SubscriptionBanner`
- `psicogest/frontend/src/App.tsx` — new routes + subscription check in ProtectedRoute
- `psicogest/frontend/public/landing.html` — update login button href

---

## Task 1: Alembic migration — enum rename + Stripe columns

**Files:**
- Create: `psicogest/backend/alembic/versions/XXXX_billing_stripe_columns.py`

- [ ] **Step 1: Create the migration file**

```bash
cd psicogest/backend && source .venv/bin/activate
alembic revision -m "billing_stripe_columns"
```

Note the generated filename (e.g. `abc123_billing_stripe_columns.py`). Open it and replace its contents with:

```python
"""billing_stripe_columns

Revision ID: <generated>
Revises: <previous>
Create Date: 2026-05-21
"""
from alembic import op
import sqlalchemy as sa

revision = "<generated>"
down_revision = "<previous>"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rename enum values
    op.execute("ALTER TYPE saas_plan RENAME VALUE 'starter' TO 'free_trial'")
    op.execute("ALTER TYPE saas_plan RENAME VALUE 'pro' TO 'estandar'")
    op.execute("ALTER TYPE saas_plan RENAME VALUE 'clinic' TO 'premium'")

    # Add Stripe tracking columns
    op.add_column("tenants", sa.Column("stripe_customer_id", sa.String(50), nullable=True))
    op.add_column("tenants", sa.Column("stripe_subscription_id", sa.String(50), nullable=True))
    op.add_column(
        "tenants",
        sa.Column(
            "subscription_status",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'trial'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("tenants", "subscription_status")
    op.drop_column("tenants", "stripe_subscription_id")
    op.drop_column("tenants", "stripe_customer_id")
    op.execute("ALTER TYPE saas_plan RENAME VALUE 'free_trial' TO 'starter'")
    op.execute("ALTER TYPE saas_plan RENAME VALUE 'estandar' TO 'pro'")
    op.execute("ALTER TYPE saas_plan RENAME VALUE 'premium' TO 'clinic'")
```

- [ ] **Step 2: Run the migration**

```bash
alembic upgrade head
```

Expected: `Running upgrade <prev> -> <new>, billing_stripe_columns`

- [ ] **Step 3: Verify columns exist**

```bash
python -c "
from app.core.database import engine
from sqlalchemy import text, inspect
insp = inspect(engine)
cols = {c['name'] for c in insp.get_columns('tenants')}
assert 'stripe_customer_id' in cols, 'Missing stripe_customer_id'
assert 'subscription_status' in cols, 'Missing subscription_status'
print('OK')
"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add alembic/versions/
git commit -m "feat(db): billing_stripe_columns migration — rename plan enum + add Stripe columns"
```

---

## Task 2: Update tenant.py model + add stripe to requirements.txt

**Files:**
- Modify: `psicogest/backend/app/models/tenant.py`
- Modify: `psicogest/backend/requirements.txt`

- [ ] **Step 1: Add stripe to requirements.txt**

Open `psicogest/backend/requirements.txt` and add `stripe>=7.0.0` on a new line.

- [ ] **Step 2: Install stripe**

```bash
cd psicogest/backend && pip install stripe>=7.0.0
```

Expected: Successfully installed stripe-X.X.X

- [ ] **Step 3: Update the plan enum + add new columns in tenant.py**

In `psicogest/backend/app/models/tenant.py`, replace the plan column and add new columns.

Find:
```python
    plan: Mapped[str] = mapped_column(
        sa.Enum("starter", "pro", "clinic", name="saas_plan"),
        nullable=False,
        default="starter",
    )
    plan_expires_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False
    )
```

Replace with:
```python
    plan: Mapped[str] = mapped_column(
        sa.Enum("free_trial", "estandar", "premium", name="saas_plan"),
        nullable=False,
        default="free_trial",
    )
    plan_expires_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False
    )
    stripe_customer_id: Mapped[str | None] = mapped_column(sa.String(50), nullable=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(sa.String(50), nullable=True)
    subscription_status: Mapped[str] = mapped_column(
        sa.String(20), nullable=False, server_default=sa.text("'trial'")
    )
```

- [ ] **Step 4: Verify the app still loads**

```bash
cd psicogest/backend && python -c "from app.models.tenant import Tenant; print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add app/models/tenant.py requirements.txt
git commit -m "feat(model): update saas_plan enum + add Stripe/subscription columns to Tenant"
```

---

## Task 3: Add Stripe config vars

**Files:**
- Modify: `psicogest/backend/app/core/config.py`

- [ ] **Step 1: Add Stripe settings to config.py**

In `psicogest/backend/app/core/config.py`, add after the `webhook_triage_secret` line:

```python
    # --- Stripe ---
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_id_estandar: str = ""
    stripe_price_id_premium: str = ""
```

- [ ] **Step 2: Add placeholder vars to .env**

Open `psicogest/backend/.env` and add (do NOT commit this file):

```
STRIPE_SECRET_KEY=sk_test_placeholder
STRIPE_WEBHOOK_SECRET=whsec_placeholder
STRIPE_PRICE_ID_ESTANDAR=price_placeholder_estandar
STRIPE_PRICE_ID_PREMIUM=price_placeholder_premium
```

- [ ] **Step 3: Verify settings load**

```bash
python -c "from app.core.config import settings; print(settings.stripe_secret_key[:7])"
```

Expected: `sk_test`

- [ ] **Step 4: Commit**

```bash
git add app/core/config.py
git commit -m "feat(config): add Stripe environment variables"
```

---

## Task 4: Update auth_routes.py — 14-day free_trial + setup-patient-profile

**Files:**
- Modify: `psicogest/backend/app/api/v1/auth_routes.py`

- [ ] **Step 1: Update the INSERT in setup_profile**

In `psicogest/backend/app/api/v1/auth_routes.py`, find the INSERT block and replace it:

Find:
```python
        tenant_id = str(uuid.uuid4())
        try:
            db.execute(
                text("""
                    INSERT INTO tenants (
                        id, auth_user_id, full_name, colpsic_number, reps_code,
                        plan, plan_expires_at, city, nit
                    ) VALUES (
                        :id, :uid, :name, :colpsic, :reps,
                        'starter', NOW() + INTERVAL '30 days', :city, :nit
                    )
                """),
```

Replace with:
```python
        tenant_id = str(uuid.uuid4())
        try:
            db.execute(
                text("""
                    INSERT INTO tenants (
                        id, auth_user_id, full_name, colpsic_number, reps_code,
                        plan, plan_expires_at, city, nit, subscription_status
                    ) VALUES (
                        :id, :uid, :name, :colpsic, :reps,
                        'free_trial', NOW() + INTERVAL '14 days', :city, :nit, 'trial'
                    )
                """),
```

- [ ] **Step 2: Add setup-patient-profile endpoint**

At the end of `auth_routes.py`, after the `setup_profile` function, add:

```python
@router.post("/auth/setup-patient-profile", status_code=200)
def setup_patient_profile(
    user: Annotated[AuthUser, Depends(get_auth_user)],
) -> dict:
    """Set app_metadata.role = 'patient' for a newly registered patient.

    Does NOT create a tenants row — patients are linked to a psychologist's
    tenant via patient records, not via the tenants table.
    """
    supabase_admin_url = (
        f"{settings.supabase_url}/auth/v1/admin/users/{user.user_id}"
    )
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.put(
                supabase_admin_url,
                headers={
                    "Authorization": f"Bearer {settings.supabase_service_key}",
                    "apikey": settings.supabase_service_key,
                },
                json={"app_metadata": {"role": "patient"}},
            )
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"No se pudo configurar el perfil de paciente: {exc}",
        )
    return {"role": "patient", "status": "configured"}
```

- [ ] **Step 3: Restart the backend and verify both endpoints appear**

```bash
uvicorn app.main:app --reload
# In another terminal:
curl http://localhost:8000/docs | grep -o 'setup-[a-z-]*'
```

Expected output includes: `setup-profile`, `setup-patient-profile`

- [ ] **Step 4: Commit**

```bash
git add app/api/v1/auth_routes.py
git commit -m "feat(auth): setup_profile → free_trial 14 days + add setup-patient-profile endpoint"
```

---

## Task 5: Create billing schemas

**Files:**
- Create: `psicogest/backend/app/schemas/billing.py`

- [ ] **Step 1: Create the schemas file**

```python
# psicogest/backend/app/schemas/billing.py
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
    plan: str
    subscription_status: str
    plan_expires_at: datetime
    days_remaining: int
    in_grace_period: bool
```

- [ ] **Step 2: Verify import**

```bash
python -c "from app.schemas.billing import BillingStatusResponse; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add app/schemas/billing.py
git commit -m "feat(billing): add Pydantic schemas for billing endpoints"
```

---

## Task 6: Create billing_service.py

**Files:**
- Create: `psicogest/backend/app/services/billing_service.py`

- [ ] **Step 1: Create the service file**

```python
# psicogest/backend/app/services/billing_service.py
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
```

- [ ] **Step 2: Verify import**

```bash
python -c "from app.services.billing_service import create_checkout_session; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add app/services/billing_service.py
git commit -m "feat(billing): create billing_service with Stripe checkout, portal and webhook handlers"
```

---

## Task 7: Create billing.py router

**Files:**
- Create: `psicogest/backend/app/api/v1/billing.py`

- [ ] **Step 1: Create the router file**

```python
# psicogest/backend/app/api/v1/billing.py
"""Billing router — Stripe Checkout, status, portal, and webhook."""
from datetime import datetime, timezone, timedelta
from typing import Annotated

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.orm import Session

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
    row = ctx.db.execute(
        text("SELECT full_name FROM tenants WHERE id = :tid"),
        {"tid": ctx.tenant.tenant_id},
    ).fetchone()
    # Use auth user email from JWT claim — supabase puts it in the token
    # The TenantContext only carries tenant_id; get the email via a second admin call
    # For simplicity, use a placeholder email derivable from user_id
    # In production, store email in tenants or pass from frontend body
    email = f"{ctx.tenant.user_id}@psycent.local"

    try:
        url = billing_service.create_checkout_session(
            db=ctx.db,
            tenant_id=ctx.tenant.tenant_id,
            email=email,
            plan=body.plan,
        )
    except Exception as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Error al crear sesión de pago: {exc}")

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
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Error al crear portal: {exc}")

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
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid Stripe signature")

    event_type = event["type"]
    event_data = event["data"]

    if event_type == "checkout.session.completed":
        billing_service.handle_checkout_completed(db, event_data)
    elif event_type == "invoice.payment_succeeded":
        billing_service.handle_invoice_payment_succeeded(db, event_data)
    elif event_type == "invoice.payment_failed":
        billing_service.handle_invoice_payment_failed(db, event_data)
    elif event_type == "customer.subscription.deleted":
        billing_service.handle_subscription_deleted(db, event_data)

    return {"received": True}
```

- [ ] **Step 2: Verify import**

```bash
python -c "from app.api.v1.billing import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add app/api/v1/billing.py
git commit -m "feat(billing): add billing router (status, checkout, portal, webhook)"
```

---

## Task 8: Register billing router + apply subscription guards in main.py

**Files:**
- Modify: `psicogest/backend/app/main.py`

- [ ] **Step 1: Add billing import and subscription dependency import**

In `psicogest/backend/app/main.py`, add these imports after the existing router imports:

```python
from app.api.v1.billing import router as billing_router
from app.core.deps import require_active_subscription, require_plan
```

- [ ] **Step 2: Register the billing router**

After `app.include_router(auth_router, prefix="/api/v1")`, add:

```python
app.include_router(billing_router, prefix="/api/v1")
```

- [ ] **Step 3: Apply require_active_subscription to all therapist routers**

Replace the existing `app.include_router(...)` calls for all therapist routers with versions that include the dependency. Only routers that require a valid tenant (not public/portal) get this guard. Replace the block of `app.include_router` calls (from patients_router to notifications_router) with:

```python
_sub = [Depends(require_active_subscription)]

app.include_router(patients_router, prefix="/api/v1", dependencies=_sub)
app.include_router(appointments_router, prefix="/api/v1", dependencies=_sub)
app.include_router(sessions_router, prefix="/api/v1", dependencies=_sub)
app.include_router(dashboard_router, prefix="/api/v1", dependencies=_sub)
app.include_router(profile_router, prefix="/api/v1", dependencies=_sub)
app.include_router(availability_router, prefix="/api/v1", dependencies=_sub)
app.include_router(documents_router, prefix="/api/v1", dependencies=_sub)
app.include_router(reports_router, prefix="/api/v1", dependencies=_sub)
app.include_router(caja_router, prefix="/api/v1", dependencies=_sub)
app.include_router(cartera_router, prefix="/api/v1", dependencies=_sub)
app.include_router(indicators_router, prefix="/api/v1", dependencies=_sub)
app.include_router(referrals_router, prefix="/api/v1", dependencies=_sub)
app.include_router(gcal_router, prefix="/api/v1", dependencies=_sub)
app.include_router(video_router, prefix="/api/v1", dependencies=_sub)
app.include_router(nps_router, prefix="/api/v1", dependencies=_sub)
app.include_router(notifications_router, prefix="/api/v1", dependencies=_sub)
app.include_router(therapeutic_goals_router, prefix="/api/v1", dependencies=_sub)
app.include_router(patient_tasks_router, prefix="/api/v1", dependencies=_sub)

# Premium-only routers (require_active_subscription + require_plan)
_premium = [Depends(require_active_subscription), Depends(require_plan("premium"))]
app.include_router(rips_router, prefix="/api/v1", dependencies=_premium)
app.include_router(invoices_router, prefix="/api/v1", dependencies=_premium)
```

Keep the following WITHOUT the subscription guard (public/portal routes):
```python
app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(billing_router, prefix="/api/v1")
app.include_router(booking_public_router, prefix="/api/v1")
app.include_router(booking_requests_router, prefix="/api/v1")
app.include_router(webhooks_router, prefix="/api/v1")
app.include_router(patient_auth_router, prefix="/api/v1")
app.include_router(portal_api_router, prefix="/api/v1")
app.include_router(portal_onboarding_router, prefix="/api/v1")
app.include_router(patient_portal_router, prefix="/api/v1")
```

- [ ] **Step 4: Apply require_plan to AI feature routes**

In `psicogest/backend/app/api/v1/ai.py`, add the import and apply to feature POST routes.

At the top of `ai.py`, add to the existing imports:
```python
from app.core.deps import require_plan
```

Then for each POST route that uses AI features (diagnosis, session summary, etc.), add `Depends(require_plan("premium"))` to the dependency list. For example, find the route `@router.post("/diagnosis-suggestion")` and update it:

```python
@router.post(
    "/diagnosis-suggestion",
    response_model=DiagnosisSuggestionResponse,
    dependencies=[Depends(require_plan("premium"))],
)
```

Apply the same pattern to: `/session-summary`, `/clinical-record-summary`, `/document-analysis`. Leave `/config`, `/config` GET/PUT without this guard.

Add the `ai_router` to main.py with `_sub` dependency (not premium):
```python
app.include_router(ai_router, prefix="/api/v1", dependencies=_sub)
```

- [ ] **Step 5: Restart and verify**

```bash
uvicorn app.main:app --reload
# Should start without import errors
```

- [ ] **Step 6: Commit**

```bash
git add app/main.py app/api/v1/ai.py
git commit -m "feat(guards): apply require_active_subscription + require_plan to therapist routers"
```

---

## Task 9: Add require_active_subscription + require_plan to deps.py

**Files:**
- Modify: `psicogest/backend/app/core/deps.py`

- [ ] **Step 1: Add the two new dependencies**

In `psicogest/backend/app/core/deps.py`, add at the top after the existing imports:

```python
from datetime import datetime, timezone, timedelta

from fastapi import HTTPException, status as http_status
from sqlalchemy import text
```

Then add after the existing `get_patient_db` / `CurrentPatientDB` definitions:

```python
def require_active_subscription(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> None:
    """Raise 402 if subscription has expired beyond the 3-day grace period."""
    row = ctx.db.execute(
        text("SELECT plan_expires_at FROM tenants WHERE id = :tid"),
        {"tid": ctx.tenant.tenant_id},
    ).fetchone()
    if row is None:
        raise HTTPException(http_status.HTTP_401_UNAUTHORIZED, "Tenant no encontrado")
    if datetime.now(timezone.utc) > row.plan_expires_at + timedelta(days=3):
        raise HTTPException(
            http_status.HTTP_402_PAYMENT_REQUIRED,
            "Suscripción vencida. Renueva tu plan en /select-plan",
        )


def require_plan(required: str):
    """Return a dependency that raises 403 if tenant plan is not free_trial or the required plan.

    free_trial always passes — tenants can evaluate all features during their trial.
    """
    def _check(ctx: Annotated[TenantDB, Depends(get_tenant_db)]) -> None:
        row = ctx.db.execute(
            text("SELECT plan FROM tenants WHERE id = :tid"),
            {"tid": ctx.tenant.tenant_id},
        ).fetchone()
        if row is None:
            raise HTTPException(http_status.HTTP_401_UNAUTHORIZED, "Tenant no encontrado")
        if row.plan not in ("free_trial", required):
            raise HTTPException(
                http_status.HTTP_403_FORBIDDEN,
                "Se requiere plan Premium para usar esta función",
            )
    return _check
```

- [ ] **Step 2: Verify import from deps**

```bash
python -c "from app.core.deps import require_active_subscription, require_plan; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add app/core/deps.py
git commit -m "feat(deps): add require_active_subscription and require_plan FastAPI dependencies"
```

---

## Task 10: Tests for billing deps

**Files:**
- Create: `psicogest/backend/tests/test_billing_deps.py`

- [ ] **Step 1: Write the failing tests**

```python
# psicogest/backend/tests/test_billing_deps.py
"""Unit tests for require_active_subscription and require_plan."""
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.core.deps import require_active_subscription, require_plan


def _mock_ctx(plan: str, expires_at: datetime) -> MagicMock:
    ctx = MagicMock()
    ctx.tenant.tenant_id = "test-tenant-id"
    row = MagicMock()
    row.plan = plan
    row.plan_expires_at = expires_at
    ctx.db.execute.return_value.fetchone.return_value = row
    return ctx


# --- require_active_subscription ---

def test_active_subscription_passes_when_valid():
    ctx = _mock_ctx("estandar", datetime.now(timezone.utc) + timedelta(days=5))
    require_active_subscription(ctx)  # must not raise


def test_active_subscription_passes_within_grace_period():
    ctx = _mock_ctx("estandar", datetime.now(timezone.utc) - timedelta(hours=12))
    require_active_subscription(ctx)  # expired but within 3-day grace — must not raise


def test_active_subscription_blocks_after_grace_period():
    ctx = _mock_ctx("estandar", datetime.now(timezone.utc) - timedelta(days=5))
    with pytest.raises(HTTPException) as exc_info:
        require_active_subscription(ctx)
    assert exc_info.value.status_code == 402


def test_active_subscription_blocks_at_exactly_grace_boundary():
    ctx = _mock_ctx("estandar", datetime.now(timezone.utc) - timedelta(days=3, seconds=1))
    with pytest.raises(HTTPException) as exc_info:
        require_active_subscription(ctx)
    assert exc_info.value.status_code == 402


# --- require_plan ---

def test_require_plan_allows_premium():
    ctx = _mock_ctx("premium", datetime.now(timezone.utc) + timedelta(days=5))
    require_plan("premium")(ctx)  # must not raise


def test_require_plan_allows_free_trial():
    ctx = _mock_ctx("free_trial", datetime.now(timezone.utc) + timedelta(days=5))
    require_plan("premium")(ctx)  # free_trial always passes — must not raise


def test_require_plan_blocks_estandar():
    ctx = _mock_ctx("estandar", datetime.now(timezone.utc) + timedelta(days=5))
    with pytest.raises(HTTPException) as exc_info:
        require_plan("premium")(ctx)
    assert exc_info.value.status_code == 403


def test_require_plan_returns_403_message():
    ctx = _mock_ctx("estandar", datetime.now(timezone.utc) + timedelta(days=5))
    with pytest.raises(HTTPException) as exc_info:
        require_plan("premium")(ctx)
    assert "Premium" in str(exc_info.value.detail)
```

- [ ] **Step 2: Run tests to verify they fail (before deps are written)**

If deps.py was done in Task 9 already, they should pass. Run:

```bash
cd psicogest/backend
pytest tests/test_billing_deps.py -v
```

Expected: all 8 tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test_billing_deps.py
git commit -m "test(billing): unit tests for require_active_subscription and require_plan"
```

---

## Task 11: Frontend billing.ts — typed API service

**Files:**
- Modify: `psicogest/frontend/src/lib/api.ts`
- Create: `psicogest/frontend/src/services/billing.ts`

- [ ] **Step 1: Create billing.ts service types and functions**

```typescript
// psicogest/frontend/src/services/billing.ts
import { request } from "@/lib/api";

export interface BillingStatus {
  plan: "free_trial" | "estandar" | "premium";
  subscription_status: "trial" | "active" | "past_due" | "canceled" | "expired";
  plan_expires_at: string;
  days_remaining: number;
  in_grace_period: boolean;
}

export interface CheckoutSessionResponse {
  checkout_url: string;
}

export interface CustomerPortalResponse {
  portal_url: string;
}

export const billingApi = {
  getStatus: () => request<BillingStatus>("GET", "/billing/status"),

  createCheckoutSession: (plan: "estandar" | "premium") =>
    request<CheckoutSessionResponse>("POST", "/billing/create-checkout-session", { plan }),

  createCustomerPortal: () =>
    request<CustomerPortalResponse>("POST", "/billing/customer-portal"),
};
```

- [ ] **Step 2: Add billing namespace to api.ts**

In `psicogest/frontend/src/lib/api.ts`, find the end of the `api` export object (before the closing `};`) and add:

```typescript
  billing: {
    getStatus: () => request<import("@/services/billing").BillingStatus>("GET", "/billing/status"),
    createCheckoutSession: (plan: "estandar" | "premium") =>
      request<import("@/services/billing").CheckoutSessionResponse>(
        "POST",
        "/billing/create-checkout-session",
        { plan }
      ),
    createCustomerPortal: () =>
      request<import("@/services/billing").CustomerPortalResponse>(
        "POST",
        "/billing/customer-portal"
      ),
  },
```

- [ ] **Step 3: Run typecheck**

```bash
cd psicogest/frontend && npm run build 2>&1 | head -20
```

Expected: No TypeScript errors related to billing.ts

- [ ] **Step 4: Commit**

```bash
git add src/services/billing.ts src/lib/api.ts
git commit -m "feat(frontend): add billing.ts service and api.billing namespace"
```

---

## Task 12: useBillingStatus hook

**Files:**
- Create: `psicogest/frontend/src/hooks/useBillingStatus.ts`

- [ ] **Step 1: Create the hook**

```typescript
// psicogest/frontend/src/hooks/useBillingStatus.ts
import { useQuery } from "@tanstack/react-query";
import { billingApi, type BillingStatus } from "@/services/billing";
import { useAuth } from "./useAuth";

export function useBillingStatus() {
  const { user, tenantReady } = useAuth();

  return useQuery<BillingStatus>({
    queryKey: ["billing-status"],
    queryFn: () => billingApi.getStatus(),
    staleTime: 5 * 60 * 1000,
    enabled: !!user && tenantReady,
  });
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run build 2>&1 | grep -i "useBilling" | head -5
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useBillingStatus.ts
git commit -m "feat(frontend): add useBillingStatus React Query hook with 5-min stale time"
```

---

## Task 13: useUpgradePrompt hook + UpgradePromptDialog component

**Files:**
- Create: `psicogest/frontend/src/hooks/useUpgradePrompt.ts`
- Create: `psicogest/frontend/src/components/billing/UpgradePromptDialog.tsx`

- [ ] **Step 1: Create the dialog component**

```tsx
// psicogest/frontend/src/components/billing/UpgradePromptDialog.tsx
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useBillingStatus } from "@/hooks/useBillingStatus";
import { billingApi } from "@/services/billing";

interface UpgradePromptDialogProps {
  open: boolean;
  onClose: () => void;
}

export function UpgradePromptDialog({ open, onClose }: UpgradePromptDialogProps) {
  const navigate = useNavigate();
  const { data: billing } = useBillingStatus();

  const handleUpgrade = async () => {
    if (billing?.subscription_status === "active") {
      const { portal_url } = await billingApi.createCustomerPortal();
      window.location.href = portal_url;
    } else {
      navigate("/select-plan");
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-[var(--psy-primary)]">
            Función exclusiva del plan Premium
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          RIPS automático, Facturación electrónica DIAN y Funciones IA están
          incluidos en el plan Premium ($90.000 COP/mes).
        </p>
        <DialogFooter className="flex gap-2 flex-row">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cerrar
          </Button>
          <Button
            onClick={handleUpgrade}
            className="flex-1 bg-[var(--psy-sage)] hover:bg-[var(--psy-sage)]/90 text-white"
          >
            Ver planes →
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create the hook**

```typescript
// psicogest/frontend/src/hooks/useUpgradePrompt.ts
import { useState } from "react";
import { ApiError } from "@/lib/api";

export function useUpgradePrompt() {
  const [open, setOpen] = useState(false);

  function handleQueryError(error: unknown) {
    if (error instanceof ApiError && error.status === 403) {
      setOpen(true);
    }
  }

  return { upgradePromptOpen: open, closeUpgradePrompt: () => setOpen(false), handleQueryError };
}
```

- [ ] **Step 3: Verify ApiError is exported from api.ts**

In `psicogest/frontend/src/lib/api.ts`, confirm there is a class or type `ApiError`. If not, add:

```typescript
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useUpgradePrompt.ts src/components/billing/UpgradePromptDialog.tsx
git commit -m "feat(frontend): add useUpgradePrompt hook and UpgradePromptDialog component"
```

---

## Task 14: Update useAuth.ts — patient branch

**Files:**
- Modify: `psicogest/frontend/src/hooks/useAuth.ts`

- [ ] **Step 1: Add patient branch to ensureTenantConfigured**

In `psicogest/frontend/src/hooks/useAuth.ts`, replace the `ensureTenantConfigured` function:

Find:
```typescript
async function ensureTenantConfigured(session: Session): Promise<Session> {
  if (session.user.app_metadata?.tenant_id) return session;
  // Google OAuth users lack colpsic_number — skip auto-setup, route handles it
  const meta = session.user.user_metadata ?? {};
  if (!meta.colpsic_number) return session;
  try {
```

Replace with:
```typescript
async function ensureTenantConfigured(session: Session): Promise<Session> {
  if (session.user.app_metadata?.tenant_id) return session;
  if (session.user.app_metadata?.role === "patient") return session;

  const meta = session.user.user_metadata ?? {};

  // Patient self-registration: has register_as=patient but no colpsic_number
  if (meta.register_as === "patient" && !meta.colpsic_number) {
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("setup-patient-profile timeout")), 8000)
      );
      await Promise.race([api.auth.setupPatientProfile(), timeout]);
      const { data } = await supabase.auth.refreshSession();
      return data.session ?? session;
    } catch (e) {
      console.error("[setup-patient-profile] error:", e);
      return session;
    }
  }

  // Google OAuth users lack colpsic_number — skip auto-setup, /complete-profile handles it
  if (!meta.colpsic_number) return session;

  try {
```

- [ ] **Step 2: Add setupPatientProfile to api.auth in api.ts**

In `psicogest/frontend/src/lib/api.ts`, find the `auth` section and add:

```typescript
setupPatientProfile: () => request<{ role: string; status: string }>("POST", "/auth/setup-patient-profile"),
```

alongside the existing `setupProfile` call.

- [ ] **Step 3: Run typecheck**

```bash
npm run build 2>&1 | grep -i "setupPatient\|useAuth" | head -5
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAuth.ts src/lib/api.ts
git commit -m "feat(auth): add patient branch to ensureTenantConfigured + setupPatientProfile API call"
```

---

## Task 15: LoginPage → redirect to /login/terapeuta

**Files:**
- Modify: `psicogest/frontend/src/pages/auth/LoginPage.tsx`

- [ ] **Step 1: Replace LoginPage with a redirect component**

Replace the entire content of `LoginPage.tsx` with:

```tsx
// psicogest/frontend/src/pages/auth/LoginPage.tsx
import { Navigate } from "react-router-dom";

export function LoginPage() {
  return <Navigate to="/login/terapeuta" replace />;
}
```

- [ ] **Step 2: Verify no TS errors**

```bash
npm run build 2>&1 | grep -i loginpage | head -5
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/auth/LoginPage.tsx
git commit -m "feat(auth): LoginPage redirects to /login/terapeuta"
```

---

## Task 16: TerapeutaLoginPage

**Files:**
- Create: `psicogest/frontend/src/pages/auth/TerapeutaLoginPage.tsx`

- [ ] **Step 1: Create TerapeutaLoginPage (therapist login)**

This is the full login page previously at LoginPage.tsx, enhanced with role branding and a link to patient login:

```tsx
// psicogest/frontend/src/pages/auth/TerapeutaLoginPage.tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const schema = z.object({
  email: z.string().email("Ingresa un email válido"),
  password: z.string().min(1, "La contraseña es requerida"),
});
type FormData = z.infer<typeof schema>;

export function TerapeutaLoginPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) {
      if (error.code === "email_not_confirmed") {
        setServerError("Confirma tu email antes de iniciar sesión. Revisa tu bandeja y carpeta de spam.");
      } else if (error.code === "invalid_credentials") {
        setServerError("Email o contraseña incorrectos.");
      } else {
        setServerError("Error al iniciar sesión. Intenta de nuevo.");
      }
      return;
    }
    navigate("/dashboard");
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--psy-bg)] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-[var(--psy-primary)]">
            Acceso para terapeutas
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Bienvenido de vuelta. Gestiona tus pacientes y sesiones.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
          >
            Continuar con Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">O con email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                {...register("email")}
                aria-invalid={!!errors.email}
              />
              {errors.email && <p className="text-sm text-[var(--psy-danger)]">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
                aria-invalid={!!errors.password}
              />
              {errors.password && <p className="text-sm text-[var(--psy-danger)]">{errors.password.message}</p>}
            </div>
            {serverError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-[var(--psy-danger)]">
                {serverError}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Iniciando sesión..." : "Iniciar sesión"}
            </Button>
          </form>

          <div className="flex flex-col gap-2 text-center text-sm text-muted-foreground">
            <Link to="/forgot-password" className="text-[var(--psy-sage)] hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
            <span>
              ¿No tienes cuenta?{" "}
              <Link to="/register/terapeuta" className="text-[var(--psy-sage)] hover:underline">
                Regístrate
              </Link>
            </span>
            <span>
              ¿Eres paciente?{" "}
              <Link to="/login/paciente" className="text-[var(--psy-sage)] hover:underline">
                Ingresa aquí →
              </Link>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/auth/TerapeutaLoginPage.tsx
git commit -m "feat(auth): add TerapeutaLoginPage with Google OAuth and link to patient login"
```

---

## Task 17: PacienteLoginPage

**Files:**
- Create: `psicogest/frontend/src/pages/auth/PacienteLoginPage.tsx`

- [ ] **Step 1: Create the patient login page**

```tsx
// psicogest/frontend/src/pages/auth/PacienteLoginPage.tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const schema = z.object({
  email: z.string().email("Ingresa un email válido"),
  password: z.string().min(1, "La contraseña es requerida"),
});
type FormData = z.infer<typeof schema>;

export function PacienteLoginPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) {
      if (error.code === "email_not_confirmed") {
        setServerError("Confirma tu email antes de iniciar sesión.");
      } else if (error.code === "invalid_credentials") {
        setServerError("Email o contraseña incorrectos.");
      } else {
        setServerError("Error al iniciar sesión. Intenta de nuevo.");
      }
      return;
    }
    navigate("/portal/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--psy-bg)] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-[var(--psy-primary)]">
            Acceso para pacientes
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Consulta tus citas, sesiones y documentos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                {...register("email")}
                aria-invalid={!!errors.email}
              />
              {errors.email && <p className="text-sm text-[var(--psy-danger)]">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
                aria-invalid={!!errors.password}
              />
              {errors.password && <p className="text-sm text-[var(--psy-danger)]">{errors.password.message}</p>}
            </div>
            {serverError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-[var(--psy-danger)]">
                {serverError}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Iniciando sesión..." : "Ingresar al portal"}
            </Button>
          </form>

          <div className="flex flex-col gap-2 text-center text-sm text-muted-foreground">
            <span>
              ¿Eres terapeuta?{" "}
              <Link to="/login/terapeuta" className="text-[var(--psy-sage)] hover:underline">
                Ingresa aquí →
              </Link>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/auth/PacienteLoginPage.tsx
git commit -m "feat(auth): add PacienteLoginPage with link back to therapist login"
```

---

## Task 18: PacienteRegisterPage

**Files:**
- Create: `psicogest/frontend/src/pages/auth/PacienteRegisterPage.tsx`

- [ ] **Step 1: Create the patient registration page**

```tsx
// psicogest/frontend/src/pages/auth/PacienteRegisterPage.tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const schema = z.object({
  fullName: z.string().min(3, "Nombre completo requerido (mínimo 3 caracteres)"),
  email: z.string().email("Ingresa un email válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});
type FormData = z.infer<typeof schema>;

export function PacienteRegisterPage() {
  const [emailSent, setEmailSent] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          register_as: "patient",
        },
      },
    });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already registered") || error.code === "user_already_registered") {
        setServerError("Ya existe una cuenta con este email. Intenta iniciar sesión.");
      } else {
        setServerError("Error al crear la cuenta. Intenta de nuevo.");
      }
      return;
    }
    setRegisteredEmail(data.email);
    setEmailSent(true);
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--psy-bg)] px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6 space-y-3">
            <div className="text-4xl">📧</div>
            <h2 className="text-xl font-bold text-[var(--psy-primary)]">Revisa tu email</h2>
            <p className="text-sm text-muted-foreground">
              Te enviamos un enlace de confirmación a <strong>{registeredEmail}</strong>.
              Haz clic en el enlace para activar tu cuenta.
            </p>
            <p className="text-xs text-muted-foreground">¿No lo ves? Revisa la carpeta de spam.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--psy-bg)] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-[var(--psy-primary)]">
            Crear cuenta de paciente
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Tu terapeuta te vinculará a su consulta una vez actives tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input id="fullName" type="text" {...register("fullName")} aria-invalid={!!errors.fullName} />
              {errors.fullName && <p className="text-sm text-[var(--psy-danger)]">{errors.fullName.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...register("email")} aria-invalid={!!errors.email} />
              {errors.email && <p className="text-sm text-[var(--psy-danger)]">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" autoComplete="new-password" {...register("password")} aria-invalid={!!errors.password} />
              {errors.password && <p className="text-sm text-[var(--psy-danger)]">{errors.password.message}</p>}
            </div>
            {serverError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-[var(--psy-danger)]">{serverError}</div>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login/paciente" className="text-[var(--psy-sage)] hover:underline">
              Inicia sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/auth/PacienteRegisterPage.tsx
git commit -m "feat(auth): add PacienteRegisterPage with free registration flow"
```

---

## Task 19: Update RegisterPage + CompleteProfilePage navigation

**Files:**
- Modify: `psicogest/frontend/src/pages/auth/RegisterPage.tsx`
- Modify: `psicogest/frontend/src/pages/auth/CompleteProfilePage.tsx`

- [ ] **Step 1: Update the "30 días" copy to "14 días" in RegisterPage**

In `psicogest/frontend/src/pages/auth/RegisterPage.tsx`, find any occurrence of "30 días" and replace with "14 días".

Also find any "30 días gratis" in button text and change to "14 días gratis".

- [ ] **Step 2: Add the /register/terapeuta alias**

In `RegisterPage.tsx`, the component name stays `RegisterPage` — the routing alias is handled in App.tsx.

- [ ] **Step 3: Update CompleteProfilePage navigate to /select-plan**

In `psicogest/frontend/src/pages/auth/CompleteProfilePage.tsx`, find:

```typescript
    navigate("/dashboard", { replace: true });
```

at line ~88 (the one after successful profile setup) and change it to:

```typescript
    navigate("/select-plan", { replace: true });
```

There are two `navigate("/dashboard")` calls. Change only the one after successful profile setup (around line 88), not the one that fires when the user is already configured (line 47).

- [ ] **Step 4: Commit**

```bash
git add src/pages/auth/RegisterPage.tsx src/pages/auth/CompleteProfilePage.tsx
git commit -m "feat(auth): update post-registration navigation to /select-plan and fix 14-day copy"
```

---

## Task 20: PlanSelectPage

**Files:**
- Create: `psicogest/frontend/src/pages/billing/PlanSelectPage.tsx`

- [ ] **Step 1: Create the plan selection page**

```tsx
// psicogest/frontend/src/pages/billing/PlanSelectPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { billingApi } from "@/services/billing";

function PlanCard({
  title,
  price,
  period,
  features,
  lockedFeatures,
  ctaLabel,
  ctaVariant,
  popular,
  onSelect,
}: {
  title: string;
  price: string;
  period: string;
  features: string[];
  lockedFeatures: string[];
  ctaLabel: string;
  ctaVariant: "outline" | "teal" | "white";
  popular?: boolean;
  onSelect: () => void;
}) {
  const ctaClass =
    ctaVariant === "outline"
      ? "border-2 border-[#d1d9e0] text-[#4a5568] bg-transparent"
      : ctaVariant === "teal"
      ? "bg-[#2a7a5e] text-white"
      : "bg-white text-[#1d5c47] font-bold";

  return (
    <div
      className={`relative rounded-2xl border-2 p-6 ${
        popular
          ? "border-[#2a7a5e] bg-gradient-to-br from-[#1d5c47] to-[#2e8b68] text-white mt-[-10px] pt-9"
          : "border-[#e2e8f0] bg-white"
      }`}
    >
      {popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1a3350] text-white text-[10px] font-bold uppercase tracking-wider px-4 py-1 rounded-full whitespace-nowrap">
          Más popular
        </span>
      )}
      <p className={`text-[11px] font-bold uppercase tracking-widest mb-2 ${popular ? "text-white/70" : "text-[#6b7a8d]"}`}>
        {title}
      </p>
      <p className={`text-[2.4rem] font-extrabold leading-none mb-1 ${popular ? "text-white" : "text-[#1a3350]"}`}>
        {price}
      </p>
      <p className={`text-xs mb-4 ${popular ? "text-white/65" : "text-[#8a96a3]"}`}>{period}</p>
      <hr className={`mb-4 ${popular ? "border-white/20" : "border-[#e8edf2]"}`} />

      {features.map((f) => (
        <div key={f} className={`flex gap-2 text-xs mb-2 ${popular ? "text-white/90" : "text-[#374151]"}`}>
          <span className={popular ? "text-[#a8e6cf]" : "text-[#2a7a5e]"}>✓</span>
          {f}
        </div>
      ))}
      {lockedFeatures.map((f) => (
        <div key={f} className="flex gap-2 text-xs mb-2 opacity-40">
          <span className="text-[#c4cdd6]">✕</span>
          {f}
        </div>
      ))}

      <button
        onClick={onSelect}
        className={`mt-5 w-full py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-85 ${ctaClass}`}
      >
        {ctaLabel}
      </button>
    </div>
  );
}

export function PlanSelectPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<"estandar" | "premium" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePaidPlan = async (plan: "estandar" | "premium") => {
    setLoading(plan);
    setError(null);
    try {
      const { checkout_url } = await billingApi.createCheckoutSession(plan);
      window.location.href = checkout_url;
    } catch {
      setError("No se pudo iniciar el proceso de pago. Intenta de nuevo.");
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--psy-bg)] px-4 py-8">
      <div className="text-center mb-6">
        <span className="inline-block bg-[#e8f4f0] text-[#2a7a5e] text-[11px] font-semibold uppercase tracking-wider px-4 py-1 rounded-full mb-3">
          Paso 2 de 2 — Elige tu plan
        </span>
        <h1 className="text-3xl font-extrabold text-[#1a3350] mb-2">
          ¡Cuenta creada! Elige cómo empezar
        </h1>
        <p className="text-[#6b7a8d] text-sm">Sin permanencia forzada. Sin sorpresas. Cancela cuando quieras.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-[var(--psy-danger)] max-w-xs text-center">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-3xl">
        <PlanCard
          title="Prueba gratuita"
          price="$0"
          period="14 días · Sin tarjeta de crédito"
          features={["Agendamiento + recordatorios", "Historia clínica digital", "Analytics básicos"]}
          lockedFeatures={["RIPS automático MinSalud", "Facturación electrónica DIAN", "Funciones IA clínicas"]}
          ctaLabel="Comenzar gratis"
          ctaVariant="outline"
          onSelect={() => navigate("/dashboard")}
        />
        <PlanCard
          title="Premium"
          price="$90K"
          period="COP / mes · ~USD 21"
          features={[
            "Todo lo del plan Estándar",
            "RIPS automático MinSalud",
            "Facturación electrónica DIAN",
            "Analytics avanzados",
            "Funciones IA clínicas",
            "Soporte prioritario",
          ]}
          lockedFeatures={[]}
          ctaLabel={loading === "premium" ? "Redirigiendo..." : "Empezar ahora →"}
          ctaVariant="white"
          popular
          onSelect={() => handlePaidPlan("premium")}
        />
        <PlanCard
          title="Estándar"
          price="$60K"
          period="COP / mes · ~USD 14"
          features={["Agendamiento + recordatorios", "Historia clínica digital", "Analytics básicos"]}
          lockedFeatures={["RIPS automático MinSalud", "Facturación DIAN", "Funciones IA clínicas"]}
          ctaLabel={loading === "estandar" ? "Redirigiendo..." : "Elegir Estándar"}
          ctaVariant="teal"
          onSelect={() => handlePaidPlan("estandar")}
        />
      </div>

      <p className="mt-6 text-xs text-[#9aa5b1] text-center">
        Al elegir un plan de pago serás redirigido a Stripe para ingresar tu tarjeta de forma segura.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/billing/PlanSelectPage.tsx
git commit -m "feat(billing): add PlanSelectPage with three-card pricing (free_trial, premium center, estandar)"
```

---

## Task 21: BillingSuccessPage + PaywallPage

**Files:**
- Create: `psicogest/frontend/src/pages/billing/BillingSuccessPage.tsx`
- Create: `psicogest/frontend/src/pages/billing/PaywallPage.tsx`

- [ ] **Step 1: Create BillingSuccessPage**

```tsx
// psicogest/frontend/src/pages/billing/BillingSuccessPage.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

export function BillingSuccessPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Invalidate billing status so the app refreshes plan data
    queryClient.invalidateQueries({ queryKey: ["billing-status"] });
    const timer = setTimeout(() => navigate("/dashboard", { replace: true }), 3000);
    return () => clearTimeout(timer);
  }, [navigate, queryClient]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--psy-bg)] px-4">
      <div className="text-center max-w-md space-y-4">
        <div className="text-5xl">🎉</div>
        <h1 className="text-2xl font-bold text-[var(--psy-primary)]">¡Suscripción activada!</h1>
        <p className="text-sm text-muted-foreground">
          Tu plan está activo. Serás redirigido al dashboard en unos segundos.
        </p>
        <div className="h-1 w-48 mx-auto bg-[#e2e8f0] rounded-full overflow-hidden">
          <div className="h-full bg-[#2a7a5e] animate-pulse w-full" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create PaywallPage**

```tsx
// psicogest/frontend/src/pages/billing/PaywallPage.tsx
import { useState } from "react";
import { billingApi } from "@/services/billing";

export function PaywallPage() {
  const [loading, setLoading] = useState<"estandar" | "premium" | null>(null);

  const handlePaidPlan = async (plan: "estandar" | "premium") => {
    setLoading(plan);
    try {
      const { checkout_url } = await billingApi.createCheckoutSession(plan);
      window.location.href = checkout_url;
    } catch {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--psy-bg)] px-4 py-8">
      <div className="text-center mb-6 max-w-lg">
        <div className="text-4xl mb-3">🔒</div>
        <h1 className="text-2xl font-bold text-[var(--psy-primary)] mb-2">
          Tu suscripción ha vencido
        </h1>
        <p className="text-sm text-muted-foreground">
          Para seguir usando PsyCent, elige un plan de continuidad.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-xl">
        <div className="rounded-2xl border-2 border-[#e2e8f0] bg-white p-6">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#6b7a8d] mb-2">Estándar</p>
          <p className="text-[2rem] font-extrabold text-[#1a3350] mb-1">$60K</p>
          <p className="text-xs text-[#8a96a3] mb-4">COP / mes · ~USD 14</p>
          <button
            onClick={() => handlePaidPlan("estandar")}
            disabled={!!loading}
            className="w-full py-3 rounded-xl text-sm font-semibold bg-[#2a7a5e] text-white transition-opacity hover:opacity-85"
          >
            {loading === "estandar" ? "Redirigiendo..." : "Elegir Estándar"}
          </button>
        </div>

        <div className="relative rounded-2xl border-2 border-[#2a7a5e] bg-gradient-to-br from-[#1d5c47] to-[#2e8b68] text-white p-6">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1a3350] text-white text-[10px] font-bold uppercase tracking-wider px-4 py-1 rounded-full whitespace-nowrap">
            Recomendado
          </span>
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/70 mb-2">Premium</p>
          <p className="text-[2rem] font-extrabold text-white mb-1">$90K</p>
          <p className="text-xs text-white/65 mb-4">COP / mes · ~USD 21</p>
          <button
            onClick={() => handlePaidPlan("premium")}
            disabled={!!loading}
            className="w-full py-3 rounded-xl text-sm font-bold bg-white text-[#1d5c47] transition-opacity hover:opacity-85"
          >
            {loading === "premium" ? "Redirigiendo..." : "Empezar ahora →"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/billing/BillingSuccessPage.tsx src/pages/billing/PaywallPage.tsx
git commit -m "feat(billing): add BillingSuccessPage and PaywallPage"
```

---

## Task 22: SubscriptionBanner + update AppLayout

**Files:**
- Create: `psicogest/frontend/src/components/layout/SubscriptionBanner.tsx`
- Modify: `psicogest/frontend/src/components/layout/AppLayout.tsx`

- [ ] **Step 1: Create SubscriptionBanner**

```tsx
// psicogest/frontend/src/components/layout/SubscriptionBanner.tsx
import { useNavigate } from "react-router-dom";
import { useBillingStatus } from "@/hooks/useBillingStatus";

export function SubscriptionBanner() {
  const navigate = useNavigate();
  const { data: billing } = useBillingStatus();

  if (!billing || billing.days_remaining > 3) return null;

  const message =
    billing.days_remaining === 0 && billing.in_grace_period
      ? "Tu plan venció — tienes un período de gracia. Renueva ahora."
      : `Tu plan vence en ${billing.days_remaining} día${billing.days_remaining !== 1 ? "s" : ""}.`;

  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-sm text-amber-800">
      <span>{message}</span>
      <button
        onClick={() => navigate("/select-plan")}
        className="ml-4 text-xs font-semibold underline whitespace-nowrap hover:text-amber-900"
      >
        Actualizar plan →
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add SubscriptionBanner to AppLayout**

In `psicogest/frontend/src/components/layout/AppLayout.tsx`, add the import and render the banner at the top of the main content area.

Add import:
```typescript
import { SubscriptionBanner } from "./SubscriptionBanner";
```

Find:
```tsx
      <div className="lg:ml-60 min-h-screen flex flex-col">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 px-4 py-5 md:px-8 md:py-7 max-w-[1400px] w-full">
```

Replace with:
```tsx
      <div className="lg:ml-60 min-h-screen flex flex-col">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <SubscriptionBanner />
        <main className="flex-1 px-4 py-5 md:px-8 md:py-7 max-w-[1400px] w-full">
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/SubscriptionBanner.tsx src/components/layout/AppLayout.tsx
git commit -m "feat(layout): add SubscriptionBanner to AppLayout (visible when ≤3 days remaining)"
```

---

## Task 23: SettingsPage — Plan y facturación tab

**Files:**
- Modify: `psicogest/frontend/src/pages/settings/SettingsPage.tsx`

- [ ] **Step 1: Add the PlanTab inline component to SettingsPage.tsx**

In `psicogest/frontend/src/pages/settings/SettingsPage.tsx`, add these imports at the top:

```typescript
import { useState as usePlanState } from "react";
import { useBillingStatus } from "@/hooks/useBillingStatus";
import { billingApi } from "@/services/billing";
```

- [ ] **Step 2: Add "plan" to TABS array**

Find:
```typescript
const TABS = [
  { id: "perfil", label: "Perfil profesional" },
  { id: "disponibilidad", label: "Disponibilidad" },
  { id: "recordatorios", label: "Recordatorios" },
  { id: "agendamiento", label: "Agendamiento" },
  { id: "google-calendar", label: "Google Calendar" },
  { id: "psycent-ia", label: "PsyCent IA" },
] as const;
```

Replace with:
```typescript
const TABS = [
  { id: "perfil", label: "Perfil profesional" },
  { id: "disponibilidad", label: "Disponibilidad" },
  { id: "recordatorios", label: "Recordatorios" },
  { id: "agendamiento", label: "Agendamiento" },
  { id: "google-calendar", label: "Google Calendar" },
  { id: "psycent-ia", label: "PsyCent IA" },
  { id: "plan", label: "Plan y facturación" },
] as const;
```

- [ ] **Step 3: Add PlanTab section at the end of SettingsPage render**

Before the closing `</div>` of the component, add the plan tab content section:

```tsx
      {active === "plan" && (
        <section className="space-y-4 max-w-md">
          <PlanTabContent />
        </section>
      )}
```

- [ ] **Step 4: Define PlanTabContent as a local component inside SettingsPage.tsx**

Above the `SettingsPage` function definition, add:

```tsx
function PlanTabContent() {
  const { data: billing, isLoading } = useBillingStatus();
  const [portalLoading, setPortalLoading] = usePlanState(false);

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando...</p>;
  if (!billing) return null;

  const planLabels: Record<string, string> = {
    free_trial: "Prueba gratuita",
    estandar: "Estándar",
    premium: "Premium",
  };

  const statusLabels: Record<string, string> = {
    trial: "Período de prueba",
    active: "Activo",
    past_due: "Pago pendiente",
    canceled: "Cancelado",
    expired: "Vencido",
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const { portal_url } = await billingApi.createCustomerPortal();
      window.location.href = portal_url;
    } catch {
      setPortalLoading(false);
    }
  };

  return (
    <div className="rounded-[var(--radius)] p-5 space-y-4" style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--psy-ink-1)]">Plan actual</p>
          <p className="text-2xl font-bold text-[var(--psy-primary)]">
            {planLabels[billing.plan] ?? billing.plan}
          </p>
        </div>
        <span className="text-xs px-3 py-1 rounded-full font-medium"
          style={{ background: billing.subscription_status === "active" ? "var(--psy-sage-bg)" : "#fef3c7", color: billing.subscription_status === "active" ? "var(--psy-ok)" : "#92400e" }}>
          {statusLabels[billing.subscription_status] ?? billing.subscription_status}
        </span>
      </div>

      {billing.days_remaining > 0 && (
        <p className="text-sm text-muted-foreground">
          Vence en <strong>{billing.days_remaining} día{billing.days_remaining !== 1 ? "s" : ""}</strong>
        </p>
      )}

      <div className="flex gap-3 flex-wrap">
        <a href="/select-plan"
          className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-[var(--psy-sage)] text-white hover:opacity-90 transition-opacity">
          Actualizar plan
        </a>
        {billing.subscription_status === "active" && (
          <button onClick={handlePortal} disabled={portalLoading}
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium border border-[var(--psy-line)] text-[var(--psy-ink-1)] hover:bg-[var(--psy-bg)] transition-colors disabled:opacity-50">
            {portalLoading ? "Abriendo..." : "Gestionar suscripción →"}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Handle the useSearchParams tab parameter**

In `SettingsPage`, the `useSearchParams` hook reads `?tab=...`. Make sure tab=plan is handled. Find the `useEffect` that processes `gcalParam` and verify that the URL param `tab` can activate the plan tab. Add handling after the existing `gcalParam` effect:

```typescript
  const tabParam = searchParams.get("tab");
  useEffect(() => {
    if (tabParam === "plan") setActive("plan");
  }, [tabParam]);
```

- [ ] **Step 6: Run typecheck**

```bash
cd psicogest/frontend && npm run build 2>&1 | grep -i "plan\|billing" | head -10
```

Expected: no TypeScript errors

- [ ] **Step 7: Commit**

```bash
git add src/pages/settings/SettingsPage.tsx
git commit -m "feat(settings): add Plan y facturación tab with billing status and portal link"
```

---

## Task 24: App.tsx — new routes + paywall check in ProtectedRoute

**Files:**
- Modify: `psicogest/frontend/src/App.tsx`

- [ ] **Step 1: Add new lazy imports**

In `psicogest/frontend/src/App.tsx`, after the existing lazy imports, add:

```typescript
const TerapeutaLoginPage = lazy(() => import("@/pages/auth/TerapeutaLoginPage").then((m) => ({ default: m.TerapeutaLoginPage })));
const PacienteLoginPage = lazy(() => import("@/pages/auth/PacienteLoginPage").then((m) => ({ default: m.PacienteLoginPage })));
const PacienteRegisterPage = lazy(() => import("@/pages/auth/PacienteRegisterPage").then((m) => ({ default: m.PacienteRegisterPage })));
const PlanSelectPage = lazy(() => import("@/pages/billing/PlanSelectPage").then((m) => ({ default: m.PlanSelectPage })));
const BillingSuccessPage = lazy(() => import("@/pages/billing/BillingSuccessPage").then((m) => ({ default: m.BillingSuccessPage })));
const PaywallPage = lazy(() => import("@/pages/billing/PaywallPage").then((m) => ({ default: m.PaywallPage })));
```

Also add the useBillingStatus import:
```typescript
import { useBillingStatus } from "@/hooks/useBillingStatus";
```

- [ ] **Step 2: Update ProtectedRoute to check subscription**

Find the existing `ProtectedRoute` component:

```typescript
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, tenantReady } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.app_metadata?.role === "patient") return <Navigate to="/portal/dashboard" replace />;
  if (!tenantReady) return <Navigate to="/complete-profile" replace />;
  return <>{children}</>;
}
```

Replace with:

```typescript
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, tenantReady } = useAuth();
  const { data: billing } = useBillingStatus();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.app_metadata?.role === "patient") return <Navigate to="/portal/dashboard" replace />;
  if (!tenantReady) return <Navigate to="/complete-profile" replace />;

  // Redirect to paywall if subscription expired beyond grace period
  if (billing && billing.subscription_status !== "trial" && billing.days_remaining === 0 && !billing.in_grace_period) {
    return <Navigate to="/paywall" replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 3: Add the new routes**

Inside the `Routes` block, add the new routes (outside the ProtectedRoute wrapper):

```tsx
        {/* Differentiated auth routes */}
        <Route path="/login/terapeuta" element={<TerapeutaLoginPage />} />
        <Route path="/login/paciente" element={<PacienteLoginPage />} />
        <Route path="/register/terapeuta" element={<RegisterPage />} />
        <Route path="/register/paciente" element={<PacienteRegisterPage />} />

        {/* Post-registration flow (no subscription guard needed) */}
        <Route path="/select-plan" element={<PlanSelectPage />} />
        <Route path="/billing/success" element={<BillingSuccessPage />} />
        <Route path="/paywall" element={<PaywallPage />} />
```

Also add an alias for `/register` → `/register/terapeuta`:
```tsx
        <Route path="/register" element={<Navigate to="/register/terapeuta" replace />} />
```

- [ ] **Step 4: Run typecheck and verify**

```bash
cd psicogest/frontend && npm run build 2>&1 | head -30
```

Expected: No TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(router): add billing/auth routes + subscription paywall check in ProtectedRoute"
```

---

## Task 25: Update landing.html login button

**Files:**
- Modify: `psicogest/frontend/public/landing.html`

- [ ] **Step 1: Find the current login button**

```bash
grep -n "login\|Iniciar\|ingresar" psicogest/frontend/public/landing.html -i | head -10
```

- [ ] **Step 2: Update the href**

Find the button or link with the text "Iniciar sesión" or href pointing to `/login`. Change its `href` to `/login/terapeuta`.

For example, if it reads:
```html
href="/login"
```

Change to:
```html
href="/login/terapeuta"
```

- [ ] **Step 3: Commit**

```bash
git add public/landing.html
git commit -m "feat(landing): update Iniciar sesión button to /login/terapeuta"
```

---

## Task 26: End-to-end smoke test

- [ ] **Step 1: Start backend**

```bash
cd psicogest/backend && uvicorn app.main:app --reload
```

- [ ] **Step 2: Start frontend**

```bash
cd psicogest/frontend && npm run dev
```

- [ ] **Step 3: Verify the following flows in the browser**

1. `http://localhost:5173/` → lands on landing.html. Click "Iniciar sesión" → goes to `/login/terapeuta`.
2. `/login` → redirects to `/login/terapeuta`.
3. `/login/terapeuta` → shows "Acceso para terapeutas", has "¿Eres paciente? Ingresa aquí →" link.
4. `/login/paciente` → shows "Acceso para pacientes", has "¿Eres terapeuta?" link back.
5. `/register/paciente` → shows patient registration form with 3 fields.
6. `/select-plan` → shows 3-card pricing page; "Comenzar gratis" navigates to /dashboard.
7. `/paywall` → shows paywall with 2 plan cards.
8. `/settings?tab=plan` → shows the Plan y facturación tab with current plan info.

- [ ] **Step 4: Verify backend in Swagger**

Open `http://localhost:8000/docs` and confirm:
- `POST /api/v1/billing/status`
- `POST /api/v1/billing/create-checkout-session`
- `POST /api/v1/billing/customer-portal`
- `POST /api/v1/billing/webhook`
- `POST /api/v1/auth/setup-patient-profile`

All appear in the docs.

- [ ] **Step 5: Run backend tests**

```bash
cd psicogest/backend && pytest tests/test_billing_deps.py -v
```

Expected: 8 tests PASS

---

## Self-Review Notes

- **Spec coverage check:**
  - ✅ Login diferenciado: Tasks 15–17
  - ✅ Registro pacientes libre: Task 18
  - ✅ Registro terapeuta → /select-plan: Tasks 19
  - ✅ Prueba gratuita 14 días: Tasks 1, 4
  - ✅ Stripe Checkout hosted: Tasks 5–7
  - ✅ Webhook lifecycle: Tasks 5–7
  - ✅ GET /billing/status: Task 7
  - ✅ Customer Portal: Tasks 7, 23
  - ✅ require_active_subscription (todas rutas terapeuta): Tasks 8–9
  - ✅ require_plan("premium"): Tasks 8–9
  - ✅ grace period 3 días: Task 9
  - ✅ SubscriptionBanner ≤3 días: Task 22
  - ✅ PaywallPage: Tasks 21, 24
  - ✅ useUpgradePrompt + dialog (403): Task 13
  - ✅ PlanSelectPage 3 tarjetas: Task 20
  - ✅ BillingSuccessPage: Task 21
  - ✅ Settings Plan tab + portal link: Task 23
  - ✅ Landing login → /login/terapeuta: Task 25
  - ✅ useAuth patient branch: Task 14
  - ✅ DB migration: Task 1

- **Type consistency verified:** `BillingStatus`, `billingApi`, `useBillingStatus`, `UpgradePromptDialog` all share the same types from `services/billing.ts`.

- **Stripe webhook security:** Uses `stripe.Webhook.construct_event` to verify Stripe-Signature header. No JWT required on this endpoint.

- **email in checkout session:** The `create_checkout_session` endpoint currently derives email from `user_id`. For a production improvement, the email should be stored in the tenants table or passed from the frontend. This is noted as a known simplification.
