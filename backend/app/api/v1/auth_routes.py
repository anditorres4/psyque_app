"""Auth routes — account setup after Supabase signup."""
import uuid
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import AuthUser, get_auth_user

router = APIRouter(tags=["auth"])


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
    # Check if tenant already exists for this auth user
    existing = db.execute(
        text("SELECT id FROM tenants WHERE auth_user_id = :uid"),
        {"uid": user.user_id},
    ).fetchone()

    if existing:
        tenant_id = str(existing[0])
    else:
        meta = user.user_metadata
        full_name = meta.get("full_name") or meta.get("name") or "Psicólogo"
        colpsic = meta.get("colpsic_number", "PENDIENTE")
        reps_code = meta.get("reps_code") or None
        city = meta.get("city", "Colombia")

        tenant_id = str(uuid.uuid4())
        db.execute(
            text("""
                INSERT INTO tenants (
                    id, auth_user_id, full_name, colpsic_number, reps_code,
                    plan, plan_expires_at, city
                ) VALUES (
                    :id, :uid, :name, :colpsic, :reps,
                    'starter', NOW() + INTERVAL '30 days', :city
                )
            """),
            {
                "id": tenant_id,
                "uid": user.user_id,
                "name": full_name,
                "colpsic": colpsic,
                "reps": reps_code,
                "city": city,
            },
        )
        db.commit()

    # Update Supabase app_metadata so the next JWT contains tenant_id
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
