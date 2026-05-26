"""Dashboard stats for the authenticated tenant."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import and_, case, func
from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.schemas.appointment import AppointmentSummary

BOGOTA_TZ = ZoneInfo("America/Bogota")


class DashboardService:
    """Computes dashboard metrics for a single tenant."""

    def __init__(self, db: Session, tenant_id: str) -> None:
        self.db = db
        self.tenant_id = uuid.UUID(tenant_id)

    def get_stats(self) -> dict:
        """Return appointments_today, pending_to_close, attendance_rate_30d, upcoming."""
        now_utc = datetime.now(tz=timezone.utc)

        # "Today" computed in Colombia time (UTC-5, no DST)
        now_bogota = now_utc.astimezone(BOGOTA_TZ)
        today_start = now_bogota.replace(
            hour=0, minute=0, second=0, microsecond=0
        ).astimezone(timezone.utc)
        today_end = today_start + timedelta(days=1)

        thirty_days_ago = now_utc - timedelta(days=30)

        # Single aggregated query replacing 4 separate COUNTs (PERF-M6)
        row = (
            self.db.query(
                func.sum(
                    case(
                        (
                            and_(
                                Appointment.status == "scheduled",
                                Appointment.scheduled_start >= today_start,
                                Appointment.scheduled_start < today_end,
                            ),
                            1,
                        ),
                        else_=0,
                    )
                ).label("appointments_today"),
                func.sum(
                    case(
                        (
                            and_(
                                Appointment.status == "scheduled",
                                Appointment.scheduled_end < now_utc,
                            ),
                            1,
                        ),
                        else_=0,
                    )
                ).label("pending_to_close"),
                func.sum(
                    case(
                        (
                            and_(
                                Appointment.status == "completed",
                                Appointment.scheduled_start >= thirty_days_ago,
                            ),
                            1,
                        ),
                        else_=0,
                    )
                ).label("completed_30d"),
                func.sum(
                    case(
                        (
                            and_(
                                Appointment.status == "noshow",
                                Appointment.scheduled_start >= thirty_days_ago,
                            ),
                            1,
                        ),
                        else_=0,
                    )
                ).label("noshow_30d"),
            )
            .filter(Appointment.tenant_id == self.tenant_id)
            .one()
        )

        appointments_today = row.appointments_today or 0
        pending_to_close = row.pending_to_close or 0
        completed = row.completed_30d or 0
        noshow = row.noshow_30d or 0

        total_attended = completed + noshow
        attendance_rate = (
            round(completed / total_attended * 100, 1) if total_attended > 0 else None
        )

        upcoming = (
            self.db.query(Appointment)
            .filter(
                Appointment.tenant_id == self.tenant_id,
                Appointment.status == "scheduled",
                Appointment.scheduled_start >= now_utc,
            )
            .order_by(Appointment.scheduled_start)
            .limit(5)
            .all()
        )

        return {
            "appointments_today": appointments_today,
            "pending_to_close": pending_to_close,
            "attendance_rate_30d": attendance_rate,
            "upcoming": [AppointmentSummary.model_validate(a) for a in upcoming],
        }