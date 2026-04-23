"""Dashboard stats endpoint."""
from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.deps import get_tenant_db, TenantDB
from app.schemas.dashboard import DashboardStats
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> DashboardStats:
    svc = DashboardService(ctx.db, ctx.tenant.tenant_id)
    data = svc.get_stats()
    return DashboardStats(**data)