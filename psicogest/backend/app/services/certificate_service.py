"""Attendance certificate PDF generator for patients."""
from __future__ import annotations

import io
import uuid
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.models.patient import Patient
from app.models.session import Session as ClinicalSession
from app.models.tenant import Tenant


class CertificateService:
    def __init__(self, db: DBSession, tenant_id: str) -> None:
        self.db = db
        self._tenant_id = uuid.UUID(tenant_id)

    def generate_attendance(
        self,
        patient_id: str,
        *,
        include_session_count: bool = True,
        include_dates: bool = True,
    ) -> bytes:
        """Generate attendance certificate PDF for a patient."""
        patient = self.db.get(Patient, uuid.UUID(patient_id))
        if not patient or patient.tenant_id != self._tenant_id:
            raise ValueError("Paciente no encontrado.")

        tenant = self.db.get(Tenant, self._tenant_id)
        if not tenant:
            raise ValueError("Tenant no encontrado.")

        sessions = list(
            self.db.execute(
                select(ClinicalSession)
                .where(ClinicalSession.tenant_id == self._tenant_id)
                .where(ClinicalSession.patient_id == uuid.UUID(patient_id))
                .where(ClinicalSession.status == "signed")
                .order_by(ClinicalSession.actual_start)
            ).scalars()
        )

        return _build_certificate(
            tenant=tenant,
            patient=patient,
            sessions=sessions,
            include_session_count=include_session_count,
            include_dates=include_dates,
        )


def _build_certificate(
    tenant: Tenant,
    patient: Patient,
    sessions: list[ClinicalSession],
    include_session_count: bool,
    include_dates: bool,
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=3 * cm,
        rightMargin=3 * cm,
        topMargin=3 * cm,
        bottomMargin=3 * cm,
    )

    styles = getSampleStyleSheet()
    PRIMARY = colors.HexColor("#1E3A5F")
    SAGE = colors.HexColor("#2E86AB")

    title_style = ParagraphStyle("Title", fontSize=18, fontName="Helvetica-Bold",
                                  textColor=PRIMARY, alignment=1, spaceAfter=4)
    subtitle_style = ParagraphStyle("Subtitle", fontSize=11, fontName="Helvetica",
                                     textColor=colors.grey, alignment=1, spaceAfter=20)
    body_style = ParagraphStyle("Body", fontSize=11, fontName="Helvetica",
                                 textColor=colors.black, leading=16, spaceAfter=12)
    label_style = ParagraphStyle("Label", fontSize=9, fontName="Helvetica-Bold",
                                  textColor=colors.grey, spaceAfter=2)
    value_style = ParagraphStyle("Value", fontSize=11, fontName="Helvetica-Bold",
                                  textColor=PRIMARY, spaceAfter=12)

    today = datetime.now(tz=timezone.utc)
    full_name = patient.full_name
    doc_label = {"CC": "Cédula de Ciudadanía", "TI": "Tarjeta de Identidad",
                 "CE": "Cédula de Extranjería", "PA": "Pasaporte"}.get(patient.doc_type, patient.doc_type)

    elements = []

    # Header: psychologist name
    elements.append(Paragraph(tenant.full_name, title_style))
    if hasattr(tenant, "colpsic_number") and tenant.colpsic_number:
        elements.append(Paragraph(f"Psicólogo/a · COLPSIC {tenant.colpsic_number}", subtitle_style))
    else:
        elements.append(Paragraph("Psicólogo/a", subtitle_style))

    elements.append(HRFlowable(width="100%", thickness=1, color=SAGE, spaceAfter=20))

    # Certificate title
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(Paragraph("CONSTANCIA DE ASISTENCIA", ParagraphStyle(
        "CertTitle", fontSize=16, fontName="Helvetica-Bold", textColor=PRIMARY,
        alignment=1, spaceAfter=4,
    )))
    elements.append(Paragraph("Proceso Psicológico", ParagraphStyle(
        "CertSub", fontSize=11, fontName="Helvetica", textColor=colors.grey,
        alignment=1, spaceAfter=24,
    )))

    # Certification text
    cert_text = (
        f"Quien suscribe, <b>{tenant.full_name}</b>, certifica que el/la señor/a "
        f"<b>{full_name}</b>, identificado/a con {doc_label} N° <b>{patient.doc_number}</b>, "
        f"ha asistido al proceso de acompañamiento psicológico"
    )

    if include_session_count and sessions:
        cert_text += f" en <b>{len(sessions)} sesión(es)</b>"

    if include_dates and sessions:
        first_date = sessions[0].actual_start.strftime("%d de %B de %Y")
        last_date = sessions[-1].actual_start.strftime("%d de %B de %Y")
        if len(sessions) == 1:
            cert_text += f" el día <b>{first_date}</b>"
        else:
            cert_text += f" comprendidas entre el <b>{first_date}</b> y el <b>{last_date}</b>"

    cert_text += "."
    elements.append(Paragraph(cert_text, body_style))

    elements.append(Spacer(1, 0.5 * cm))
    elements.append(Paragraph(
        f"Esta constancia se expide a solicitud del/la interesado/a en la ciudad de "
        f"{getattr(tenant, 'city', 'Colombia')}, el día "
        f"{today.strftime('%d de %B de %Y')}.",
        body_style,
    ))

    # Signature block
    elements.append(Spacer(1, 2 * cm))
    sig_table = Table(
        [["_" * 30], [tenant.full_name], ["Psicólogo/a"]],
        colWidths=[8 * cm],
        hAlign="LEFT",
    )
    sig_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 1), (0, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 1), (0, 1), PRIMARY),
        ("TEXTCOLOR", (0, 2), (0, 2), colors.grey),
    ]))
    elements.append(sig_table)

    elements.append(Spacer(1, 1 * cm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey))
    elements.append(Spacer(1, 0.3 * cm))
    elements.append(Paragraph(
        "Documento generado electrónicamente · Válido según Ley 527/1999",
        ParagraphStyle("Footer", fontSize=8, fontName="Helvetica", textColor=colors.grey, alignment=1),
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer.read()
