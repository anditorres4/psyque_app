"""CreditNoteService — NC and ND notes referencing issued invoices."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.credit_note import CreditDebitNote
from app.models.invoice import Invoice


class CreditNoteError(Exception):
    pass


class CreditNoteService:
    def __init__(self, db: Session, tenant_id: str) -> None:
        self.db = db
        self._tenant_uuid = uuid.UUID(tenant_id)

    def create(
        self,
        invoice_id: str,
        *,
        type: str,
        reason: str,
        amount_cop: int,
    ) -> CreditDebitNote:
        invoice_uuid = uuid.UUID(invoice_id)
        invoice = self.db.get(Invoice, invoice_uuid)
        if not invoice or invoice.tenant_id != self._tenant_uuid:
            raise CreditNoteError("Factura no encontrada.")
        if invoice.status == "draft":
            raise CreditNoteError("Solo se pueden emitir notas sobre facturas emitidas.")
        if type not in ("credit", "debit"):
            raise CreditNoteError("Tipo debe ser 'credit' o 'debit'.")
        if amount_cop <= 0:
            raise CreditNoteError("El monto debe ser mayor a cero.")

        number = self._generate_number(type)
        note = CreditDebitNote(
            tenant_id=self._tenant_uuid,
            invoice_id=invoice_uuid,
            type=type,
            number=number,
            reason=reason,
            amount_cop=amount_cop,
            issued_at=datetime.now(tz=timezone.utc),
        )
        self.db.add(note)
        self.db.flush()
        return note

    def list_by_invoice(self, invoice_id: str) -> list[CreditDebitNote]:
        return (
            self.db.query(CreditDebitNote)
            .filter(
                CreditDebitNote.tenant_id == self._tenant_uuid,
                CreditDebitNote.invoice_id == uuid.UUID(invoice_id),
            )
            .order_by(CreditDebitNote.created_at.desc())
            .all()
        )

    def _generate_number(self, type: str) -> str:
        prefix = "NC" if type == "credit" else "ND"
        year = datetime.now().year
        count = (
            self.db.query(CreditDebitNote)
            .filter(
                CreditDebitNote.tenant_id == self._tenant_uuid,
                CreditDebitNote.number.like(f"{prefix}-{year}%"),
            )
            .count()
        ) + 1
        return f"{prefix}-{year}-{count:04d}"
