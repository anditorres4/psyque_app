"""Tests for DocumentService — upload validation (size, MIME type)."""
import uuid
from unittest.mock import patch, MagicMock

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.models.clinical_document import ClinicalDocument
from app.services.document_service import DocumentService, DocumentNotFoundError


TENANT_ID = str(uuid.uuid4())
PATIENT_ID = str(uuid.uuid4())
DOC_SERVICE_MAX_SIZE = 10 * 1024 * 1024  # 10 MB


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    ClinicalDocument.__table__.create(eng, checkfirst=True)
    return eng


@pytest.fixture
def db(engine):
    with engine.connect() as conn:
        conn.execute(text("PRAGMA journal_mode=WAL"))
        with Session(conn) as session:
            yield session
            session.rollback()


@pytest.fixture
def svc(db):
    return DocumentService(db, TENANT_ID)


# ---- File size validation ----

@patch("app.services.document_service.settings")
def test_upload_rejects_oversized_file(mock_settings, svc, db):
    mock_settings.supabase_url = "https://test.supabase.co"
    mock_settings.supabase_service_key = "test-key"
    with patch.object(svc, "_upload_to_storage"):
        mock_patient = MagicMock()
        mock_patient.tenant_id = svc._tenant_id
        with patch.object(svc.db, "get", return_value=mock_patient):
            with pytest.raises(ValueError, match="excede"):
                svc.upload(
                    patient_id=PATIENT_ID,
                    file_content=b"\x00",
                    filename="test.pdf",
                    content_type="application/pdf",
                    file_size=DOC_SERVICE_MAX_SIZE + 1,
                    document_type="consent",
                )


@patch("app.services.document_service.settings")
def test_upload_accepts_file_at_max_size(mock_settings, svc, db):
    mock_settings.supabase_url = "https://test.supabase.co"
    mock_settings.supabase_service_key = "test-key"
    with patch.object(svc, "_upload_to_storage"):
        mock_patient = MagicMock()
        mock_patient.tenant_id = svc._tenant_id
        with patch.object(svc.db, "get", return_value=mock_patient):
            doc = svc.upload(
                patient_id=PATIENT_ID,
                file_content=b"\x00" * DOC_SERVICE_MAX_SIZE,
                filename="test.pdf",
                content_type="application/pdf",
                file_size=DOC_SERVICE_MAX_SIZE,
                document_type="consent",
            )
            assert doc.id is not None


# ---- MIME type validation ----

@pytest.mark.parametrize(
    "content_type",
    [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
)
@patch("app.services.document_service.settings")
def test_upload_accepts_allowed_mime_types(mock_settings, svc, db, content_type):
    mock_settings.supabase_url = "https://test.supabase.co"
    mock_settings.supabase_service_key = "test-key"
    with patch.object(svc, "_upload_to_storage"):
        mock_patient = MagicMock()
        mock_patient.tenant_id = svc._tenant_id
        with patch.object(svc.db, "get", return_value=mock_patient):
            doc = svc.upload(
                patient_id=PATIENT_ID,
                file_content=b"fake content",
                filename="test",
                content_type=content_type,
                file_size=100,
                document_type="consent",
            )
            assert doc.id is not None


@pytest.mark.parametrize(
    "content_type",
    [
        "text/plain",
        "application/javascript",
        "text/html",
        "application/x-msdownload",
        "image/gif",
        "application/zip",
    ],
)
@patch("app.services.document_service.settings")
def test_upload_rejects_disallowed_mime_types(mock_settings, svc, db, content_type):
    mock_settings.supabase_url = "https://test.supabase.co"
    mock_settings.supabase_service_key = "test-key"
    with patch.object(svc, "_upload_to_storage"):
        mock_patient = MagicMock()
        mock_patient.tenant_id = svc._tenant_id
        with patch.object(svc.db, "get", return_value=mock_patient):
            with pytest.raises(ValueError, match="Tipo de archivo no permitido"):
                svc.upload(
                    patient_id=PATIENT_ID,
                    file_content=b"fake content",
                    filename="test.txt",
                    content_type=content_type,
                    file_size=100,
                    document_type="consent",
                )


# ---- Tenant isolation ----

@patch("app.services.document_service.settings")
def test_upload_raises_if_patient_belongs_to_other_tenant(mock_settings, db):
    mock_settings.supabase_url = "https://test.supabase.co"
    mock_settings.supabase_service_key = "test-key"
    other_tenant = str(uuid.uuid4())
    svc = DocumentService(db, other_tenant)
    mock_patient = MagicMock()
    mock_patient.tenant_id = uuid.UUID(TENANT_ID)  # belongs to TENANT_ID
    with patch.object(svc, "_upload_to_storage"):
        with patch.object(svc.db, "get", return_value=mock_patient):
            with pytest.raises(DocumentNotFoundError, match="no encontrado"):
                svc.upload(
                    patient_id=PATIENT_ID,
                    file_content=b"test",
                    filename="test.pdf",
                    content_type="application/pdf",
                    file_size=4,
                    document_type="consent",
                )


@patch("app.services.document_service.settings")
def test_upload_raises_if_patient_not_found(mock_settings, svc, db):
    mock_settings.supabase_url = "https://test.supabase.co"
    mock_settings.supabase_service_key = "test-key"
    with patch.object(svc, "_upload_to_storage"):
        with patch.object(svc.db, "get", return_value=None):
            with pytest.raises(DocumentNotFoundError):
                svc.upload(
                    patient_id=PATIENT_ID,
                    file_content=b"test",
                    filename="test.pdf",
                    content_type="application/pdf",
                    file_size=4,
                    document_type="consent",
                )