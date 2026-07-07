"""Combined FastAPI dependencies for authenticated, tenant-scoped DB access."""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, status as http_status
from sqlalchemy.orm import Session

from app.core.database import get_db, set_tenant_context
from app.core.security import PatientContext, TenantContext, get_current_patient, get_current_tenant
from app.models.tenant import Tenant


class TenantDB:
    """Container holding both the DB session and the authenticated tenant context.

    Usage in endpoints:
        def my_endpoint(ctx: Annotated[TenantDB, Depends(get_tenant_db)]):
            ctx.db      # Session with RLS context active for this tenant
            ctx.tenant  # TenantContext with .tenant_id and .user_id
    """

    def __init__(self, db: Session, tenant: TenantContext) -> None:
        self.db = db
        self.tenant = tenant


def get_tenant_db(
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant),
) -> TenantDB:
    """FastAPI dependency: DB session with RLS tenant context active.

    Sets current_setting('app.tenant_id') on the PostgreSQL connection so
    all queries automatically obey RLS policies for the authenticated tenant.
    """
    set_tenant_context(db, tenant.tenant_id)
    return TenantDB(db=db, tenant=tenant)


# Shorthand annotation for use in endpoint signatures
AuthDB = Annotated[TenantDB, Depends(get_tenant_db)]


class PatientDB:
    """Container for DB session + authenticated patient context."""

    def __init__(self, db: Session, patient: PatientContext) -> None:
        self.db = db
        self.patient = patient


def get_patient_db(
    db: Session = Depends(get_db),
    patient: PatientContext = Depends(get_current_patient),
) -> PatientDB:
    """FastAPI dependency: DB session for portal patient endpoints (no RLS context needed)."""
    return PatientDB(db=db, patient=patient)


CurrentPatientDB = Annotated[PatientDB, Depends(get_patient_db)]


def require_active_subscription(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> None:
    """Raise 402 if subscription has expired beyond the grace period.

    Grace periods by plan:
    - free_trial: 7 days after plan_expires_at before blocking.
    - estandar / premium: 7 days after plan_expires_at before blocking.

    free_trial tenants within their trial window are always allowed through.
    """
    tenant = ctx.db.query(Tenant).filter(
        Tenant.id == uuid.UUID(ctx.tenant.tenant_id)
    ).first()
    if tenant is None:
        raise HTTPException(http_status.HTTP_401_UNAUTHORIZED, "Tenant no encontrado")
    expires = tenant.plan_expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    # Active trial or active paid plan — always pass
    if now <= expires:
        return
    # Within 7-day grace period — allow through regardless of plan
    if now <= expires + timedelta(days=7):
        return
    raise HTTPException(
        http_status.HTTP_402_PAYMENT_REQUIRED,
        "Suscripción vencida. Renueva tu plan en /select-plan",
    )


def require_plan(required: str):
    """Return a dependency that raises 403 if tenant plan is not free_trial or the required plan.

    free_trial always passes — tenants can evaluate all features during their trial.
    """
    def _check(ctx: Annotated[TenantDB, Depends(get_tenant_db)]) -> None:
        tenant = ctx.db.query(Tenant).filter(
            Tenant.id == uuid.UUID(ctx.tenant.tenant_id)
        ).first()
        if tenant is None:
            raise HTTPException(http_status.HTTP_401_UNAUTHORIZED, "Tenant no encontrado")
        if tenant.plan not in ("free_trial", required):
            raise HTTPException(
                http_status.HTTP_403_FORBIDDEN,
                "Se requiere plan Premium para usar esta función",
            )
    return _check
