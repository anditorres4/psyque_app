"""Patient tasks — psychologist creates tasks from sessions; patients submit responses."""
from __future__ import annotations

import uuid as _uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.deps import CurrentPatientDB, TenantDB, get_patient_db, get_tenant_db
from app.models.patient import Patient
from app.models.patient_task import PatientTask
from app.models.session import Session
from app.models.tenant import Tenant
from app.schemas.patient_task import PatientTaskCreate, PatientTaskOut, PatientTaskReview
from app.services.email_service import EmailService

router = APIRouter(tags=["patient-tasks"])


# ── Psychologist endpoints ────────────────────────────────────────────────────

@router.post(
    "/sessions/{session_id}/tasks",
    response_model=PatientTaskOut,
    status_code=status.HTTP_201_CREATED,
)
def create_task(
    session_id: str,
    body: PatientTaskCreate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> PatientTaskOut:
    sess = (
        ctx.db.query(Session)
        .filter(
            Session.id == _uuid.UUID(session_id),
            Session.psychologist_id == _uuid.UUID(ctx.tenant.tenant_id),
        )
        .first()
    )
    if not sess:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada.")

    task = PatientTask(
        tenant_id=_uuid.UUID(ctx.tenant.tenant_id),
        patient_id=body.patient_id,
        session_id=_uuid.UUID(session_id),
        title=body.title,
        description=body.description,
        due_date=body.due_date,
        status="pending",
    )
    ctx.db.add(task)
    ctx.db.commit()
    ctx.db.refresh(task)

    # Send email notification
    patient = ctx.db.get(Patient, body.patient_id)
    if patient and patient.email:
        tenant = ctx.db.query(Tenant).filter(Tenant.id == _uuid.UUID(ctx.tenant.tenant_id)).first()
        psychologist_name = getattr(tenant, "full_name", "Tu psicólogo/a") if tenant else "Tu psicólogo/a"
        try:
            EmailService().send_task_assigned(
                to_email=patient.email,
                patient_name=patient.first_name,
                psychologist_name=psychologist_name,
                task_title=body.title,
                task_description=body.description,
                due_date=body.due_date,
            )
        except Exception:
            pass

    return PatientTaskOut.model_validate(task)


@router.get("/patients/{patient_id}/tasks", response_model=list[PatientTaskOut])
def list_patient_tasks(
    patient_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    session_id: str | None = Query(None),
) -> list[PatientTaskOut]:
    q = ctx.db.query(PatientTask).filter(
        PatientTask.tenant_id == _uuid.UUID(ctx.tenant.tenant_id),
        PatientTask.patient_id == _uuid.UUID(patient_id),
    )
    if session_id:
        q = q.filter(PatientTask.session_id == _uuid.UUID(session_id))
    tasks = q.order_by(PatientTask.created_at.desc()).all()
    return [PatientTaskOut.model_validate(t) for t in tasks]


@router.put("/tasks/{task_id}", response_model=PatientTaskOut)
def review_task(
    task_id: str,
    body: PatientTaskReview,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> PatientTaskOut:
    task = (
        ctx.db.query(PatientTask)
        .filter(
            PatientTask.id == _uuid.UUID(task_id),
            PatientTask.tenant_id == _uuid.UUID(ctx.tenant.tenant_id),
        )
        .first()
    )
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada.")
    task.status = "reviewed"
    task.reviewer_notes = body.reviewer_notes
    task.reviewed_at = datetime.now(tz=timezone.utc)
    ctx.db.commit()
    ctx.db.refresh(task)
    return PatientTaskOut.model_validate(task)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> None:
    task = (
        ctx.db.query(PatientTask)
        .filter(
            PatientTask.id == _uuid.UUID(task_id),
            PatientTask.tenant_id == _uuid.UUID(ctx.tenant.tenant_id),
        )
        .first()
    )
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada.")
    ctx.db.delete(task)
    ctx.db.commit()


# ── Patient portal endpoints ──────────────────────────────────────────────────

@router.get("/portal/tasks", response_model=list[PatientTaskOut])
def portal_list_tasks(ctx: CurrentPatientDB) -> list[PatientTaskOut]:
    tasks = (
        ctx.db.query(PatientTask)
        .filter(PatientTask.patient_id == _uuid.UUID(ctx.patient.patient_id))
        .order_by(PatientTask.created_at.desc())
        .all()
    )
    return [PatientTaskOut.model_validate(t) for t in tasks]


@router.post("/portal/tasks/{task_id}/submit", response_model=PatientTaskOut)
def portal_submit_task(
    task_id: str,
    body: dict,
    ctx: CurrentPatientDB,
) -> PatientTaskOut:
    task = (
        ctx.db.query(PatientTask)
        .filter(
            PatientTask.id == _uuid.UUID(task_id),
            PatientTask.patient_id == _uuid.UUID(ctx.patient.patient_id),
        )
        .first()
    )
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada.")
    if task.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Esta tarea ya fue enviada.",
        )
    task.submission_text = body.get("submission_text") or None
    task.submission_file_path = body.get("submission_file_path") or None
    if not task.submission_text and not task.submission_file_path:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Debes incluir una respuesta de texto o un archivo.",
        )
    task.status = "submitted"
    ctx.db.commit()
    ctx.db.refresh(task)
    return PatientTaskOut.model_validate(task)
