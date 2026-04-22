"""Reports router — analytics and reporting endpoints."""
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.deps import get_tenant_db, TenantDB
from app.schemas.report import (
    AttendanceReportResponse,
    DashboardSummary,
    NewPatientsReportResponse,
    RevenueReportResponse,
    SessionTypeReportResponse,
)
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["reports"])


def _service(ctx: TenantDB) -> ReportService:
    return ReportService(ctx.db, ctx.tenant.tenant_id)


@router.get("/revenue", response_model=RevenueReportResponse)
def revenue_report(
    months: int = Query(12, ge=1, le=24),
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> RevenueReportResponse:
    return _service(ctx).revenue_report(months)


@router.get("/attendance", response_model=AttendanceReportResponse)
def attendance_report(
    months: int = Query(12, ge=1, le=24),
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> AttendanceReportResponse:
    return _service(ctx).attendance_report(months)


@router.get("/session-types", response_model=SessionTypeReportResponse)
def session_type_report(
    months: int = Query(12, ge=1, le=24),
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> SessionTypeReportResponse:
    return _service(ctx).session_type_report(months)


@router.get("/new-patients", response_model=NewPatientsReportResponse)
def new_patients_report(
    months: int = Query(12, ge=1, le=24),
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> NewPatientsReportResponse:
    return _service(ctx).new_patients_report(months)


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(
    months: int = Query(12, ge=1, le=24),
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> DashboardSummary:
    return DashboardSummary(**_service(ctx).dashboard_summary(months))