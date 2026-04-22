"""Availability router — GET/POST/DELETE /availability endpoints."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import get_tenant_db, TenantDB
from app.schemas.availability import AvailabilityBlockCreate, AvailabilityBlockRead
from app.services.availability_service import AvailabilityNotFoundError, AvailabilityService

router = APIRouter(tags=["availability"])


def _service(ctx: TenantDB) -> AvailabilityService:
    return AvailabilityService(ctx.db, ctx.tenant.tenant_id)


@router.get("/availability", response_model=list[AvailabilityBlockRead])
def list_availability(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> list[AvailabilityBlockRead]:
    blocks = _service(ctx).list()
    return [AvailabilityBlockRead.model_validate(b) for b in blocks]


@router.post("/availability", response_model=AvailabilityBlockRead, status_code=status.HTTP_201_CREATED)
def create_availability_block(
    body: AvailabilityBlockCreate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> AvailabilityBlockRead:
    try:
        block = _service(ctx).create(body.model_dump())
        return AvailabilityBlockRead.model_validate(block)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/availability/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_availability_block(
    block_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> None:
    try:
        _service(ctx).delete(block_id)
    except AvailabilityNotFoundError:
        raise HTTPException(status_code=404, detail="Bloque no encontrado")