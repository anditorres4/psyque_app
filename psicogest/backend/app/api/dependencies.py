"""FastAPI dependencies for AI module."""
from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import TenantContext, get_current_tenant


class TenantDB:
    """Container holding both the DB session and the authenticated tenant context."""

    def __init__(self, db: Session, tenant: TenantContext) -> None:
        self.db = db
        self.tenant = tenant


def get_tenant_db(
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant),
) -> TenantDB:
    """FastAPI dependency: DB session with RLS tenant context active."""
    from app.core.database import set_tenant_context
    
    set_tenant_context(db, tenant.tenant_id)
    return TenantDB(db=db, tenant=tenant)


# Shorthand annotation for use in endpoint signatures
AuthDB = Annotated[TenantDB, Depends(get_tenant_db)]