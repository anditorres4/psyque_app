"""Sessions router — clinical notes CRUD, sign, and append-only notes."""
from datetime import datetime
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


@router.post("/{session_id}/ai-context-summary", response_model=SessionDetail)
def generate_ai_context_summary(
    session_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> SessionDetail:
    """Generate AI summary of previous signed sessions and store in the session."""
    import uuid as _uuid
    from app.models.session import Session as SessionModel
    from app.models.tenant import Tenant
    from app.services.ai_service import check_feature_enabled, get_ai_config
    from app.services.ai.providers import get_provider

    svc = _service(ctx)
    try:
        sess = svc.get_by_id(session_id)
    except SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada.")

    tenant = ctx.db.query(Tenant).filter(Tenant.id == _uuid.UUID(ctx.tenant.tenant_id)).first()
    if not tenant or not tenant.ai_provider or not tenant.ai_api_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Configuración IA no completada.")
    if not check_feature_enabled(tenant, "ai_summaries"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Feature de resúmenes IA no habilitada.")

    prev = (
        ctx.db.query(SessionModel)
        .filter(
            SessionModel.tenant_id == _uuid.UUID(ctx.tenant.tenant_id),
            SessionModel.patient_id == sess.patient_id,
            SessionModel.status == "signed",
            SessionModel.id != sess.id,
        )
        .order_by(SessionModel.actual_start.desc())
        .limit(6)
        .all()
    )
    if not prev:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Sin sesiones anteriores para resumir.")

    sessions_text = "\n\n---\n\n".join(
        f"Sesión {i + 1} ({s.actual_start.strftime('%Y-%m-%d')}):\n"
        f"Diagnóstico: {s.diagnosis_cie11} — {s.diagnosis_description}\n"
        f"Motivo: {s.consultation_reason}\n"
        f"Intervención: {s.intervention}\n"
        f"Evolución: {s.evolution or 'No registrada'}\n"
        f"Plan siguiente: {s.next_session_plan or 'No registrado'}\n"
        f"Tareas asignadas: {s.homework_assigned or 'Ninguna'}"
        for i, s in enumerate(reversed(prev))
    )

    config = get_ai_config(tenant)
    provider = get_provider(config["provider"], config["api_key"])
    prompt = (
        "Eres un asistente clínico psicológico. Resume las siguientes sesiones previas del paciente "
        "en un párrafo conciso (máximo 220 palabras) orientado a dar contexto al psicólogo antes de "
        "iniciar una nueva sesión. Incluye: estado del paciente, progreso terapéutico, temas recurrentes, "
        "tareas asignadas y pendientes. Usa lenguaje clínico accesible. "
        "Responde SOLO con el texto del resumen, sin JSON ni formato adicional.\n\n"
        f"SESIONES PREVIAS:\n{sessions_text}"
    )
    response = provider.generate(prompt, config["model"])
    summary_text = response.content.strip()

    sess.ai_context_summary = summary_text
    ctx.db.commit()
    ctx.db.refresh(sess)
    return SessionDetail.model_validate(sess)


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


@router.post("/{session_id}/send-patient-summary", response_model=SessionDetail)
def send_patient_summary(
    session_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> SessionDetail:
    """Send patient_summary_text via email and mark patient_summary_sent_at."""
    import uuid as _uuid
    from datetime import timezone
    from app.models.patient import Patient as PatientModel
    from app.models.tenant import Tenant

    svc = _service(ctx)
    try:
        sess = svc.get_by_id(session_id)
    except SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada.")

    if not sess.patient_summary_text or not sess.patient_summary_text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El resumen para el paciente está vacío.",
        )
    if sess.patient_summary_sent_at:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El resumen ya fue enviado al paciente.",
        )

    patient = ctx.db.get(PatientModel, sess.patient_id)
    if not patient or not patient.email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El paciente no tiene email registrado.",
        )

    tenant = ctx.db.query(Tenant).filter(Tenant.id == _uuid.UUID(ctx.tenant.tenant_id)).first()
    psychologist_name = getattr(tenant, "full_name", "Tu psicólogo/a") if tenant else "Tu psicólogo/a"

    email_svc = EmailService()
    email_svc.send_patient_session_summary(
        to_email=patient.email,
        patient_name=patient.first_name,
        psychologist_name=psychologist_name,
        summary_text=sess.patient_summary_text,
        session_date=sess.actual_start,
    )

    sess.patient_summary_sent_at = datetime.now(tz=timezone.utc)
    ctx.db.commit()
    ctx.db.refresh(sess)
    return SessionDetail.model_validate(sess)
