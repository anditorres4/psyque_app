"""Invoice router — private patient liquidations (no DIAN)."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.core.deps import get_tenant_db, TenantDB
from app.schemas.invoice import (
    InvoiceBulkCreate,
    InvoiceCreate,
    InvoiceDetail,
    InvoiceListResponse,
    InvoiceSummary,
    InvoiceUpdate,
    UnbilledPatientRow,
    CreditDebitNoteCreate,
    CreditDebitNoteOut,
)
from app.services.email_service import EmailService
from app.services.invoice_pdf_service import build_invoice_pdf
from app.services.invoice_service import InvoiceNotFoundError, InvoiceService
from app.services.credit_note_service import CreditNoteError, CreditNoteService

router = APIRouter(prefix="/invoices", tags=["invoices"])


def _service(ctx: TenantDB) -> InvoiceService:
    return InvoiceService(ctx.db, ctx.tenant.tenant_id)


@router.post("", response_model=InvoiceSummary, status_code=status.HTTP_201_CREATED)
def create_invoice(
    body: InvoiceCreate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> InvoiceSummary:
    try:
        invoice = _service(ctx).create_draft(
            patient_id=str(body.patient_id),
            session_ids=[str(sid) for sid in body.session_ids],
        )
        ctx.db.commit()
        ctx.db.refresh(invoice)
        return InvoiceSummary.model_validate(invoice)
    except InvoiceNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )


@router.get("", response_model=InvoiceListResponse)
def list_invoices(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    patient_id: str | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
) -> InvoiceListResponse:
    if patient_id:
        invoices = _service(ctx).list_by_patient(patient_id)
    else:
        invoices = _service(ctx).list_all(status=status, limit=limit)
    return InvoiceListResponse(
        items=[InvoiceSummary.model_validate(i) for i in invoices],
        total=len(invoices),
    )


@router.get("/unbilled", response_model=list[UnbilledPatientRow])
def list_unbilled_sessions(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> list[UnbilledPatientRow]:
    rows = _service(ctx).get_unbilled_by_patient()
    return [UnbilledPatientRow(**r) for r in rows]


@router.post("/bulk", response_model=InvoiceSummary, status_code=status.HTTP_201_CREATED)
def create_bulk_invoice(
    body: InvoiceBulkCreate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> InvoiceSummary:
    try:
        invoice = _service(ctx).create_draft_bulk(
            patient_id=str(body.patient_id),
            date_from=body.date_from,
            date_to=body.date_to,
        )
        ctx.db.commit()
        ctx.db.refresh(invoice)
        return InvoiceSummary.model_validate(invoice)
    except InvoiceNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )


@router.get("/{invoice_id}", response_model=InvoiceDetail)
def get_invoice(
    invoice_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> InvoiceDetail:
    try:
        invoice = _service(ctx)._get_invoice(invoice_id)
        return InvoiceDetail.model_validate(invoice)
    except InvoiceNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factura no encontrada.",
        )


@router.put("/{invoice_id}", response_model=InvoiceSummary)
def update_invoice(
    invoice_id: str,
    body: InvoiceUpdate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> InvoiceSummary:
    try:
        invoice = _service(ctx).update(invoice_id, notes=body.notes)
        ctx.db.commit()
        ctx.db.refresh(invoice)
        return InvoiceSummary.model_validate(invoice)
    except InvoiceNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )


@router.post("/{invoice_id}/issue", response_model=InvoiceSummary)
def issue_invoice(
    invoice_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> InvoiceSummary:
    try:
        email_svc = EmailService()
        invoice = _service(ctx).issue(invoice_id, email_service=email_svc)
        ctx.db.commit()
        ctx.db.refresh(invoice)
        return InvoiceSummary.model_validate(invoice)
    except InvoiceNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )


@router.post("/{invoice_id}/pay", response_model=InvoiceSummary)
def pay_invoice(
    invoice_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> InvoiceSummary:
    try:
        invoice = _service(ctx).mark_paid(invoice_id)
        ctx.db.commit()
        ctx.db.refresh(invoice)
        return InvoiceSummary.model_validate(invoice)
    except InvoiceNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )


@router.get("/{invoice_id}/pdf")
def get_invoice_pdf(
    invoice_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> StreamingResponse:
    try:
        pdf_data = _service(ctx).get_pdf_data(invoice_id)
    except InvoiceNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factura no encontrada.",
        )

    pdf_bytes = build_invoice_pdf(pdf_data)
    filename = f"{pdf_data['invoice_number']}.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _note_service(ctx: TenantDB) -> CreditNoteService:
    return CreditNoteService(ctx.db, ctx.tenant.tenant_id)


@router.post(
    "/{invoice_id}/notes",
    response_model=CreditDebitNoteOut,
    status_code=status.HTTP_201_CREATED,
)
def create_invoice_note(
    invoice_id: str,
    body: CreditDebitNoteCreate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> CreditDebitNoteOut:
    try:
        note = _note_service(ctx).create(
            invoice_id,
            type=body.type,
            reason=body.reason,
            amount_cop=body.amount_cop,
        )
        ctx.db.commit()
        ctx.db.refresh(note)
        return CreditDebitNoteOut.model_validate(note)
    except CreditNoteError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )


@router.get("/{invoice_id}/notes", response_model=list[CreditDebitNoteOut])
def list_invoice_notes(
    invoice_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> list[CreditDebitNoteOut]:
    notes = _note_service(ctx).list_by_invoice(invoice_id)
    return [CreditDebitNoteOut.model_validate(n) for n in notes]