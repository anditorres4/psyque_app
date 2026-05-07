"""Patient portal auth — invite patients to create portal accounts."""
from __future__ import annotations

import uuid
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import settings
from app.core.deps import TenantDB, get_tenant_db
from app.models.patient import Patient

router = APIRouter(prefix="/patients", tags=["patient-auth"])

_SUPABASE_ADMIN_HEADERS = {
    "apikey": settings.supabase_service_key,
    "Authorization": f"Bearer {settings.supabase_service_key}",
    "Content-Type": "application/json",
}


@router.post("/{patient_id}/invite-to-portal", status_code=status.HTTP_200_OK)
def invite_patient_to_portal(
    patient_id: uuid.UUID,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> dict:
    """Send a portal invitation to a patient.

    Creates (or reuses) a Supabase auth user for the patient email, sets
    app_metadata.role='patient' and app_metadata.patient_id, then updates
    patients.auth_user_id.
    """
    patient = ctx.db.get(Patient, patient_id)
    if not patient or patient.tenant_id != uuid.UUID(ctx.tenant.tenant_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado.")
    if not patient.email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El paciente no tiene email registrado. Agrega un email primero.",
        )
    if patient.auth_user_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este paciente ya tiene acceso al portal.",
        )

    admin_url = f"{settings.supabase_url}/auth/v1/admin/users"

    try:
        # Create Supabase auth user with patient metadata
        resp = httpx.post(
            admin_url,
            json={
                "email": patient.email,
                "email_confirm": True,
                "app_metadata": {
                    "role": "patient",
                    "patient_id": str(patient.id),
                    "tenant_id": str(patient.tenant_id),
                },
            },
            headers=_SUPABASE_ADMIN_HEADERS,
            timeout=15.0,
        )

        if resp.status_code == 422 and "already registered" in resp.text.lower():
            # User already exists — fetch and update app_metadata instead
            existing = _find_user_by_email(patient.email)
            if not existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email ya registrado en otro contexto. Usa un email diferente.",
                )
            auth_user_id = uuid.UUID(existing["id"])
            _update_user_metadata(str(auth_user_id), str(patient.id), str(patient.tenant_id))
        else:
            resp.raise_for_status()
            auth_user_id = uuid.UUID(resp.json()["id"])

        # Send magic link / password reset so the patient sets their password
        httpx.post(
            f"{settings.supabase_url}/auth/v1/recover",
            json={"email": patient.email},
            headers=_SUPABASE_ADMIN_HEADERS,
            timeout=10.0,
        )

    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error al crear cuenta en Supabase: {exc.response.text}",
        )

    patient.auth_user_id = auth_user_id
    ctx.db.commit()

    return {"ok": True, "auth_user_id": str(auth_user_id), "email": patient.email}


def _find_user_by_email(email: str) -> dict | None:
    resp = httpx.get(
        f"{settings.supabase_url}/auth/v1/admin/users",
        params={"filter": f"email={email}"},
        headers=_SUPABASE_ADMIN_HEADERS,
        timeout=10.0,
    )
    if not resp.is_success:
        return None
    users = resp.json().get("users", [])
    return users[0] if users else None


def _update_user_metadata(auth_user_id: str, patient_id: str, tenant_id: str) -> None:
    httpx.put(
        f"{settings.supabase_url}/auth/v1/admin/users/{auth_user_id}",
        json={
            "app_metadata": {
                "role": "patient",
                "patient_id": patient_id,
                "tenant_id": tenant_id,
            }
        },
        headers=_SUPABASE_ADMIN_HEADERS,
        timeout=10.0,
    )
