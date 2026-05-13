"""Patient portal auth — invite patients to create portal accounts."""
from __future__ import annotations

import uuid
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

import logging

from app.core.config import settings
from app.core.deps import TenantDB, get_tenant_db
from app.models.patient import Patient
from app.models.tenant import Tenant
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)

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

        email_already_existed = resp.status_code == 422 and "email_exists" in resp.text

        if not email_already_existed:
            resp.raise_for_status()
            auth_user_id = uuid.UUID(resp.json()["id"])
        else:
            auth_user_id = None  # resolved from generate_link response below

        # Generate a recovery link — response includes the user object with its ID,
        # which lets us resolve auth_user_id when the Supabase user already existed.
        link_resp = httpx.post(
            f"{settings.supabase_url}/auth/v1/admin/generate_link",
            json={"type": "recovery", "email": patient.email},
            headers=_SUPABASE_ADMIN_HEADERS,
            timeout=10.0,
        )
        if link_resp.is_success:
            link_data = link_resp.json()
            action_link = link_data.get("action_link", "")

            if email_already_existed:
                user_data = link_data.get("user", {})
                if user_data and user_data.get("id"):
                    auth_user_id = uuid.UUID(user_data["id"])
                    _update_user_metadata(str(auth_user_id), str(patient.id), str(patient.tenant_id))
                else:
                    # generate_link didn't return user — fall back to search
                    existing = _find_user_by_email(patient.email)
                    if not existing:
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail="Email ya registrado en otro contexto. Usa un email diferente.",
                        )
                    auth_user_id = uuid.UUID(existing["id"])
                    _update_user_metadata(str(auth_user_id), str(patient.id), str(patient.tenant_id))

            if action_link and auth_user_id:
                tenant = ctx.db.get(Tenant, uuid.UUID(ctx.tenant.tenant_id))
                try:
                    EmailService().send_portal_invite(
                        to_email=patient.email,
                        patient_name=patient.full_name,
                        psychologist_name=tenant.full_name if tenant else "tu psicólogo",
                        action_link=action_link,
                    )
                except Exception:
                    logger.exception("Failed to send portal invite email to %s", patient.email)
        else:
            logger.warning("generate_link failed for %s: %s", patient.email, link_resp.text)
            if auth_user_id is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email ya registrado en otro contexto. Usa un email diferente.",
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
        params={"filter": email},
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
