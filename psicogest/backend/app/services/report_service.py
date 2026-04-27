"""Report service — analytics and aggregation queries."""
import uuid
from datetime import datetime, timedelta
from sqlalchemy import func, extract, case, Integer
from sqlalchemy.orm import Session as DBSession

from app.models.session import Session
from app.models.appointment import Appointment
from app.models.patient import Patient


class ReportService:
    def __init__(self, db: DBSession, tenant_id: str) -> None:
        self.db = db
        self._tenant_id = uuid.UUID(tenant_id)

    def revenue_report(self, months: int = 12) -> dict:
        """Revenue report from signed sessions."""
        start_date = datetime.now() - timedelta(days=months * 30)
        
        results = (
            self.db.query(
                func.to_char(Session.actual_start, "YYYY-MM").label("month"),
                func.sum(
                    case((Session.status == "signed", Session.session_fee), else_=0)
                ).label("revenue"),
            )
            .filter(
                Session.tenant_id == self._tenant_id,
                Session.status == "signed",
                Session.actual_start >= start_date,
            )
            .group_by(func.to_char(Session.actual_start, "YYYY-MM"))
            .order_by(func.to_char(Session.actual_start, "YYYY-MM"))
            .all()
        )
        
        data = [{"month": r[0] or "", "revenue": r[1] or 0} for r in results]
        total_revenue = sum(r["revenue"] for r in data)
        
        total_sessions = (
            self.db.query(func.count(Session.id))
            .filter(
                Session.tenant_id == self._tenant_id,
                Session.status == "signed",
                Session.actual_start >= start_date,
            )
            .scalar() or 0
        )
        
        return {
            "data": data,
            "summary": {
                "total_revenue": total_revenue,
                "total_sessions": total_sessions,
                "attendance_rate": 0.0,
            }
        }

    def attendance_report(self, months: int = 12) -> dict:
        """Attendance report by appointment status."""
        start_date = datetime.now() - timedelta(days=months * 30)
        
        results = (
            self.db.query(
                func.to_char(Appointment.scheduled_start, "YYYY-MM").label("month"),
                func.sum(case((Appointment.status == "completed", 1), else_=0)).label("completed"),
                func.sum(case((Appointment.status == "cancelled", 1), else_=0)).label("cancelled"),
                func.sum(case((Appointment.status == "noshow", 1), else_=0)).label("noshow"),
            )
            .filter(
                Appointment.tenant_id == self._tenant_id,
                Appointment.scheduled_start >= start_date,
            )
            .group_by(func.to_char(Appointment.scheduled_start, "YYYY-MM"))
            .order_by(func.to_char(Appointment.scheduled_start, "YYYY-MM"))
            .all()
        )
        
        data = [
            {"month": r[0], "completed": r[1] or 0, "cancelled": r[2] or 0, "noshow": r[3] or 0}
            for r in results
        ]
        
        return {"data": data}

    def session_type_report(self, months: int = 12) -> dict:
        """Session types grouped by CUPS code."""
        start_date = datetime.now() - timedelta(days=months * 30)
        
        results = (
            self.db.query(
                Session.cups_code,
                func.count(Session.id).label("count"),
            )
            .filter(
                Session.tenant_id == self._tenant_id,
                Session.status == "signed",
                Session.actual_start >= start_date,
            )
            .group_by(Session.cups_code)
            .order_by(func.count(Session.id).desc())
            .all()
        )
        
        data = [{"cups_code": r[0], "count": r[1]} for r in results]
        
        return {"data": data}

    def new_patients_report(self, months: int = 12) -> dict:
        """New patients by month."""
        start_date = datetime.now() - timedelta(days=months * 30)
        
        results = (
            self.db.query(
                func.to_char(Patient.created_at, "YYYY-MM").label("month"),
                func.count(Patient.id).label("count"),
            )
            .filter(
                Patient.tenant_id == self._tenant_id,
                Patient.created_at >= start_date,
            )
            .group_by(func.to_char(Patient.created_at, "YYYY-MM"))
            .order_by(func.to_char(Patient.created_at, "YYYY-MM"))
            .all()
        )
        
        data = [{"month": r[0], "count": r[1]} for r in results]
        
        return {"data": data}

    def dashboard_summary(self, months: int = 12) -> dict:
        """Dashboard summary cards."""
        start_date = datetime.now() - timedelta(days=months * 30)
        
        total_revenue = (
            self.db.query(func.sum(Session.session_fee))
            .filter(
                Session.tenant_id == self._tenant_id,
                Session.status == "signed",
                Session.actual_start >= start_date,
            )
            .scalar() or 0
        )
        
        total_sessions = (
            self.db.query(func.count(Session.id))
            .filter(
                Session.tenant_id == self._tenant_id,
                Session.status == "signed",
                Session.actual_start >= start_date,
            )
            .scalar() or 0
        )
        
        total_appointments = (
            self.db.query(func.count(Appointment.id))
            .filter(
                Appointment.tenant_id == self._tenant_id,
                Appointment.scheduled_start >= start_date,
            )
            .scalar() or 0
        )
        
        completed = (
            self.db.query(func.count(Appointment.id))
            .filter(
                Appointment.tenant_id == self._tenant_id,
                Appointment.status == "completed",
                Appointment.scheduled_start >= start_date,
            )
            .scalar() or 0
        )
        
        attendance_rate = (completed / total_appointments * 100) if total_appointments > 0 else 0.0
        
        return {
            "total_revenue": total_revenue,
            "total_sessions": total_sessions,
            "attendance_rate": round(attendance_rate, 1),
        }

    def top_diagnoses(self, months: int = 3, limit: int = 10) -> dict:
        """Top N diagnoses by frequency in signed sessions."""
        start_date = datetime.now() - timedelta(days=months * 30)
        results = (
            self.db.query(
                Session.diagnosis_cie11,
                Session.diagnosis_description,
                func.count(Session.id).label("count"),
            )
            .filter(
                Session.tenant_id == self._tenant_id,
                Session.status == "signed",
                Session.actual_start >= start_date,
                Session.diagnosis_cie11 != "",
            )
            .group_by(Session.diagnosis_cie11, Session.diagnosis_description)
            .order_by(func.count(Session.id).desc())
            .limit(limit)
            .all()
        )
        return {
            "data": [
                {
                    "diagnosis_cie11": r[0],
                    "diagnosis_description": r[1],
                    "count": r[2],
                }
                for r in results
            ],
            "months": months,
        }