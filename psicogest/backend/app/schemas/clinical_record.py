"""Pydantic schemas for ClinicalRecord endpoints."""
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AntecedentesBlock(BaseModel):
    items: list[str] = []
    notas: str = ""


class ClinicalRecordUpsert(BaseModel):
    chief_complaint: str | None = None
    antecedentes_personales: AntecedentesBlock | None = None
    antecedentes_familiares: AntecedentesBlock | None = None
    antecedentes_medicos: AntecedentesBlock | None = None
    antecedentes_psicologicos: AntecedentesBlock | None = None
    initial_diagnosis_cie11: str | None = None
    initial_diagnosis_description: str | None = None
    treatment_plan: str | None = None
    therapeutic_goals: str | None = None


class ClinicalRecordDetail(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    patient_id: uuid.UUID
    chief_complaint: str | None
    antecedentes_personales: Any | None
    antecedentes_familiares: Any | None
    antecedentes_medicos: Any | None
    antecedentes_psicologicos: Any | None
    initial_diagnosis_cie11: str | None
    initial_diagnosis_description: str | None
    treatment_plan: str | None
    therapeutic_goals: str | None
    created_at: datetime
    updated_at: datetime