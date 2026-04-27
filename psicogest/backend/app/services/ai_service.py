"""AI Service - Business logic for AI operations."""
import json
import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.tenant import Tenant
from app.models.ai_suggestion import AiDiagnosisSuggestion
from app.models.ai_session_summary import AiSessionSummary
from app.models.ai_clinical_record_summary import AiClinicalRecordSummary
from app.models.ai_document_analysis import AiDocumentAnalysis
from app.services.ai.providers import get_provider, AIResponse


DIAGNOSIS_PROMPT = """Eres un asistente de diagnóstico psicológico clínico. Basándote en la siguiente información del paciente, sugiere códigos CIE-10 relevantes.

INFORMACIÓN DEL PACIENTE:
{clinical_record_summary}

{recent_sessions}

SÍNTOMAS ACTUALES:
{symptoms}

{notes}

INSTRUCCIONES:
1. Analiza la información proporcionada
2. Sugiere hasta 5 códigos CIE-10 que mejor se ajusten al cuadro clínico
3. Para cada código, proporciona:
   - Código CIE-10
   - Descripción breve
   - Nivel de confianza (0.0 a 1.0)
4. La respuesta debe ser en español
5. Formatea la respuesta como JSON con el siguiente formato:
{{
  "suggestions": [
    {{"code": "F32.0", "description": "Episodio depresivo leve", "confidence": 0.85}}
  ]
}}
"""

SESSION_SUMMARY_PROMPT = """Eres un asistente clínico que resume sesiones de terapia.

SESIÓN:
{session_content}

INSTRUCCIONES:
1. Proporciona un resumen estructurado de la sesión en español (máximo 300 palabras)
2. Identifica los temas principales tratados
3. Incluye notas relevantes para el historial clínico
4. Formatea la respuesta como JSON:
{{
  "summary": "...",
  "key_topics": ["tema1", "tema2", ...]
}}
"""

CLINICAL_RECORD_SUMMARY_PROMPT = """Eres un asistente clínico que resume historias clínicas completas.

HISTORIA CLÍNICA:
{clinical_record}

INSTRUCCIONES:
1. Proporciona un resumen comprensivo de la historia clínica (máximo 500 palabras)
2. Identifica los aspectos clave: motivo de consulta, antecedentes, evolución, tratamientos previos
3. Sugiere recomendaciones clínicas relevantes
4. La respuesta debe ser en español
5. Formatea la respuesta como JSON:
{{
  "summary": "...",
  "key_aspects": ["aspecto1", "aspecto2", ...],
  "recommendations": ["recomendación1", ...]
}}
"""

DOCUMENT_ANALYSIS_PROMPT = """Eres un asistente clínico que analiza documentos médicos y psicológicos.

DOCUMENTO:
{document_content}

INSTRUCCIONES:
1. Analiza el documento y proporciona insights relevantes
2. Identifica información clave: fechas, diagnósticos, medicamentos, recomendaciones
3. Proporciona hallazgos importantes para el contexto clínico
4. La respuesta debe ser en español
5. Formatea la respuesta como JSON:
{{
  "analysis": {{"campo1": "valor1", ...}},
  "key_findings": ["hallazgo1", "hallazgo2", ...]
}}
"""


def check_feature_enabled(tenant: Tenant, feature: str) -> bool:
    """Check if a feature is enabled for the tenant."""
    features = tenant.features or {}
    return features.get(feature, False)


def get_ai_config(tenant: Tenant) -> dict:
    """Get AI configuration from tenant."""
    return {
        "provider": tenant.ai_provider,
        "model": tenant.ai_model,
        "api_key": tenant.ai_api_key,
    }


def validate_ai_config(tenant: Tenant) -> tuple[bool, str, list[str]]:
    """Validate tenant's AI configuration.
    
    Returns:
        Tuple of (is_valid, message, available_models)
    """
    config = get_ai_config(tenant)
    
    if not config["provider"] or not config["api_key"]:
        return False, "Configuración IA incompleta. Por favor configura el proveedor y API key.", []
    
    try:
        provider = get_provider(config["provider"], config["api_key"])
        is_valid, message = provider.validate_key(config["api_key"])
        
        if is_valid:
            return True, "Configuración válida", provider.available_models
        
        return False, message, []
    except Exception as e:
        return False, f"Error al validar configuración: {str(e)}", []


def update_ai_config(
    db: Session, tenant: Tenant, provider: str, model: str, api_key: str
) -> tuple[bool, str]:
    """Update AI configuration and validate.
    
    Returns:
        Tuple of (success, message)
    """
    try:
        ai_provider = get_provider(provider, api_key)
        is_valid, message = ai_provider.validate_key(api_key)
        
        if not is_valid:
            return False, message
        
        tenant.ai_provider = provider
        tenant.ai_model = model
        tenant.ai_api_key = api_key
        db.commit()
        
        return True, "Configuración guardada correctamente"
    except Exception as e:
        db.rollback()
        return False, f"Error al guardar configuración: {str(e)}"


def generate_diagnosis_suggestion(
    db: Session,
    tenant: Tenant,
    patient_id: uuid.UUID,
    session_id: uuid.UUID | None,
    clinical_record_summary: str,
    recent_sessions_summary: str | None,
    current_symptoms: list[str],
    session_notes: str | None,
) -> dict:
    """Generate diagnosis suggestions using AI."""
    config = get_ai_config(tenant)
    provider = get_provider(config["provider"], config["api_key"])
    
    recent_sessions = ""
    if recent_sessions_summary:
        recent_sessions = f"SESIONES RECIENTES:\n{recent_sessions_summary}\n"
    
    symptoms = ", ".join(current_symptoms) if current_symptoms else "No especificados"
    
    notes = ""
    if session_notes:
        notes = f"NOTAS DE LA SESIÓN ACTUAL:\n{session_notes}"
    
    prompt = DIAGNOSIS_PROMPT.format(
        clinical_record_summary=clinical_record_summary,
        recent_sessions=recent_sessions,
        symptoms=symptoms,
        notes=notes,
    )
    
    response = provider.generate(prompt, config["model"])
    
    try:
        data = json.loads(response.content)
        suggestions = data.get("suggestions", [])
    except json.JSONDecodeError:
        suggestions = [{"code": "ERROR", "description": response.content[:200], "confidence": 0}]
    
    suggestion = AiDiagnosisSuggestion(
        tenant_id=tenant.id,
        patient_id=patient_id,
        session_id=session_id,
        input_context={
            "clinical_record_summary": clinical_record_summary,
            "recent_sessions_summary": recent_sessions_summary,
            "current_symptoms": current_symptoms,
            "session_notes": session_notes,
        },
        suggestions=suggestions,
        model_version=config["model"],
    )
    
    db.add(suggestion)
    db.commit()
    db.refresh(suggestion)
    
    return {
        "id": suggestion.id,
        "patient_id": suggestion.patient_id,
        "session_id": suggestion.session_id,
        "suggestions": suggestion.suggestions,
        "model_version": suggestion.model_version,
        "created_at": suggestion.created_at,
    }


def submit_diagnosis_feedback(
    db: Session,
    tenant: Tenant,
    suggestion_id: uuid.UUID,
    accepted_codes: list[str],
    rejected_codes: list[str],
) -> bool:
    """Submit feedback on diagnosis suggestions."""
    suggestion = (
        db.query(AiDiagnosisSuggestion)
        .filter(
            AiDiagnosisSuggestion.id == suggestion_id,
            AiDiagnosisSuggestion.tenant_id == tenant.id,
        )
        .first()
    )
    
    if not suggestion:
        return False
    
    suggestion.accepted_codes = accepted_codes
    suggestion.rejected_codes = rejected_codes
    db.commit()
    
    return True


def get_diagnosis_history(
    db: Session, tenant: Tenant, patient_id: uuid.UUID
) -> list[dict]:
    """Get diagnosis suggestion history for a patient."""
    suggestions = (
        db.query(AiDiagnosisSuggestion)
        .filter(
            AiDiagnosisSuggestion.tenant_id == tenant.id,
            AiDiagnosisSuggestion.patient_id == patient_id,
        )
        .order_by(AiDiagnosisSuggestion.created_at.desc())
        .all()
    )
    
    return [
        {
            "id": s.id,
            "patient_id": s.patient_id,
            "session_id": s.session_id,
            "suggestions": s.suggestions,
            "accepted_codes": s.accepted_codes,
            "rejected_codes": s.rejected_codes,
            "model_version": s.model_version,
            "created_at": s.created_at,
        }
        for s in suggestions
    ]


def generate_session_summary(
    db: Session,
    tenant: Tenant,
    session_id: uuid.UUID,
    session_content: str,
) -> dict:
    """Generate AI summary of a therapy session."""
    config = get_ai_config(tenant)
    provider = get_provider(config["provider"], config["api_key"])
    
    prompt = SESSION_SUMMARY_PROMPT.format(session_content=session_content)
    response = provider.generate(prompt, config["model"])
    
    try:
        data = json.loads(response.content)
        summary = data.get("summary", "")
        key_topics = data.get("key_topics", [])
    except json.JSONDecodeError:
        summary = response.content
        key_topics = []
    
    ai_summary = AiSessionSummary(
        tenant_id=tenant.id,
        session_id=session_id,
        summary=summary,
        key_topics=key_topics,
        model_version=config["model"],
    )
    
    db.add(ai_summary)
    db.commit()
    db.refresh(ai_summary)
    
    return {
        "id": ai_summary.id,
        "session_id": ai_summary.session_id,
        "summary": ai_summary.summary,
        "key_topics": ai_summary.key_topics,
        "model_version": ai_summary.model_version,
        "created_at": ai_summary.created_at,
    }


def generate_clinical_record_summary(
    db: Session,
    tenant: Tenant,
    patient_id: uuid.UUID,
    clinical_record: str,
) -> dict:
    """Generate AI summary of a clinical record."""
    config = get_ai_config(tenant)
    provider = get_provider(config["provider"], config["api_key"])
    
    prompt = CLINICAL_RECORD_SUMMARY_PROMPT.format(clinical_record=clinical_record)
    response = provider.generate(prompt, config["model"])
    
    try:
        data = json.loads(response.content)
        summary = data.get("summary", "")
        key_aspects = data.get("key_aspects", [])
        recommendations = data.get("recommendations", [])
    except json.JSONDecodeError:
        summary = response.content
        key_aspects = []
        recommendations = []
    
    ai_summary = AiClinicalRecordSummary(
        tenant_id=tenant.id,
        patient_id=patient_id,
        summary=summary,
        key_aspects=key_aspects,
        recommendations=recommendations,
        model_version=config["model"],
    )
    
    db.add(ai_summary)
    db.commit()
    db.refresh(ai_summary)
    
    return {
        "id": ai_summary.id,
        "patient_id": ai_summary.patient_id,
        "summary": ai_summary.summary,
        "key_aspects": ai_summary.key_aspects,
        "recommendations": ai_summary.recommendations,
        "model_version": ai_summary.model_version,
        "created_at": ai_summary.created_at,
    }


def analyze_document(
    db: Session,
    tenant: Tenant,
    document_id: uuid.UUID,
    document_content: str,
) -> dict:
    """Analyze a clinical document using AI."""
    config = get_ai_config(tenant)
    provider = get_provider(config["provider"], config["api_key"])
    
    prompt = DOCUMENT_ANALYSIS_PROMPT.format(document_content=document_content)
    response = provider.generate(prompt, config["model"])
    
    try:
        data = json.loads(response.content)
        analysis = data.get("analysis", {})
        key_findings = data.get("key_findings", [])
    except json.JSONDecodeError:
        analysis = {"raw": response.content[:500]}
        key_findings = []
    
    ai_analysis = AiDocumentAnalysis(
        tenant_id=tenant.id,
        document_id=document_id,
        analysis=analysis,
        key_findings=key_findings,
        model_version=config["model"],
    )
    
    db.add(ai_analysis)
    db.commit()
    db.refresh(ai_analysis)
    
    return {
        "id": ai_analysis.id,
        "document_id": ai_analysis.document_id,
        "analysis": ai_analysis.analysis,
        "key_findings": ai_analysis.key_findings,
        "model_version": ai_analysis.model_version,
        "created_at": ai_analysis.created_at,
    }