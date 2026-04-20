"""Background job: scan and send appointment reminders at 48h and 2h windows."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.patient import Patient
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)


class ReminderService:
    """Queries appointments due for reminder and marks flags after sending.

    These queries run without SET LOCAL app.tenant_id — they rely on the
    postgres superuser connection bypassing RLS to scan across all tenants.
    """

    def get_due_48h(self, db: Session) -> list[Appointment]:
        """Return scheduled appointments starting in [now+47h45m, now+48h], reminder not sent."""
        now = datetime.now(tz=timezone.utc)
        window_start = now + timedelta(hours=47, minutes=45)
        window_end = now + timedelta(hours=48)
        return (
            db.query(Appointment)
            .filter(
                Appointment.status == "scheduled",
                Appointment.reminder_sent_48h.is_(False),
                Appointment.scheduled_start >= window_start,
                Appointment.scheduled_start < window_end,
            )
            .all()
        )

    def get_due_2h(self, db: Session) -> list[Appointment]:
        """Return scheduled appointments starting in [now+1h45m, now+2h], reminder not sent."""
        now = datetime.now(tz=timezone.utc)
        window_start = now + timedelta(hours=1, minutes=45)
        window_end = now + timedelta(hours=2)
        return (
            db.query(Appointment)
            .filter(
                Appointment.status == "scheduled",
                Appointment.reminder_sent_2h.is_(False),
                Appointment.scheduled_start >= window_start,
                Appointment.scheduled_start < window_end,
            )
            .all()
        )

    def get_patient(self, db: Session, patient_id) -> Patient | None:
        return db.get(Patient, patient_id)

    def mark_48h_sent(self, db: Session, appt: Appointment) -> None:
        appt.reminder_sent_48h = True
        db.flush()

    def mark_2h_sent(self, db: Session, appt: Appointment) -> None:
        appt.reminder_sent_2h = True
        db.flush()


def run_reminder_check(
    session_factory,
    email_service: EmailService | None = None,
) -> None:
    """APScheduler entry point. Opens its own DB session (no tenant RLS context)."""
    if email_service is None:
        email_service = EmailService()

    svc = ReminderService()
    db = session_factory()
    try:
        for appt in svc.get_due_48h(db):
            patient = svc.get_patient(db, appt.patient_id)
            if patient and patient.email:
                try:
                    email_service.send_reminder(
                        to_email=patient.email,
                        patient_name=patient.full_name,
                        appointment_start=appt.scheduled_start,
                        hours_ahead=48,
                    )
                except Exception:
                    logger.exception("Failed to send 48h reminder for appt %s", appt.id)
            svc.mark_48h_sent(db, appt)

        for appt in svc.get_due_2h(db):
            patient = svc.get_patient(db, appt.patient_id)
            if patient and patient.email:
                try:
                    email_service.send_reminder(
                        to_email=patient.email,
                        patient_name=patient.full_name,
                        appointment_start=appt.scheduled_start,
                        hours_ahead=2,
                    )
                except Exception:
                    logger.exception("Failed to send 2h reminder for appt %s", appt.id)
            svc.mark_2h_sent(db, appt)

        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Reminder check failed")
    finally:
        db.close()