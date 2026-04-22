"""Document service — upload, download, delete clinical documents."""
import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.models.clinical_document import ClinicalDocument
from app.models.patient import Patient
from app.core.config import settings


class DocumentNotFoundError(Exception):
    pass


class DocumentService:
    STORAGE_BUCKET = "patient-documents"
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
    ALLOWED_CONTENT_TYPES = {
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }

    def __init__(self, db: DBSession, tenant_id: str) -> None:
        self.db = db
        self._tenant_id = uuid.UUID(tenant_id)
        self._supabase_url = settings.supabase_url
        self._supabase_key = settings.supabase_service_key

    def list_by_patient(self, patient_id: str) -> list[ClinicalDocument]:
        """List all documents for a patient."""
        return list(
            self.db.execute(
                select(ClinicalDocument)
                .where(ClinicalDocument.tenant_id == self._tenant_id)
                .where(ClinicalDocument.patient_id == uuid.UUID(patient_id))
                .order_by(ClinicalDocument.created_at.desc())
            ).scalars()
        )

    def upload(
        self,
        patient_id: str,
        file_content: bytes,
        filename: str,
        content_type: str,
        file_size: int,
        document_type: str,
        description: str | None = None,
    ) -> ClinicalDocument:
        """Upload a document to Supabase Storage and create DB record."""
        if file_size > self.MAX_FILE_SIZE:
            raise ValueError(f"El archivo excede el tamaño máximo de {self.MAX_FILE_SIZE / 1024 / 1024} MB.")
        
        if content_type not in self.ALLOWED_CONTENT_TYPES:
            raise ValueError(f"Tipo de archivo no permitido: {content_type}. Solo PDF, imágenes, Word.")

        patient_uuid = uuid.UUID(patient_id)
        patient = self.db.get(Patient, patient_uuid)
        if not patient or patient.tenant_id != self._tenant_id:
            raise DocumentNotFoundError("Paciente no encontrado.")

        doc_id = uuid.uuid4()
        storage_path = f"{self._tenant_id}/{patient_id}/{doc_id}_{filename}"

        self._upload_to_storage(storage_path, file_content, content_type)

        doc = ClinicalDocument(
            id=doc_id,
            tenant_id=self._tenant_id,
            patient_id=patient_uuid,
            filename=filename,
            content_type=content_type,
            file_size=file_size,
            storage_path=storage_path,
            document_type=document_type,
            description=description,
        )
        self.db.add(doc)
        self.db.commit()
        self.db.refresh(doc)
        return doc

    def _upload_to_storage(self, path: str, content: bytes, content_type: str) -> None:
        """Upload file to Supabase Storage."""
        url = f"{self._supabase_url}/storage/v1/object/{self.STORAGE_BUCKET}/{path}"
        headers = {
            "Authorization": f"Bearer {self._supabase_key}",
            "Content-Type": content_type,
        }
        with httpx.Client() as client:
            response = client.post(url, headers=headers, content=content)
            response.raise_for_status()

    def get_signed_url(self, document_id: str, expires_in: int = 3600) -> str:
        """Generate a signed URL for downloading a document."""
        doc = self._get_document(document_id)
        url = f"{self._supabase_url}/storage/v1/object/sign/{self.STORAGE_BUCKET}/{doc.storage_path}"
        headers = {
            "Authorization": f"Bearer {self._supabase_key}",
        }
        params = {"expires_in": expires_in}
        with httpx.Client() as client:
            response = client.post(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()
            signed_path = data.get("signedURL", "")
            return f"{self._supabase_url}/storage/v1{signed_path}"

    def delete(self, document_id: str) -> None:
        """Delete a document from Storage and DB."""
        doc = self._get_document(document_id)
        self._delete_from_storage(doc.storage_path)
        self.db.delete(doc)
        self.db.commit()

    def _delete_from_storage(self, storage_path: str) -> None:
        """Delete file from Supabase Storage."""
        url = f"{self._supabase_url}/storage/v1/object/{self.STORAGE_BUCKET}/{storage_path}"
        headers = {
            "Authorization": f"Bearer {self._supabase_key}",
        }
        with httpx.Client() as client:
            response = client.delete(url, headers=headers)
            response.raise_for_status()

    def _get_document(self, document_id: str) -> ClinicalDocument:
        """Get document or raise not found."""
        doc = self.db.get(ClinicalDocument, uuid.UUID(document_id))
        if not doc or doc.tenant_id != self._tenant_id:
            raise DocumentNotFoundError("Documento no encontrado.")
        return doc