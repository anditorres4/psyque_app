"""Cartera router — invoice payment tracking."""
from datetime import datetime
from typing import Annotated
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func

from app.core.deps import get_tenant_db, TenantDB
from app.models.cash_session import CashSession
from app.models.cash_transaction import CashTransaction
from app.models.invoice import Invoice
from app.models.patient import Patient
from app.schemas.cash_transaction import (
    CarteraInvoicePaymentCreate,
    CarteraListResponse,
    CarteraSummaryResponse,
    CashTransactionSummary,
)

router = APIRouter(prefix="/cartera", tags=["cartera"])


def _get_open_session(ctx: TenantDB) -> CashSession | None:
    """Return the open session for current user, if any."""
    return ctx.db.query(CashSession).filter(
        CashSession.tenant_id == ctx.tenant.tenant_id,
        CashSession.user_id == ctx.tenant.user_id,
        CashSession.status == "open",
    ).first()


def _recalculate_payment_status(invoice: Invoice) -> None:
    """Recalculate payment_status based on amount_paid vs total_cop."""
    if invoice.amount_paid >= invoice.total_cop:
        invoice.payment_status = "paid"
    elif invoice.amount_paid > 0:
        invoice.payment_status = "partial"
    else:
        invoice.payment_status = "unpaid"


@router.get("", response_model=CarteraListResponse)
def list_cartera(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    patient_type: str | None = Query(None, alias="type"),
    patient_name: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
) -> CarteraListResponse:
    """List invoices with pending payments, grouped by patient."""
    query = ctx.db.query(Invoice).filter(
        Invoice.tenant_id == ctx.tenant.tenant_id,
        Invoice.payment_status != "paid",
    )

    if patient_type == "particular":
        # Payer type PA = Particular
        query = query.join(Patient, Invoice.patient_id == Patient.id).filter(
            Patient.payer_type == "PA"
        )
    elif patient_type == "eps":
        # Payer types other than PA are EPS/convenio
        query = query.join(Patient, Invoice.patient_id == Patient.id).filter(
            Patient.payer_type != "PA"
        )

    if patient_name:
        query = query.join(Patient, Invoice.patient_id == Patient.id).filter(
            func.concat(
                Patient.first_name, " ", Patient.first_surname
            ).ilike(f"%{patient_name}%")
        )

    invoices = query.all()

    # Group by patient
    patient_map: dict[uuid.UUID, dict] = {}
    for inv in invoices:
        pid = inv.patient_id
        if pid not in patient_map:
            patient = ctx.db.query(Patient).filter(Patient.id == pid).first()
            patient_map[pid] = {
                "id": pid,
                "patient_id": pid,
                "patient_name": patient.full_name if patient else "Unknown",
                "payer_type": patient.payer_type if patient else "PA",
                "eps_name": patient.eps_name if patient else None,
                "total_billed": 0,
                "total_paid": 0,
                "total_pending": 0,
                "last_activity": None,
                "invoices_count": 0,
                "invoice_ids": [],
            }
        patient_map[pid]["total_billed"] += inv.total_cop
        patient_map[pid]["total_paid"] += inv.amount_paid
        patient_map[pid]["total_pending"] += (inv.total_cop - inv.amount_paid)
        patient_map[pid]["invoices_count"] += 1
        patient_map[pid]["invoice_ids"].append(inv.id)
        if inv.updated_at and (
            patient_map[pid]["last_activity"] is None
            or inv.updated_at > patient_map[pid]["last_activity"]
        ):
            patient_map[pid]["last_activity"] = inv.updated_at

    items = [
        {
            "patient_id": v["patient_id"],
            "id": v["id"],
            "patient_name": v["patient_name"],
            "payer_type": v["payer_type"],
            "eps_name": v["eps_name"],
            "total_billed": v["total_billed"],
            "total_paid": v["total_paid"],
            "balance": v["total_pending"],
            "total_pending": v["total_pending"],
            "last_activity": v["last_activity"],
            "invoices_count": v["invoices_count"],
            "invoice_ids": v["invoice_ids"],
        }
        for v in patient_map.values()
    ]

    return CarteraListResponse(items=items, total=len(items))


@router.get("/summary", response_model=CarteraSummaryResponse)
def cartera_summary(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> CarteraSummaryResponse:
    """Get total debt summary by type."""
    # Get all unpaid/partial invoices
    invoices = ctx.db.query(Invoice).filter(
        Invoice.tenant_id == ctx.tenant.tenant_id,
        Invoice.payment_status != "paid",
    ).all()

    total_particular = 0
    total_eps = 0

    for inv in invoices:
        patient = ctx.db.query(Patient).filter(Patient.id == inv.patient_id).first()
        pending = inv.total_cop - inv.amount_paid
        if patient and patient.payer_type == "PA":
            total_particular += pending
        else:
            total_eps += pending

    return CarteraSummaryResponse(
        total_particular=total_particular,
        total_eps=total_eps,
        grand_total=total_particular + total_eps,
    )


@router.post("/invoices/{invoice_id}/payments", response_model=CashTransactionSummary, status_code=status.HTTP_201_CREATED)
def register_payment(
    invoice_id: uuid.UUID,
    body: CarteraInvoicePaymentCreate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
) -> CashTransactionSummary:
    """Register a payment for an invoice. Creates transaction and updates invoice."""
    invoice = ctx.db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.tenant_id == ctx.tenant.tenant_id,
    ).first()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Factura no encontrada.")

    if invoice.payment_status == "paid":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Esta factura ya está pagada.",
        )

    pending = invoice.total_cop - invoice.amount_paid
    if body.amount > pending:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"El monto excede el saldo pendiente de {pending}.",
        )

    # Check for open session
    session = _get_open_session(ctx)

    patient = ctx.db.query(Patient).filter(Patient.id == invoice.patient_id).first()
    category = "particular" if patient and patient.payer_type == "PA" else "eps"

    tx = CashTransaction(
        tenant_id=ctx.tenant.tenant_id,
        session_id=session.id if session else None,
        type="income",
        amount=body.amount,
        category=category,
        description=body.description,
        invoice_id=invoice_id,
        patient_id=invoice.patient_id,
        eps_name=patient.eps_name if category == "eps" and patient else None,
        created_at=datetime.utcnow(),
        created_by=ctx.tenant.user_id,
    )
    ctx.db.add(tx)

    # Update invoice
    invoice.amount_paid += body.amount
    _recalculate_payment_status(invoice)

    ctx.db.commit()
    ctx.db.refresh(tx)
    return CashTransactionSummary.model_validate(tx)
