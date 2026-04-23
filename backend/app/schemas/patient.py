"""Pydantic schemas for patient endpoints."""
import re
import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------------------------------------------------------------------------
# Enums as Literals for strict validation
# ---------------------------------------------------------------------------
DocType = Literal["CC", "TI", "CE", "PA", "RC", "MS"]
BiologicalSex = Literal["M", "F", "I"]
MaritalStatus = Literal["S", "C", "U", "D", "V", "SE"]
Zone = Literal["U", "R"]
PayerType = Literal["PA", "CC", "SS", "PE", "SE"]

_STRIP_RE = re.compile(r"[\x00-\x1f\x7f]")


def _sanitize(s: str) -> str:
    """Strip control characters; let UTF-8 through."""
    return _STRIP_RE.sub("", s)


# ---------------------------------------------------------------------------
# PatientCreate — used in POST /patients
# ---------------------------------------------------------------------------
class PatientCreate(BaseModel):
    doc_type: DocType
    doc_number: str = Field(..., min_length=4, max_length=20)
    first_surname: str = Field(..., min_length=1, max_length=100)
    second_surname: str | None = Field(None, max_length=100)
    first_name: str = Field(..., min_length=1, max_length=100)
    second_name: str | None = Field(None, max_length=100)
    birth_date: date
    biological_sex: BiologicalSex
    gender_identity: str | None = Field(None, max_length=50)
    marital_status: MaritalStatus
    occupation: str = Field(..., min_length=1, max_length=150)
    address: str = Field(..., min_length=5)
    municipality_dane: str = Field(..., min_length=5, max_length=10)
    zone: Zone
    phone: str = Field(..., min_length=7, max_length=20)
    email: EmailStr | None = None
    emergency_contact_name: str | None = Field(None, max_length=200)
    emergency_contact_phone: str | None = Field(None, max_length=20)
    payer_type: PayerType
    eps_name: str | None = Field(None, max_length=200)
    eps_code: str | None = Field(None, max_length=10)
    authorization_number: str | None = Field(None, max_length=30)
    consent_accepted: bool = Field(
        ..., description="Paciente aceptó el tratamiento de datos (Ley 1581/2012)"
    )

    @field_validator(
        "doc_number", "first_surname", "first_name",
        "occupation", "address", "phone",
        "emergency_contact_name", "emergency_contact_phone",
        "eps_name", "eps_code", "authorization_number",
    )
    @classmethod
    def _strip_control(cls, v: str) -> str:
        if isinstance(v, str):
            return _sanitize(v)
        return v

    @field_validator("consent_accepted")
    @classmethod
    def consent_must_be_true(cls, v: bool) -> bool:
        """Consent must be explicitly accepted — cannot create patient without it."""
        if not v:
            raise ValueError(
                "El consentimiento informado es obligatorio para registrar el paciente (Ley 1581/2012)."
            )
        return v

    @field_validator("birth_date")
    @classmethod
    def birth_date_in_past(cls, v: date) -> date:
        from datetime import date as date_type
        if v >= date_type.today():
            raise ValueError("La fecha de nacimiento debe ser en el pasado.")
        return v


# ---------------------------------------------------------------------------
# PatientUpdate — used in PUT /patients/{id}
# All fields optional — only provided fields are updated
# ---------------------------------------------------------------------------
class PatientUpdate(BaseModel):
    first_surname: str | None = Field(None, min_length=1, max_length=100)
    second_surname: str | None = Field(None, max_length=100)
    first_name: str | None = Field(None, min_length=1, max_length=100)
    second_name: str | None = Field(None, max_length=100)
    gender_identity: str | None = Field(None, max_length=50)
    marital_status: MaritalStatus | None = None
    occupation: str | None = Field(None, min_length=1, max_length=150)
    address: str | None = Field(None, min_length=5)
    municipality_dane: str | None = Field(None, min_length=5, max_length=10)
    zone: Zone | None = None
    phone: str | None = Field(None, min_length=7, max_length=20)
    email: EmailStr | None = None
    emergency_contact_name: str | None = Field(None, max_length=200)
    emergency_contact_phone: str | None = Field(None, max_length=20)
    payer_type: PayerType | None = None
    eps_name: str | None = Field(None, max_length=200)
    eps_code: str | None = Field(None, max_length=10)
    authorization_number: str | None = Field(None, max_length=30)
    current_diagnosis_cie11: str | None = Field(None, max_length=20)
    is_active: bool | None = None


# ---------------------------------------------------------------------------
# PatientSummary — used in GET /patients (list) and global search
# PRD §8.4: PatientCard fields
# ---------------------------------------------------------------------------
class PatientSummary(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    hc_number: str
    first_surname: str
    second_surname: str | None
    first_name: str
    second_name: str | None
    doc_type: str
    doc_number: str
    current_diagnosis_cie11: str | None
    payer_type: str
    is_active: bool
    created_at: datetime


# ---------------------------------------------------------------------------
# PatientDetail — used in GET /patients/{id}
# Full record for profile page
# ---------------------------------------------------------------------------
class PatientDetail(PatientSummary):
    birth_date: date
    biological_sex: str
    gender_identity: str | None
    marital_status: str
    occupation: str
    address: str
    municipality_dane: str
    zone: str
    phone: str
    email: str | None
    emergency_contact_name: str | None
    emergency_contact_phone: str | None
    eps_name: str | None
    eps_code: str | None
    authorization_number: str | None
    consent_signed_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# PaginatedPatients — used in GET /patients response
# ---------------------------------------------------------------------------
class PaginatedPatients(BaseModel):
    items: list[PatientSummary]
    total: int
    page: int
    page_size: int
    pages: int
