"""Pydantic schemas for reports endpoints."""
from pydantic import BaseModel


class RevenueReportItem(BaseModel):
    month: str
    revenue: int


class AttendanceReportItem(BaseModel):
    month: str
    completed: int
    cancelled: int
    noshow: int


class SessionTypeReportItem(BaseModel):
    cups_code: str
    count: int


class NewPatientsReportItem(BaseModel):
    month: str
    count: int


class DashboardSummary(BaseModel):
    total_revenue: int
    total_sessions: int
    attendance_rate: float


class RevenueReportResponse(BaseModel):
    data: list[RevenueReportItem]
    summary: DashboardSummary


class AttendanceReportResponse(BaseModel):
    data: list[AttendanceReportItem]


class SessionTypeReportResponse(BaseModel):
    data: list[SessionTypeReportItem]


class NewPatientsReportResponse(BaseModel):
    data: list[NewPatientsReportItem]


class TopDiagnosisItem(BaseModel):
    diagnosis_cie11: str
    diagnosis_description: str
    count: int


class TopDiagnosesResponse(BaseModel):
    data: list[TopDiagnosisItem]
    months: int