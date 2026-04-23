"""Combined FastAPI dependencies for authenticated, tenant-scoped DB access."""
from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db, set_tenant_context
from app.core.security import TenantContext, get_current_tenant


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
