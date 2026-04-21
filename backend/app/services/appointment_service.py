"""Appointment business logic: CRUD, conflict detection, cancellation."""
from __future__ import annotations

import math
import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.schemas.appointment import AppointmentSummary, PaginatedAppointments


class AppointmentNotFoundError(Exception):
    pass


class AppointmentConflictError(Exception):
    pass


class AppointmentService:
    """All appointment operations for a single authenticated tenant."""

    def __init__(self, db: Session, tenant_id: str) -> None:
        self.db = db
        self.tenant_id = tenant_id

    def _check_conflict(
        self,
        start: datetime,
        end: datetime,
        exclude_id: str | None = None,
    ) -> None:
        """Raise AppointmentConflictError if any scheduled appointment overlaps [start, end).

        Cancelled and noshow appointments are excluded from conflict checks.
        Overlap condition: existing.start < new.end AND existing.end > new.start
        """
        query = (
            self.db.query(Appointment)
            .filter(
                Appointment.tenant_id == uuid.UUID(self.tenant_id),
                Appointment.status.in_(["scheduled"]),
                Appointment.scheduled_start < end,
                Appointment.scheduled_end > start,
            )
        )
        if exclude_id:
            query = query.filter(Appointment.id != uuid.UUID(exclude_id))

        conflict = query.first()
        if conflict:
            raise AppointmentConflictError(
                f"Ya existe una cita entre {start.strftime('%H:%M')} y {end.strftime('%H:%M')}."
            )

    def create(self, data: dict) -> Appointment:
        """Create appointment. Raises AppointmentConflictError on overlap."""
        self._check_conflict(data["scheduled_start"], data["scheduled_end"])

        patient_id = data["patient_id"]
        if isinstance(patient_id, str):
            patient_id = uuid.UUID(patient_id)

        appt = Appointment(
            id=uuid.uuid4(),
            tenant_id=uuid.UUID(self.tenant_id),
            patient_id=patient_id,
            scheduled_start=data["scheduled_start"],
            scheduled_end=data["scheduled_end"],
            session_type=data["session_type"],
            modality=data["modality"],
            notes=data.get("notes"),
            status="scheduled",
        )
        self.db.add(appt)
        self.db.flush()
        self.db.refresh(appt)
        return appt

    def get_by_id(self, appointment_id: str) -> Appointment:
        """Fetch appointment by UUID. Raises AppointmentNotFoundError if missing or wrong tenant."""
        appt = self.db.get(Appointment, uuid.UUID(appointment_id))
        if not appt or appt.tenant_id != uuid.UUID(self.tenant_id):
            raise AppointmentNotFoundError(f"Cita {appointment_id} no encontrada.")
        return appt

    def list_by_range(self, *, start: datetime, end: datetime) -> list[Appointment]:
        """Return all appointments overlapping the given datetime range."""
        return (
            self.db.query(Appointment)
            .filter(
                Appointment.tenant_id == uuid.UUID(self.tenant_id),
                Appointment.scheduled_start < end,
                Appointment.scheduled_end > start,
            )
            .order_by(Appointment.scheduled_start)
            .all()
        )

    def list_paginated(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        patient_id: str | None = None,
        status: str | None = None,
    ) -> PaginatedAppointments:
        """Paginated appointment list, optionally filtered by patient or status."""
        page_size = min(page_size, 100)
        offset = (page - 1) * page_size

        query = self.db.query(Appointment).filter(
            Appointment.tenant_id == uuid.UUID(self.tenant_id)
        )

        if patient_id:
            query = query.filter(Appointment.patient_id == uuid.UUID(patient_id))
        if status:
            query = query.filter(Appointment.status == status)

        total = query.count()

        rows = (
            query.order_by(Appointment.scheduled_start.desc())
            .limit(page_size)
            .offset(offset)
            .all()
        )

        items = [AppointmentSummary.model_validate(r) for r in rows]
        return PaginatedAppointments(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            pages=math.ceil(total / page_size) if total > 0 else 1,
        )

    def update(self, appointment_id: str, data: dict) -> Appointment:
        """Partial update. Checks conflict if times change. Returns updated appointment."""
        appt = self.get_by_id(appointment_id)
        new_start = data.get("scheduled_start", appt.scheduled_start)
        new_end = data.get("scheduled_end", appt.scheduled_end)

        if "scheduled_start" in data or "scheduled_end" in data:
            self._check_conflict(new_start, new_end, exclude_id=appointment_id)

        allowed = {"scheduled_start", "scheduled_end", "session_type", "modality", "notes"}
        for key, value in data.items():
            if key in allowed and value is not None:
                setattr(appt, key, value)

        self.db.flush()
        self.db.refresh(appt)
        return appt

    def cancel(
        self,
        appointment_id: str,
        *,
        cancelled_by: str,
        reason: str,
    ) -> Appointment:
        """Cancel appointment. Raises ValueError if already cancelled/noshow."""
        appt = self.get_by_id(appointment_id)
        if appt.status in ("cancelled", "noshow"):
            raise ValueError("La cita ya está cancelada o marcada como no-show.")
        appt.status = "cancelled"
        appt.cancelled_by = cancelled_by
        appt.cancellation_reason = reason
        self.db.flush()
        self.db.refresh(appt)
        return appt

    def complete(self, appointment_id: str) -> Appointment:
        """Mark appointment as completed. Raises ValueError if not scheduled."""
        appt = self.get_by_id(appointment_id)
        if appt.status != "scheduled":
            raise ValueError(
                f"Solo se pueden completar citas en estado 'scheduled'. Estado actual: {appt.status}"
            )
        appt.status = "completed"
        self.db.flush()
        self.db.refresh(appt)
        return appt

    def mark_noshow(self, appointment_id: str) -> Appointment:
        """Mark appointment as noshow. Raises ValueError if not scheduled."""
        appt = self.get_by_id(appointment_id)
        if appt.status != "scheduled":
            raise ValueError(
                f"Solo se pueden marcar como no-show citas en estado 'scheduled'. Estado actual: {appt.status}"
            )
        appt.status = "noshow"
        self.db.flush()
        self.db.refresh(appt)
        return appt
