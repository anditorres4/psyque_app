"""RIPS router — generate and download RIPS exports (Res. 2275/2023)."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse, StreamingResponse

from app.core.deps import get_tenant_db, TenantDB
from app.schemas.rips import (
    RipsExportSummary,
    RipsGenerateRequest,
    RipsGenerationResponse,
)
from app.services.rips_service import RipsGenerationError, RipsService

router = APIRouter(prefix="/rips", tags=["rips"])


def _service(ctx: TenantDB) -> RipsService:
    return RipsService(ctx.db, ctx.tenant.tenant_id)


@router.post("/generate", response_model=RipsGenerationResponse)
def generate_rips(
    body: RipsGenerateRequest,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> RipsGenerationResponse:
    try:
        export = _service(ctx).generate(body.year, body.month)
        ctx.db.commit()
        return RipsGenerationResponse(
            export=RipsExportSummary.model_validate(export),
            message=f"RIPS generado para {body.year:04d}-{body.month:02d} "
                    f"({export.sessions_count} sesiones, ${export.total_value_cop:,.0f} COP)",
        )
    except RipsGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )


@router.get("", response_model=list[RipsExportSummary])
def list_rips_exports(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    limit: int = Query(20, ge=1, le=100),
) -> list[RipsExportSummary]:
    exports = _service(ctx).list_exports(limit=limit)
    return [RipsExportSummary.model_validate(e) for e in exports]


@router.get("/{export_id}", response_model=RipsExportSummary)
def get_rips_export(
    export_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> RipsExportSummary:
    try:
        export = _service(ctx).get_export(export_id)
        return RipsExportSummary.model_validate(export)
    except RipsGenerationError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exportación no encontrada.",
        )


@router.get("/{export_id}/download")
def download_rips(
    export_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> StreamingResponse:
    try:
        zip_bytes = _service(ctx).download_zip(export_id)
        export = _service(ctx).get_export(export_id)
        filename = f"rips_{export.period_year:04d}{export.period_month:02d}.zip"
        return StreamingResponse(
            iter([zip_bytes]),
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except RipsGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )