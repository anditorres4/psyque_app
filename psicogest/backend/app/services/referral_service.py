"""Referral service — manage patient referrals."""
import uuid
from datetime import datetime
from io import BytesIO
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.patient import Patient
from app.models.referral import Referral
from app.models.tenant import Tenant
from app.schemas.referral import ReferralCreate, ReferralUpdate


class ReferralNotFoundError(Exception):
    pass


class ReferralService:
    def __init__(self, db: Session, tenant_id: uuid.UUID):
        self.db = db
        self.tenant_id = tenant_id

    def create(self, patient_id: uuid.UUID, data: ReferralCreate) -> Referral:
        referral = Referral(
            tenant_id=self.tenant_id,
            patient_id=patient_id,
            **data.model_dump(),
        )
        self.db.add(referral)
        self.db.commit()
        self.db.refresh(referral)
        return referral

    def list_by_patient(self, patient_id: uuid.UUID) -> list[Referral]:
        return (
            self.db.query(Referral)
            .filter(
                Referral.tenant_id == self.tenant_id,
                Referral.patient_id == patient_id,
            )
            .order_by(Referral.created_at.desc())
            .all()
        )

    def get(self, referral_id: uuid.UUID) -> Referral:
        stmt = select(Referral).where(
            Referral.id == referral_id,
            Referral.tenant_id == self.tenant_id,
        )
        referral = self.db.scalar(stmt)
        if not referral:
            raise ReferralNotFoundError("Referral not found")
        return referral

    def update(self, referral_id: uuid.UUID, data: ReferralUpdate) -> Referral:
        referral = self.get(referral_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(referral, field, value)
        self.db.commit()
        self.db.refresh(referral)
        return referral

    def generate_pdf(self, referral_id: uuid.UUID) -> bytes:
        referral = self.get(referral_id)
        patient = self.db.get(Patient, referral.patient_id)
        tenant = self.db.get(Tenant, self.tenant_id)

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=20 * mm,
            rightMargin=20 * mm,
            topMargin=20 * mm,
            bottomMargin=20 * mm,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "Title",
            parent=styles["Heading1"],
            fontSize=18,
            spaceAfter=4,
            textColor=colors.HexColor("#1E3A5F"),
        )
        subtitle_style = ParagraphStyle(
            "Subtitle",
            parent=styles["Normal"],
            fontSize=10,
            textColor=colors.HexColor("#555555"),
        )

        elements = []

        elements.append(Paragraph("CARTA DE REMISIÓN", title_style))
        elements.append(Spacer(1, 10 * mm))

        elements.append(Paragraph(f"<b>Fecha:</b> {referral.created_at.strftime('%d de %B de %Y')}", subtitle_style))
        elements.append(Spacer(1, 8 * mm))

        elements.append(Paragraph("<b>DE:</b>", subtitle_style))
        elements.append(Paragraph(f"Dr(a). {tenant.full_name}", subtitle_style))
        if tenant.colpsic_number:
            elements.append(Paragraph(f"Colpsic: {tenant.colpsic_number}", subtitle_style))
        if tenant.reps_code:
            elements.append(Paragraph(f"Código REPS: {tenant.reps_code}", subtitle_style))
        elements.append(Paragraph(f"NIT: {tenant.nit}", subtitle_style))
        elements.append(Spacer(1, 8 * mm))

        elements.append(Paragraph("<b>PARA:</b>", subtitle_style))
        elements.append(Paragraph(f"Dr(a). {referral.referred_to_name}", subtitle_style))
        elements.append(Paragraph(f"Especialidad: {referral.referred_to_specialty}", subtitle_style))
        if referral.referred_to_institution:
            elements.append(Paragraph(f"Institución: {referral.referred_to_institution}", subtitle_style))
        elements.append(Spacer(1, 8 * mm))

        elements.append(Paragraph("<b>PACIENTE:</b>", subtitle_style))
        patient_name = f"{patient.first_surname} {patient.second_surname or ''}, {patient.first_name} {patient.second_name or ''}"
        elements.append(Paragraph(f"Nombre: {patient_name.strip()}", subtitle_style))
        elements.append(Paragraph(f"Documento: {patient.doc_type} {patient.doc_number}", subtitle_style))
        elements.append(Paragraph(f"Edad: {patient.age} años", subtitle_style))
        elements.append(Spacer(1, 8 * mm))

        elements.append(Paragraph("<b>MOTIVO DE REMISIÓN:</b>", subtitle_style))
        elements.append(Paragraph(referral.reason, subtitle_style))
        elements.append(Spacer(1, 8 * mm))

        priority_labels = {"urgente": "URGENTE", "preferente": "PREFERENTE", "programado": "PROGRAMADO"}
        priority_label = priority_labels.get(referral.priority, referral.priority.upper())
        elements.append(Paragraph(f"<b>Prioridad:</b> {priority_label}", subtitle_style))

        if referral.notes:
            elements.append(Spacer(1, 8 * mm))
            elements.append(Paragraph("<b>Observaciones:</b>", subtitle_style))
            elements.append(Paragraph(referral.notes, subtitle_style))

        elements.append(Spacer(1, 15 * mm))
        elements.append(Paragraph("Atentamente,", subtitle_style))
        elements.append(Spacer(1, 10 * mm))
        elements.append(Paragraph("_" * 30, subtitle_style))
        elements.append(Paragraph("Firma del profesional", subtitle_style))

        doc.build(elements)
        return buffer.getvalue()
