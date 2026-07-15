"""Profile router — GET/PUT /profile endpoints."""
from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.deps import get_tenant_db, TenantDB
from app.schemas.profile import TenantProfileRead, TenantProfileUpdate, SisproCredentialsUpdate, SisproTestResult
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


@router.put("/profile/sispro-credentials", response_model=TenantProfileRead)
def update_sispro_credentials(
    body: SisproCredentialsUpdate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> TenantProfileRead:
    profile = _service(ctx).update_sispro_credentials(
        tipo_usuario=body.tipo_usuario,
        doc_type=body.doc_type,
        doc_number=body.doc_number,
        sispro_password=body.sispro_password,
    )
    return TenantProfileRead.model_validate(profile)


@router.post("/rips/test-connection", response_model=SisproTestResult)
def test_sispro_connection(
    body: SisproCredentialsUpdate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> SisproTestResult:
    from app.core.config import settings
    from app.services.fevrips_client import FevRipsClient, FevRipsError

    tenant = _service(ctx).get_profile()
    base_url = getattr(tenant, "fevrips_base_url", None) or settings.fevrips_base_url
    if not base_url:
        return SisproTestResult(ok=False, message="URL del API FEV-RIPS no configurada. Contacte a soporte.")

    # For PIN: NIT must equal CC (SISPRO validation rule)
    nit = body.doc_number if body.tipo_usuario == "PIN" else (tenant.nit or body.doc_number)
    client = FevRipsClient(
        base_url=base_url,
        nit=nit,
        password=body.sispro_password,
        tipo_usuario=body.tipo_usuario,
        doc_type=body.doc_type,
        doc_number=body.doc_number,
    )
    try:
        client.login()
        return SisproTestResult(ok=True, message="Conexión exitosa — SISPRO respondió correctamente.")
    except FevRipsError as exc:
        return SisproTestResult(ok=False, message=str(exc))
    except Exception as exc:
        return SisproTestResult(ok=False, message=f"No se pudo conectar al servidor FEV-RIPS: {exc}")