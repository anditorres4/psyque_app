"""AI Module API routes."""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_tenant_db, TenantDB
from app.models.tenant import Tenant
from app.schemas.ai_schemas import (
    AIConfigUpdate,
    AIConfigRead,
    AIValidationResult,
    DiagnosisSuggestionInput,
    DiagnosisSuggestionResponse,
    DiagnosisFeedback,
    SessionSummaryInput,
    SessionSummaryResponse,
    ClinicalRecordSummaryInput,
    ClinicalRecordSummaryResponse,
    DocumentAnalysisInput,
    DocumentAnalysisResponse,
    FeatureToggle,
)
from app.services import ai_service
from app.services.session_service import SessionService, SessionNotFoundError
from app.services.patient_service import PatientService, PatientNotFoundError
from app.models.clinical_record import ClinicalRecord

router = APIRouter(prefix="/ai", tags=["AI"])


def _get_tenant_from_ctx(ctx: TenantDB) -> Tenant:
    """Get Tenant model from TenantDB context."""
    return ctx.db.query(Tenant).filter(Tenant.id == uuid.UUID(ctx.tenant.tenant_id)).first()


@router.get("/config", response_model=AIConfigRead)
def get_ai_config(ctx: Annotated[TenantDB, Depends(get_tenant_db)]):
    """Get current AI configuration."""
    tenant = _get_tenant_from_ctx(ctx)
    return {
        "provider": tenant.ai_provider,
        "model": tenant.ai_model,
    }


@router.put("/config", response_model=AIValidationResult)
def update_ai_config(
    config: AIConfigUpdate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
):
    """Update AI configuration and validate API key."""
    tenant = _get_tenant_from_ctx(ctx)
    success, message = ai_service.update_ai_config(
        ctx.db, tenant, config.provider, config.model, config.api_key
    )

    if not success:
        raise HTTPException(status_code=400, detail=message)

    return AIValidationResult(
        valid=True,
        message=message,
        available_models=[],
    )


@router.post("/validate", response_model=AIValidationResult)
def validate_ai_config(ctx: Annotated[TenantDB, Depends(get_tenant_db)]):
    """Validate current AI configuration."""
    tenant = _get_tenant_from_ctx(ctx)
    is_valid, message, available_models = ai_service.validate_ai_config(tenant)

    if not is_valid:
        raise HTTPException(status_code=503, detail=message)

    return AIValidationResult(
        valid=is_valid,
        message=message,
        available_models=available_models,
    )


@router.post("/features", status_code=204)
def toggle_feature(
    feature: FeatureToggle,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
):
    """Toggle an AI feature on/off."""
    if feature.feature not in ["ai_diagnosis", "ai_summaries", "ai_documents"]:
        raise HTTPException(
            status_code=400,
            detail="Feature inválida. Opciones: ai_diagnosis, ai_summaries, ai_documents",
        )

    tenant = _get_tenant_from_ctx(ctx)
    features = tenant.features or {}
    features[feature.feature] = feature.enabled
    tenant.features = features
    ctx.db.commit()

    return None


@router.get("/features")
def get_features(ctx: Annotated[TenantDB, Depends(get_tenant_db)]):
    """Get enabled AI features for the tenant."""
    tenant = _get_tenant_from_ctx(ctx)
    return tenant.features or {}


# === Diagnosis Endpoints ===

@router.post("/diagnosis/suggest", status_code=201)
def suggest_diagnosis(
    input_data: DiagnosisSuggestionInput,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
):
    """Generate diagnosis suggestions for a patient."""
    tenant = _get_tenant_from_ctx(ctx)

    if not ai_service.check_feature_enabled(tenant, "ai_diagnosis"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Feature de diagnóstico IA no disponible en tu plan",
        )

    if not tenant.ai_provider or not tenant.ai_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Configuración IA no completada. Por favor configura tu API key.",
        )

    patient_service = PatientService(ctx.db, ctx.tenant.tenant_id)
    try:
        patient_service.get_by_id(str(input_data.patient_id))
    except PatientNotFoundError:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    if input_data.session_id:
        session_service = SessionService(ctx.db, ctx.tenant.tenant_id)
        try:
            session_service.get_by_id(str(input_data.session_id))
        except SessionNotFoundError:
            raise HTTPException(status_code=404, detail="Sesión no encontrada")

    result = ai_service.generate_diagnosis_suggestion(
        ctx.db,
        tenant,
        input_data.patient_id,
        input_data.session_id,
        input_data.clinical_record_summary,
        input_data.recent_sessions_summary,
        input_data.current_symptoms,
        input_data.session_notes,
    )

    return result


@router.post("/diagnosis/feedback", status_code=204)
def submit_diagnosis_feedback(
    feedback: DiagnosisFeedback,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
):
    """Submit feedback on diagnosis suggestions (accepted/rejected codes)."""
    tenant = _get_tenant_from_ctx(ctx)

    if not ai_service.check_feature_enabled(tenant, "ai_diagnosis"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Feature de diagnóstico IA no disponible en tu plan",
        )

    success = ai_service.submit_diagnosis_feedback(
        ctx.db, tenant, feedback.suggestion_id, feedback.accepted_codes, feedback.rejected_codes
    )

    if not success:
        raise HTTPException(status_code=404, detail="Sugerencia no encontrada")

    return None


@router.get("/diagnosis/history/{patient_id}")
def get_diagnosis_history(
    patient_id: uuid.UUID,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
):
    """Get diagnosis suggestion history for a patient."""
    tenant = _get_tenant_from_ctx(ctx)

    if not ai_service.check_feature_enabled(tenant, "ai_diagnosis"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Feature de diagnóstico IA no disponible en tu plan",
        )

    patient_service = PatientService(ctx.db, ctx.tenant.tenant_id)
    try:
        patient_service.get_by_id(str(patient_id))
    except PatientNotFoundError:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    return ai_service.get_diagnosis_history(ctx.db, tenant, patient_id)


# === Session Summary Endpoints ===

@router.post("/summarize/session", status_code=201)
def summarize_session(
    input_data: SessionSummaryInput,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
):
    """Generate AI summary of a therapy session."""
    tenant = _get_tenant_from_ctx(ctx)

    if not ai_service.check_feature_enabled(tenant, "ai_summaries"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Feature de resúmenes IA no disponible en tu plan",
        )

    if not tenant.ai_provider or not tenant.ai_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Configuración IA no completada. Por favor configura tu API key.",
        )

    session_service = SessionService(ctx.db, ctx.tenant.tenant_id)
    try:
        session = session_service.get_by_id(str(input_data.session_id))
    except SessionNotFoundError:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    session_content = f"Motivo de consulta: {session.consultation_reason}\n\nIntervención: {session.intervention}\n\nEvolución: {session.evolution or 'Sin evolución registrada'}"

    return ai_service.generate_session_summary(
        ctx.db, tenant, input_data.session_id, session_content
    )


# === Clinical Record Summary Endpoints ===

@router.post("/summarize/clinical-record", status_code=201)
def summarize_clinical_record(
    input_data: ClinicalRecordSummaryInput,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
):
    """Generate AI summary of a clinical record."""
    tenant = _get_tenant_from_ctx(ctx)

    if not ai_service.check_feature_enabled(tenant, "ai_summaries"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Feature de resúmenes IA no disponible en tu plan",
        )

    if not tenant.ai_provider or not tenant.ai_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Configuración IA no completada. Por favor configura tu API key.",
        )

    patient_service = PatientService(ctx.db, ctx.tenant.tenant_id)
    try:
        patient = patient_service.get_by_id(str(input_data.patient_id))
    except PatientNotFoundError:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    clinical_record_text = ""
    
    clinical_record = ctx.db.query(ClinicalRecord).filter(
        ClinicalRecord.patient_id == input_data.patient_id,
        ClinicalRecord.tenant_id == uuid.UUID(ctx.tenant.tenant_id),
    ).first()

    if clinical_record:
        clinical_record_text = f"Motivo de consulta: {clinical_record.chief_complaint or 'No registrado'}\n\n"
        clinical_record_text += f"Problemas presentados: {clinical_record.presenting_problems or 'No registrado'}\n\n"
        clinical_record_text += f"Descripción de síntomas: {clinical_record.symptom_description or 'No registrado'}\n\n"
        clinical_record_text += f"Plan de tratamiento: {clinical_record.treatment_plan or 'No registrado'}\n\n"
        clinical_record_text += f"Objetivos terapéuticos: {clinical_record.therapeutic_goals or 'No registrado'}"
    else:
        clinical_record_text = "Sin historia clínica registrada"

    return ai_service.generate_clinical_record_summary(
        ctx.db, tenant, input_data.patient_id, clinical_record_text
    )


# === Document Analysis Endpoints ===

@router.post("/analyze/document", status_code=201)
def analyze_document(
    input_data: DocumentAnalysisInput,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
):
    """Analyze a clinical document using AI."""
    tenant = _get_tenant_from_ctx(ctx)

    if not ai_service.check_feature_enabled(tenant, "ai_documents"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Feature de análisis de documentos IA no disponible en tu plan",
        )

    if not tenant.ai_provider or not tenant.ai_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Configuración IA no completada. Por favor configura tu API key.",
        )

    from app.models.clinical_document import ClinicalDocument
    document = ctx.db.query(ClinicalDocument).filter(
        ClinicalDocument.id == input_data.document_id,
        ClinicalDocument.patient_id == input_data.patient_id,
        ClinicalDocument.tenant_id == uuid.UUID(ctx.tenant.tenant_id),
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    document_content = document.description or f"Documento: {document.filename} (Tipo: {document.document_type})"

    return ai_service.analyze_document(ctx.db, tenant, input_data.document_id, document_content)