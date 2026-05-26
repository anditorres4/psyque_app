"""Auth routes — account setup after Supabase signup."""
import logging
import re
import uuid
from typing import Annotated

import httpx

logger = logging.getLogger(__name__)
from fastapi import APIRouter, Depends, HTTPException, Request, status
from datetime import datetime, timezone, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.security import AuthUser, get_auth_user
from app.models.tenant import Tenant

router = APIRouter(tags=["auth"])


_REPS_RE = re.compile(r"^[A-Za-z0-9\-]{1,20}$")


@router.post("/auth/setup-profile", status_code=200)
@limiter.limit("10/minute")
def setup_profile(
    request: Request,
    user: Annotated[AuthUser, Depends(get_auth_user)],
    db: Session = Depends(get_db),
) -> dict:
    """Create tenant row and set app_metadata.tenant_id via Supabase Admin API.

    Called once after email verification. Uses user_metadata stored during
    signUp (full_name, colpsic_number, reps_code, city) to create the tenant.
    If the tenant already exists, skips creation and just refreshes metadata.
    """
    existing = db.query(Tenant).filter(
        Tenant.auth_user_id == uuid.UUID(user.user_id)
    ).first()

    if existing:
        tenant_id = str(existing.id)
    else:
        meta = user.user_metadata
        full_name = (meta.get("full_name") or meta.get("name") or "").strip()
        if not full_name or len(full_name) < 3:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Se requiere full_name en user_metadata (mínimo 3 caracteres).",
            )

        colpsic_raw = str(meta.get("colpsic_number", "")).strip()
        if not colpsic_raw:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="El número de tarjeta profesional (colpsic_number) es requerido.",
            )

        reps_code = meta.get("reps_code")
        if reps_code and not _REPS_RE.match(str(reps_code)):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="El código REPS es inválido (alfanumérico, máximo 20 caracteres).",
            )

        city = (meta.get("city") or "Colombia").strip()
        nit = meta.get("nit")
        if nit and not re.match(r"^\d{9,10}$", str(nit)):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="El NIT es inválido (9-10 dígitos numéricos).",
            )

        tenant_id = str(uuid.uuid4())
        try:
            new_tenant = Tenant(
                id=uuid.UUID(tenant_id),
                auth_user_id=uuid.UUID(user.user_id),
                full_name=full_name,
                colpsic_number=str(colpsic_raw),
                reps_code=reps_code,
                plan="free_trial",
                plan_expires_at=datetime.now(tz=timezone.utc) + timedelta(days=14),
                city=city,
                nit=nit,
                subscription_status="trial",
            )
            db.add(new_tenant)
            db.commit()
        except Exception:
            db.rollback()
            logger.exception("DB insert failed in setup_profile")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al crear el perfil profesional.",
            )

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
                json={"app_metadata": {"tenant_id": tenant_id}},
            )
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.exception("setup_profile: failed to update Supabase app_metadata for user %s", user.user_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No se pudo actualizar la configuración de cuenta",
        )

    return {"tenant_id": tenant_id, "status": "configured"}


@router.post("/auth/setup-patient-profile", status_code=200)
@limiter.limit("10/minute")
def setup_patient_profile(
    request: Request,
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
        logger.exception("setup_patient_profile: failed to update Supabase app_metadata for user %s", user.user_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No se pudo configurar el perfil de paciente",
        )
    return {"role": "patient", "status": "configured"}
