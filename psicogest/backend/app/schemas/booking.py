"""Pydantic schemas for public booking endpoints."""
from datetime import datetime
from pydantic import BaseModel, Field


class BookingInfo(BaseModel):
    tenant_name: str
    welcome_message: str
    session_duration_min: int
    slots: list[str]


class BookingRequestCreate(BaseModel):
    patient_name: str = Field(..., min_length=2, max_length=200)
    patient_email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    patient_phone: str | None = Field(None, max_length=20)
    session_type: str = Field("individual", pattern="^(individual|couple|family|followup)$")
    requested_start: datetime
    notes: str | None = Field(None, max_length=500)


class BookingRequestCreated(BaseModel):
    id: str
    status: str


class BookingRequestSummary(BaseModel):
    id: str
    patient_name: str
    patient_email: str
    patient_phone: str | None
    session_type: str
    requested_start: datetime
    requested_end: datetime
    status: str
    notes: str | None
    created_at: datetime
    registration_pending: bool = False
    registration_token_expires_at: datetime | None = None

    model_config = {"from_attributes": True}


# --- Patient registration via booking token ---

class RegistrationTokenInfo(BaseModel):
    """Returned by GET /registration/{token} to pre-fill the form."""
    patient_name: str
    patient_email: str
    psychologist_name: str
    requested_start: datetime
    session_type: str


class PatientRegistrationBody(BaseModel):
    doc_type: str = Field(..., pattern="^(CC|TI|CE|PA|RC|MS)$")
    doc_number: str = Field(..., min_length=4, max_length=20)
    birth_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    biological_sex: str = Field(..., pattern="^(M|F|I)$")
    phone: str = Field(..., min_length=7, max_length=20)


class PatientRegistrationResult(BaseModel):
    patient_name: str
    appointment_start: datetime
