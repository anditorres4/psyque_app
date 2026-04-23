"""Auth routes — account setup after Supabase signup."""
import re
import uuid
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import AuthUser, get_auth_user

router = APIRouter(tags=["auth"])


_COLPSIC_RE = re.compile(r"^\d{1,8}$")
_REPS_RE = re.compile(r"^[A-Z0-9]{1,20}$")


@router.post("/auth/setup-profile", status_code=200)
def setup_profile(
    user: Annotated[AuthUser, Depends(get_auth_user)],
    db: Session = Depends(get_db),
) -> dict:
    """Create tenant row and set app_metadata.tenant_id via Supabase Admin API.

    Called once after email verification. Uses user_metadata stored during
    signUp (full_name, colpsic_number, reps_code, city) to create the tenant.
    If the tenant already exists, skips creation and just refreshes metadata.
    """
    existing = db.execute(
        text("SELECT id FROM tenants WHERE auth_user_id = :uid"),
        {"uid": user.user_id},
    ).fetchone()

    if existing:
        tenant_id = str(existing[0])
    else:
        meta = user.user_metadata
        full_name = (meta.get("full_name") or meta.get("name") or "").strip()
        if not full_name or len(full_name) < 3:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Se requiere full_name en user_metadata (mínimo 3 caracteres).",
            )

        colpsic_raw = meta.get("colpsic_number", "")
        if not _COLPSIC_RE.match(str(colpsic_raw)):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="El número de tarjeta profesional (colpsic_number) es requerido y debe ser numérico.",
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
            db.execute(
                text("""
                    INSERT INTO tenants (
                        id, auth_user_id, full_name, colpsic_number, reps_code,
                        plan, plan_expires_at, city, nit
                    ) VALUES (
                        :id, :uid, :name, :colpsic, :reps,
                        'starter', NOW() + INTERVAL '30 days', :city, :nit
                    )
                """),
                {
                    "id": tenant_id,
                    "uid": user.user_id,
                    "name": full_name,
                    "colpsic": str(colpsic_raw),
                    "reps": reps_code,
                    "city": city,
                    "nit": nit,
                },
            )
            db.commit()
        except Exception as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al crear el perfil profesional.",
            ) from exc

    supabase_admin_url = (
        f"{settings.supabase_url}/auth/v1/admin/users/{user.user_id}"
    )
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.patch(
                supabase_admin_url,
                headers={
                    "Authorization": f"Bearer {settings.supabase_service_key}",
                    "apikey": settings.supabase_service_key,
                },
                json={"app_metadata": {"tenant_id": tenant_id}},
            )
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"No se pudo actualizar la configuración de cuenta: {exc}",
        )

    return {"tenant_id": tenant_id, "status": "configured"}
