"""Sessions router — clinical notes CRUD, sign, and append-only notes."""
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status

from app.core.config import settings
from app.core.deps import get_tenant_db, TenantDB
from app.models.patient import Patient
from app.schemas.session import (
    PaginatedSessions,
    SessionCreate,
    SessionContextOut,
    SessionDetail,
    SessionNoteCreate,
    SessionNoteDetail,
    SessionUpdate,
)
from app.services.email_service import EmailService
from app.services.nps_service import NpsService
from app.services.session_service import (
    SessionAlreadySignedError,
    SessionNotFoundError,
    SessionService,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _service(ctx: TenantDB) -> SessionService:
    return SessionService(ctx.db, ctx.tenant.tenant_id)


@router.get("/context/{patient_id}", response_model=SessionContextOut)
def get_session_context(
    patient_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> SessionContextOut:
    """Pre-fill data for a new session: first consultation reason + last mental exam."""
    result = _service(ctx).get_session_context(patient_id)
    return SessionContextOut(**result)


@router.get("", response_model=PaginatedSessions)
def list_sessions(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    patient_id: str | None = Query(None),
    session_status: str | None = Query(None, alias="status"),
) -> PaginatedSessions:
    return _service(ctx).list_paginated(
        page=page, page_size=page_size, patient_id=patient_id, status=session_status
    )


@router.post("", response_model=SessionDetail, status_code=status.HTTP_201_CREATED)
def create_session(
    body: SessionCreate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> SessionDetail:
    sess = _service(ctx).create(body.model_dump())
    ctx.db.commit()
    ctx.db.refresh(sess)
    return SessionDetail.model_validate(sess)


@router.get("/{session_id}", response_model=SessionDetail)
def get_session(
    session_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> SessionDetail:
    try:
        return SessionDetail.model_validate(_service(ctx).get_by_id(session_id))
    except SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada.")


@router.put("/{session_id}", response_model=SessionDetail)
def update_session(
    session_id: str,
    body: SessionUpdate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> SessionDetail:
    try:
        sess = _service(ctx).update(session_id, body.model_dump(exclude_none=True))
        ctx.db.commit()
        ctx.db.refresh(sess)
        return SessionDetail.model_validate(sess)
    except SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada.")
    except SessionAlreadySignedError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.post("/{session_id}/sign", response_model=SessionDetail)
def sign_session(
    session_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    background_tasks: BackgroundTasks,
) -> SessionDetail:
    try:
        sess = _service(ctx).sign(session_id)
        ctx.db.commit()
        ctx.db.refresh(sess)
    except SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada.")
    except SessionAlreadySignedError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    # Post-sign background tasks: homework email + NPS survey
    background_tasks.add_task(
        _post_sign_notifications,
        tenant=ctx.tenant,
        sess=sess,
    )
    return SessionDetail.model_validate(sess)


def _post_sign_notifications(tenant, sess) -> None:
    """Send homework email and NPS survey after session is signed."""
    from app.core.database import SessionLocal
    try:
        with SessionLocal() as db:
            patient = db.get(Patient, sess.patient_id)
            if not patient or not patient.email:
                return

            svc_email = EmailService()
            psychologist_name = getattr(tenant, "full_name", "Tu psicólogo")

            if sess.homework_assigned:
                try:
                    svc_email.send_homework(
                        to_email=patient.email,
                        patient_name=patient.first_name,
                        psychologist_name=psychologist_name,
                        homework_text=sess.homework_assigned,
                        next_session_plan=sess.next_session_plan,
                    )
                except Exception:
                    pass

            try:
                NpsService(db, str(tenant.tenant_id)).create_and_send(str(sess.id))
                db.commit()
            except Exception:
                pass
    except Exception:
        pass


@router.post("/{session_id}/notes", response_model=SessionNoteDetail, status_code=status.HTTP_201_CREATED)
def add_note(
    session_id: str,
    body: SessionNoteCreate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> SessionNoteDetail:
    try:
        note = _service(ctx).add_note(session_id, body.content)
        ctx.db.commit()
        ctx.db.refresh(note)
        return SessionNoteDetail.model_validate(note)
    except SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada.")


@router.get("/{session_id}/notes", response_model=list[SessionNoteDetail])
def list_notes(
    session_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> list[SessionNoteDetail]:
    try:
        notes = _service(ctx).list_notes(session_id)
        return [SessionNoteDetail.model_validate(n) for n in notes]
    except SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada.")
