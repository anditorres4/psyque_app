"""Documents router — clinical document endpoints."""
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import RedirectResponse

from app.core.deps import get_tenant_db, TenantDB
from app.schemas.document import DocumentCreate, DocumentRead
from app.services.document_service import DocumentNotFoundError, DocumentService

router = APIRouter(tags=["documents"])


def _service(ctx: TenantDB) -> DocumentService:
    return DocumentService(ctx.db, ctx.tenant.tenant_id)


@router.post(
    "/patients/{patient_id}/documents",
    response_model=DocumentRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    patient_id: str,
    file: UploadFile = File(...),
    document_type: str = Form(...),
    description: str | None = Form(None),
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> DocumentRead:
    """Upload a document to a patient's file."""
    content = await file.read()
    content_type = file.content_type or "application/octet-stream"
    filename = file.filename or "document"
    file_size = len(content)

    try:
        doc = _service(ctx).upload(
            patient_id=patient_id,
            file_content=content,
            filename=filename,
            content_type=content_type,
            file_size=file_size,
            document_type=document_type,
            description=description,
        )
        ctx.db.commit()
        return DocumentRead.model_validate(doc)
    except DocumentNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/patients/{patient_id}/documents", response_model=list[DocumentRead])
def list_patient_documents(
    patient_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> list[DocumentRead]:
    """List all documents for a patient."""
    docs = _service(ctx).list_by_patient(patient_id)
    return [DocumentRead.model_validate(d) for d in docs]


@router.get("/documents/{document_id}/download")
def get_document_download(
    document_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> RedirectResponse:
    """Redirect to signed URL for document download."""
    try:
        signed_url = _service(ctx).get_signed_url(document_id)
        return RedirectResponse(url=signed_url)
    except DocumentNotFoundError:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> None:
    """Delete a document."""
    try:
        _service(ctx).delete(document_id)
        ctx.db.commit()
    except DocumentNotFoundError:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")