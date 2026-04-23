"""Pydantic schema for dashboard stats response."""
from pydantic import BaseModel

from app.schemas.appointment import AppointmentSummary


class DashboardStats(BaseModel):
    appointments_today: int
    pending_to_close: int
    attendance_rate_30d: float | None
    upcoming: list[AppointmentSummary]