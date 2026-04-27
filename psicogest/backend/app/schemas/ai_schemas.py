"""Pydantic schemas for AI module."""
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class AIConfigUpdate(BaseModel):
    """Schema for updating AI configuration."""

    provider: Literal["anthropic", "openai", "gemini"]
    model: str
    api_key: str


class AIConfigRead(BaseModel):
    """Schema for reading AI configuration."""

    provider: str | None
    model: str | None

    model_config = {"from_attributes": True}


class AIValidationResult(BaseModel):
    """Result of API key validation."""

    valid: bool
    message: str
    available_models: list[str] = []


class DiagnosisSuggestionInput(BaseModel):
    """Input context for diagnosis suggestion."""

    patient_id: uuid.UUID
    session_id: uuid.UUID | None = None
    clinical_record_summary: str
    recent_sessions_summary: str | None = None
    current_symptoms: list[str] = []
    session_notes: str | None = None


class DiagnosisCode(BaseModel):
    """A single diagnosis code suggestion."""

    code: str
    description: str
    confidence: float = Field(ge=0, le=1)


class DiagnosisSuggestionResponse(BaseModel):
    """Response from diagnosis suggestion."""

    id: uuid.UUID
    patient_id: uuid.UUID
    session_id: uuid.UUID | None
    suggestions: list[DiagnosisCode]
    accepted_codes: list[str] = []
    rejected_codes: list[str] = []
    model_version: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DiagnosisFeedback(BaseModel):
    """Feedback on diagnosis suggestions."""

    suggestion_id: uuid.UUID
    accepted_codes: list[str] = []
    rejected_codes: list[str] = []


class SessionSummaryInput(BaseModel):
    """Input for session summarization."""

    session_id: uuid.UUID


class SessionSummaryResponse(BaseModel):
    """Response from session summarization."""

    id: uuid.UUID
    session_id: uuid.UUID
    summary: str
    key_topics: list[str] = []
    model_version: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ClinicalRecordSummaryInput(BaseModel):
    """Input for clinical record summarization."""

    patient_id: uuid.UUID


class ClinicalRecordSummaryResponse(BaseModel):
    """Response from clinical record summarization."""

    patient_id: uuid.UUID
    summary: str
    key_aspects: list[str] = []
    recommendations: list[str] = []
    model_version: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentAnalysisInput(BaseModel):
    """Input for document analysis."""

    patient_id: uuid.UUID
    document_id: uuid.UUID


class DocumentAnalysisResponse(BaseModel):
    """Response from document analysis."""

    id: uuid.UUID
    document_id: uuid.UUID
    analysis: dict
    key_findings: list[str] = []
    model_version: str
    created_at: datetime

    model_config = {"from_attributes": True}


class FeatureToggle(BaseModel):
    """Schema for toggling a feature."""

    feature: str
    enabled: bool