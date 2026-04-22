"""Profile router — GET/PUT /profile endpoints."""
from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.deps import get_tenant_db, TenantDB
from app.schemas.profile import TenantProfileRead, TenantProfileUpdate
from app.services.profile_service import ProfileService

router = APIRouter(tags=["profile"])


def _service(ctx: TenantDB) -> ProfileService:
    return ProfileService(ctx.db, ctx.tenant.tenant_id)


@router.get("/profile", response_model=TenantProfileRead)
def get_profile(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> TenantProfileRead:
    return TenantProfileRead.model_validate(_service(ctx).get_profile())


@router.put("/profile", response_model=TenantProfileRead)
def update_profile(
    body: TenantProfileUpdate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> TenantProfileRead:
    profile = _service(ctx).update_profile(body.model_dump(exclude_none=True))
    ctx.db.commit()
    ctx.db.refresh(profile)
    return TenantProfileRead.model_validate(profile)