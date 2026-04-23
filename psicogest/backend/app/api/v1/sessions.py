"""Sessions router — clinical notes CRUD, sign, and append-only notes."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.deps import get_tenant_db, TenantDB
from app.schemas.session import (
    PaginatedSessions,
    SessionCreate,
    SessionDetail,
    SessionNoteCreate,
    SessionNoteDetail,
    SessionUpdate,
)
from app.services.session_service import (
    SessionAlreadySignedError,
    SessionNotFoundError,
    SessionService,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _service(ctx: TenantDB) -> SessionService:
    return SessionService(ctx.db, ctx.tenant.tenant_id)


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
) -> SessionDetail:
    try:
        sess = _service(ctx).sign(session_id)
        ctx.db.commit()
        ctx.db.refresh(sess)
        return SessionDetail.model_validate(sess)
    except SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada.")
    except SessionAlreadySignedError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


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
