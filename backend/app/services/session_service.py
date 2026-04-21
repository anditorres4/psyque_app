"""Session business logic: CRUD, sign (immutable), append-only notes.

Signed sessions are immutable by law (Res. 1995/1999). The sign() method
computes a SHA-256 hash of all clinical fields and stores it with the
server timestamp. No field can be modified after signing.

SessionNote records are append-only — they can be added but never modified.
"""
from __future__ import annotations

import hashlib
import math
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session as DBSession

from app.models.session import Session, SessionNote
from app.schemas.session import PaginatedSessions, SessionSummary


class SessionNotFoundError(Exception):
    pass


class SessionAlreadySignedError(Exception):
    pass


class SessionService:
    """All session operations for a single authenticated tenant."""

    def __init__(self, db: DBSession, tenant_id: str) -> None:
        self.db = db
        self.tenant_id = tenant_id

    def _tenant_uuid(self) -> uuid.UUID:
        return uuid.UUID(self.tenant_id)

    def get_by_id(self, session_id: str) -> Session:
        """Fetch session. Raises SessionNotFoundError if missing or wrong tenant."""
        sess = self.db.get(Session, uuid.UUID(session_id))
        if not sess or sess.tenant_id != self._tenant_uuid():
            raise SessionNotFoundError(f"Sesión {session_id} no encontrada.")
        return sess

    def create(self, data: dict) -> Session:
        """Create a draft session."""
        appointment_id = data["appointment_id"]
        if isinstance(appointment_id, str):
            appointment_id = uuid.UUID(appointment_id)

        patient_id = data["patient_id"]
        if isinstance(patient_id, str):
            patient_id = uuid.UUID(patient_id)

        sess = Session(
            id=uuid.uuid4(),
            tenant_id=self._tenant_uuid(),
            appointment_id=appointment_id,
            patient_id=patient_id,
            actual_start=data["actual_start"],
            actual_end=data["actual_end"],
            diagnosis_cie11=data["diagnosis_cie11"],
            diagnosis_description=data["diagnosis_description"],
            cups_code=data["cups_code"],
            consultation_reason=data["consultation_reason"],
            intervention=data["intervention"],
            evolution=data.get("evolution"),
            next_session_plan=data.get("next_session_plan"),
            session_fee=data["session_fee"],
            authorization_number=data.get("authorization_number"),
            status="draft",
        )
        self.db.add(sess)
        self.db.flush()
        self.db.refresh(sess)
        return sess

    def update(self, session_id: str, data: dict) -> Session:
        """Update draft session. Raises SessionAlreadySignedError if signed."""
        sess = self.get_by_id(session_id)
        if sess.status == "signed":
            raise SessionAlreadySignedError(
                "No se puede editar una sesión firmada (Res. 1995/1999)."
            )
        allowed = {
            "actual_start", "actual_end", "diagnosis_cie11", "diagnosis_description",
            "cups_code", "consultation_reason", "intervention", "evolution",
            "next_session_plan", "session_fee", "authorization_number",
        }
        for key, value in data.items():
            if key in allowed:
                setattr(sess, key, value)
        self.db.flush()
        self.db.refresh(sess)
        return sess

    def sign(self, session_id: str) -> Session:
        """Sign session — immutable after this call.

        Computes SHA-256 of all clinical fields concatenated and stores it
        with the server timestamp. Raises SessionAlreadySignedError if already signed.
        """
        sess = self.get_by_id(session_id)
        if sess.status == "signed":
            raise SessionAlreadySignedError("La sesión ya está firmada.")

        content = "".join([
            str(sess.id),
            sess.actual_start.isoformat(),
            sess.actual_end.isoformat(),
            sess.diagnosis_cie11,
            sess.diagnosis_description,
            sess.cups_code,
            sess.consultation_reason,
            sess.intervention,
            sess.evolution or "",
            sess.next_session_plan or "",
            str(sess.session_fee),
            sess.authorization_number or "",
        ])
        sess.session_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
        sess.signed_at = datetime.now(tz=timezone.utc)
        sess.status = "signed"
        self.db.flush()
        self.db.refresh(sess)
        return sess

    def list_by_patient(
        self,
        patient_id: str,
        *,
        status: str | None = None,
    ) -> list[Session]:
        """Return all sessions for a patient, newest first."""
        query = self.db.query(Session).filter(
            Session.tenant_id == self._tenant_uuid(),
            Session.patient_id == uuid.UUID(patient_id),
        )
        if status:
            query = query.filter(Session.status == status)
        return query.order_by(Session.actual_start.desc()).all()

    def list_paginated(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        patient_id: str | None = None,
        status: str | None = None,
    ) -> PaginatedSessions:
        """Paginated session list, optionally filtered."""
        page_size = min(page_size, 100)
        offset = (page - 1) * page_size

        query = self.db.query(Session).filter(
            Session.tenant_id == self._tenant_uuid()
        )
        if patient_id:
            query = query.filter(Session.patient_id == uuid.UUID(patient_id))
        if status:
            query = query.filter(Session.status == status)

        total = query.count()
        rows = (
            query.order_by(Session.actual_start.desc())
            .limit(page_size)
            .offset(offset)
            .all()
        )
        items = [SessionSummary.model_validate(r) for r in rows]
        return PaginatedSessions(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            pages=math.ceil(total / page_size) if total > 0 else 1,
        )

    def add_note(self, session_id: str, content: str) -> SessionNote:
        """Append a clarification note to a session (allowed on draft and signed)."""
        sess = self.get_by_id(session_id)
        created_at = datetime.now(tz=timezone.utc)
        note_hash = hashlib.sha256(
            f"{str(sess.id)}{content}{created_at.isoformat()}".encode("utf-8")
        ).hexdigest()
        note = SessionNote(
            id=uuid.uuid4(),
            tenant_id=self._tenant_uuid(),
            session_id=sess.id,
            content=content,
            note_hash=note_hash,
        )
        self.db.add(note)
        self.db.flush()
        self.db.refresh(note)
        return note

    def list_notes(self, session_id: str) -> list[SessionNote]:
        """List all notes for a session, oldest first."""
        self.get_by_id(session_id)  # validates tenant ownership
        return (
            self.db.query(SessionNote)
            .filter(
                SessionNote.tenant_id == self._tenant_uuid(),
                SessionNote.session_id == uuid.UUID(session_id),
            )
            .order_by(SessionNote.created_at)
            .all()
        )
