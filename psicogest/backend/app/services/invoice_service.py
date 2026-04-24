"""Invoice service — generate and manage private patient liquidations."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session as DBSession

from app.models.invoice import Invoice
from app.models.patient import Patient
from app.models.session import Session
from app.models.tenant import Tenant
from app.services.email_service import EmailService
from app.services.invoice_pdf_service import build_invoice_pdf


class InvoiceNotFoundError(Exception):
    pass


class InvoiceService:
    """Manage invoices/liquidations for private patients."""

    def __init__(self, db: DBSession, tenant_id: str) -> None:
        self.db = db
        self.tenant_id = tenant_id
        self._tenant_uuid = uuid.UUID(tenant_id)

    def create_draft(
        self,
        patient_id: str,
        session_ids: list[str],
    ) -> Invoice:
        """Create a draft invoice from selected session IDs."""
        patient_uuid = uuid.UUID(patient_id)

        patient = self.db.get(Patient, patient_uuid)
        if not patient or patient.tenant_id != self._tenant_uuid:
            raise InvoiceNotFoundError("Paciente no encontrado.")

        sessions = (
            self.db.query(Session)
            .filter(
                Session.tenant_id == self._tenant_uuid,
                Session.id.in_([uuid.UUID(sid) for sid in session_ids]),
                Session.status == "signed",
            )
            .all()
        )

        if not sessions:
            raise InvoiceNotFoundError(
                "No se encontraron sesiones firmadas para incluir en la facturación."
            )

        total_cop = sum(s.session_fee for s in sessions)
        invoice_number = self._generate_invoice_number()

        invoice = Invoice(
            id=uuid.uuid4(),
            tenant_id=self._tenant_uuid,
            invoice_number=invoice_number,
            patient_id=patient_uuid,
            status="draft",
            subtotal_cop=total_cop,
            tax_cop=0,
            total_cop=total_cop,
            session_ids=[str(s.id) for s in sessions],
            notes=None,
            pdf_file_path=None,
        )
        self.db.add(invoice)
        self.db.flush()
        self.db.refresh(invoice)
        return invoice

    def create_draft_bulk(
        self,
        patient_id: str,
        date_from: datetime,
        date_to: datetime,
    ) -> Invoice:
        """Create a draft invoice from all signed sessions in a date range."""
        patient_uuid = uuid.UUID(patient_id)

        patient = self.db.get(Patient, patient_uuid)
        if not patient or patient.tenant_id != self._tenant_uuid:
            raise InvoiceNotFoundError("Paciente no encontrado.")

        sessions = (
            self.db.query(Session)
            .filter(
                Session.tenant_id == self._tenant_uuid,
                Session.patient_id == patient_uuid,
                Session.status == "signed",
                Session.actual_start >= date_from,
                Session.actual_start <= date_to,
            )
            .order_by(Session.actual_start)
            .all()
        )

        if not sessions:
            raise InvoiceNotFoundError(
                "No hay sesiones firmadas en el rango de fechas indicado."
            )

        return self.create_draft(
            patient_id=patient_id,
            session_ids=[str(s.id) for s in sessions],
        )

    def _generate_invoice_number(self) -> str:
        """Generate sequential invoice number: INV-YYYY-NNNN."""
        year = datetime.now().year
        count = (
            self.db.query(Invoice)
            .filter(
                Invoice.tenant_id == self._tenant_uuid,
                Invoice.invoice_number.like(f"INV-{year}%"),
            )
            .count()
        ) + 1
        return f"INV-{year}-{count:04d}"

    def issue(self, invoice_id: str, email_service: EmailService | None = None) -> Invoice:
        """Issue a draft invoice (change status to issued).

        If email_service is provided and patient has email, sends invoice PDF.
        """
        invoice = self._get_invoice(invoice_id)
        invoice.status = "issued"
        invoice.issue_date = datetime.now(tz=timezone.utc)
        self.db.flush()

        if email_service is not None:
            patient = self.db.get(Patient, invoice.patient_id)
            if patient and patient.email:
                try:
                    pdf_data = self.get_pdf_data(invoice_id)
                    pdf_bytes = build_invoice_pdf(pdf_data)
                    email_service.send_invoice(
                        to_email=patient.email,
                        patient_name=patient.full_name,
                        invoice_number=invoice.invoice_number,
                        total_cop=invoice.total_cop,
                        pdf_bytes=pdf_bytes,
                    )
                except Exception:
                    pass  # email failure must not revert the invoice

        self.db.refresh(invoice)
        return invoice

    def mark_paid(self, invoice_id: str) -> Invoice:
        """Mark invoice as paid."""
        invoice = self._get_invoice(invoice_id)
        invoice.status = "paid"
        invoice.paid_at = datetime.now(tz=timezone.utc)
        self.db.flush()
        self.db.refresh(invoice)
        return invoice

    def update(
        self,
        invoice_id: str,
        notes: str | None = None,
    ) -> Invoice:
        """Update invoice notes (only draft invoices)."""
        invoice = self._get_invoice(invoice_id)
        if invoice.status != "draft":
            raise InvoiceNotFoundError(
                "Solo se pueden editar facturas en estado draft."
            )
        if notes is not None:
            invoice.notes = notes
        self.db.flush()
        self.db.refresh(invoice)
        return invoice

    def _get_invoice(self, invoice_id: str) -> Invoice:
        """Get invoice or raise not found."""
        invoice = self.db.get(Invoice, uuid.UUID(invoice_id))
        if not invoice or invoice.tenant_id != self._tenant_uuid:
            raise InvoiceNotFoundError("Factura no encontrada.")
        return invoice

    def list_by_patient(
        self,
        patient_id: str,
    ) -> list[Invoice]:
        """List all invoices for a patient."""
        return (
            self.db.query(Invoice)
            .filter(
                Invoice.tenant_id == self._tenant_uuid,
                Invoice.patient_id == uuid.UUID(patient_id),
            )
            .order_by(Invoice.created_at.desc())
            .all()
        )

    def list_all(
        self,
        status: str | None = None,
        limit: int = 20,
    ) -> list[Invoice]:
        """List invoices, optionally filtered by status."""
        query = self.db.query(Invoice).filter(
            Invoice.tenant_id == self._tenant_uuid
        )
        if status:
            query = query.filter(Invoice.status == status)
        return query.order_by(Invoice.created_at.desc()).limit(limit).all()

    def get_pdf_data(self, invoice_id: str) -> dict[str, Any]:
        """Generate PDF content data for an invoice."""
        invoice = self._get_invoice(invoice_id)
        tenant = self.db.get(Tenant, self._tenant_uuid)
        patient = self.db.get(Patient, invoice.patient_id)

        sessions = (
            self.db.query(Session)
            .filter(
                Session.id.in_([uuid.UUID(sid) for sid in invoice.session_ids])
            )
            .order_by(Session.actual_start)
            .all()
        )

        return {
            "invoice_number": invoice.invoice_number,
            "issue_date": invoice.issue_date.isoformat() if invoice.issue_date else None,
            "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
            "status": invoice.status,
            "psychologist": {
                "name": tenant.full_name,
                "colpsic_number": tenant.colpsic_number,
                "reps_code": tenant.reps_code,
                "nit": tenant.nit,
                "city": tenant.city,
            },
            "patient": {
                "name": patient.full_name,
                "doc_type": patient.doc_type,
                "doc_number": patient.doc_number,
                "address": patient.address,
            },
            "sessions": [
                {
                    "date": s.actual_start.date().isoformat(),
                    "diagnosis": s.diagnosis_description,
                    "cups_code": s.cups_code,
                    "fee": s.session_fee,
                }
                for s in sessions
            ],
            "subtotal": invoice.subtotal_cop,
            "tax": invoice.tax_cop,
            "total": invoice.total_cop,
            "notes": invoice.notes,
        }