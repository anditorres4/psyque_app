"""Attendance certificate PDF generator for patients."""
from __future__ import annotations

import io
import uuid
from datetime import date, datetime, timezone

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

PRIMARY = colors.HexColor("#1E3A5F")
SAGE = colors.HexColor("#2E86AB")
GREY = colors.HexColor("#6B7A7E")

_CUPS_LABELS: dict[str, str] = {
    "890101": "Consulta de primera vez",
    "890102": "Consulta de control",
    "890403": "Psicoterapia individual adultos",
    "890404": "Psicoterapia individual niños/adolescentes",
    "890601": "Psicoterapia de pareja",
    "890701": "Psicoterapia familiar",
}


def _styles() -> dict[str, ParagraphStyle]:
    getSampleStyleSheet()
    return {
        "title": ParagraphStyle("Title", fontSize=18, fontName="Helvetica-Bold", textColor=PRIMARY, alignment=1, spaceAfter=4),
        "subtitle": ParagraphStyle("Subtitle", fontSize=11, fontName="Helvetica", textColor=GREY, alignment=1, spaceAfter=20),
        "body": ParagraphStyle("Body", fontSize=11, fontName="Helvetica", textColor=colors.black, leading=16, spaceAfter=12),
        "label": ParagraphStyle("Label", fontSize=9, fontName="Helvetica-Bold", textColor=GREY, spaceAfter=2),
        "value": ParagraphStyle("Value", fontSize=11, fontName="Helvetica-Bold", textColor=PRIMARY, spaceAfter=12),
        "footer": ParagraphStyle("Footer", fontSize=8, fontName="Helvetica", textColor=GREY, alignment=1),
        "cert_title": ParagraphStyle("CertTitle", fontSize=16, fontName="Helvetica-Bold", textColor=PRIMARY, alignment=1, spaceAfter=4),
        "cert_sub": ParagraphStyle("CertSub", fontSize=11, fontName="Helvetica", textColor=GREY, alignment=1, spaceAfter=24),
    }


def _doc(buffer: io.BytesIO) -> SimpleDocTemplate:
    return SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=3 * cm, rightMargin=3 * cm,
        topMargin=3 * cm, bottomMargin=3 * cm,
    )


def _header(tenant: Tenant, elements: list) -> None:
    s = _styles()
    elements.append(Paragraph(tenant.full_name, s["title"]))
    colpsic = getattr(tenant, "colpsic_number", None)
    subtitle = f"Psicólogo/a · COLPSIC {colpsic}" if colpsic else "Psicólogo/a"
    elements.append(Paragraph(subtitle, s["subtitle"]))
    elements.append(HRFlowable(width="100%", thickness=1, color=SAGE, spaceAfter=20))


def _signature(tenant: Tenant, elements: list) -> None:
    s = _styles()
    elements.append(Spacer(1, 2 * cm))
    sig_table = Table(
        [["_" * 30], [tenant.full_name], ["Psicólogo/a"]],
        colWidths=[8 * cm], hAlign="LEFT",
    )
    sig_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 1), (0, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 1), (0, 1), PRIMARY),
        ("TEXTCOLOR", (0, 2), (0, 2), GREY),
    ]))
    elements.append(sig_table)
    elements.append(Spacer(1, 1 * cm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey))
    elements.append(Spacer(1, 0.3 * cm))
    elements.append(Paragraph(
        "Documento generado electrónicamente · Válido según Ley 527/1999",
        s["footer"],
    ))


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
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> bytes:
        """Generate global attendance certificate PDF. Includes a session table when a date range is given."""
        patient = self.db.get(Patient, uuid.UUID(patient_id))
        if not patient or patient.tenant_id != self._tenant_id:
            raise ValueError("Paciente no encontrado.")

        tenant = self.db.get(Tenant, self._tenant_id)
        if not tenant:
            raise ValueError("Tenant no encontrado.")

        q = (
            select(ClinicalSession)
            .where(ClinicalSession.tenant_id == self._tenant_id)
            .where(ClinicalSession.patient_id == uuid.UUID(patient_id))
            .where(ClinicalSession.status == "signed")
        )
        if from_date:
            q = q.where(ClinicalSession.actual_start >= datetime(from_date.year, from_date.month, from_date.day, tzinfo=timezone.utc))
        if to_date:
            q = q.where(ClinicalSession.actual_start < datetime(to_date.year, to_date.month, to_date.day + 1 if to_date.day < 28 else to_date.month, tzinfo=timezone.utc))
        q = q.order_by(ClinicalSession.actual_start)
        sessions = list(self.db.execute(q).scalars())

        return _build_global_certificate(
            tenant=tenant,
            patient=patient,
            sessions=sessions,
            include_session_count=include_session_count,
            include_dates=include_dates,
            from_date=from_date,
            to_date=to_date,
        )

    def generate_single_session(self, session_id: str) -> bytes:
        """Generate a single-session attendance certificate."""
        sess = (
            self.db.execute(
                select(ClinicalSession)
                .where(ClinicalSession.id == uuid.UUID(session_id))
                .where(ClinicalSession.tenant_id == self._tenant_id)
                .where(ClinicalSession.status == "signed")
            ).scalar_one_or_none()
        )
        if not sess:
            raise ValueError("Sesión no encontrada o no firmada.")

        patient = self.db.get(Patient, sess.patient_id)
        tenant = self.db.get(Tenant, self._tenant_id)
        if not patient or not tenant:
            raise ValueError("Datos incompletos.")

        return _build_single_session_certificate(tenant=tenant, patient=patient, session=sess)


# ── Single-session certificate ─────────────────────────────────────────────────

def _build_single_session_certificate(
    tenant: Tenant,
    patient: Patient,
    session: ClinicalSession,
) -> bytes:
    buffer = io.BytesIO()
    doc = _doc(buffer)
    s = _styles()
    elements: list = []

    _header(tenant, elements)
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(Paragraph("CONSTANCIA DE ATENCIÓN PSICOLÓGICA", s["cert_title"]))
    elements.append(Paragraph("Sesión individual", s["cert_sub"]))

    doc_label = {"CC": "Cédula de Ciudadanía", "TI": "Tarjeta de Identidad",
                 "CE": "Cédula de Extranjería", "PA": "Pasaporte"}.get(patient.doc_type, patient.doc_type)

    session_date = session.actual_start.strftime("%d de %B de %Y")
    session_time = session.actual_start.strftime("%H:%M")
    cup_label = _CUPS_LABELS.get(session.cups_code, session.cups_code)

    # Duration
    if session.actual_end:
        delta = session.actual_end - session.actual_start
        minutes = int(delta.total_seconds() / 60)
        duration_str = f"{minutes} minutos"
    else:
        duration_str = "duración no registrada"

    cert_text = (
        f"Quien suscribe, <b>{tenant.full_name}</b>, certifica que el/la señor/a "
        f"<b>{patient.full_name}</b>, identificado/a con {doc_label} N° <b>{patient.doc_number}</b>, "
        f"asistió a la siguiente sesión de atención psicológica:"
    )
    elements.append(Paragraph(cert_text, s["body"]))
    elements.append(Spacer(1, 0.3 * cm))

    # Session detail table
    detail_data = [
        ["Campo", "Detalle"],
        ["Fecha", session_date],
        ["Hora", session_time],
        ["Duración", duration_str],
        ["Tipo de atención", cup_label],
        ["Diagnóstico CIE-11", f"{session.diagnosis_cie11} — {session.diagnosis_description}"],
    ]
    detail_table = Table(detail_data, colWidths=[5 * cm, 10 * cm])
    detail_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f8fafc"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 1), (0, -1), GREY),
    ]))
    elements.append(detail_table)

    elements.append(Spacer(1, 0.5 * cm))
    today = datetime.now(tz=timezone.utc)
    elements.append(Paragraph(
        f"Esta constancia se expide a solicitud del/la interesado/a en "
        f"{getattr(tenant, 'city', 'Colombia')}, el {today.strftime('%d de %B de %Y')}.",
        s["body"],
    ))

    _signature(tenant, elements)
    doc.build(elements)
    buffer.seek(0)
    return buffer.read()


# ── Global attendance certificate ─────────────────────────────────────────────

def _build_global_certificate(
    tenant: Tenant,
    patient: Patient,
    sessions: list[ClinicalSession],
    include_session_count: bool,
    include_dates: bool,
    from_date: date | None,
    to_date: date | None,
) -> bytes:
    buffer = io.BytesIO()
    doc = _doc(buffer)
    s = _styles()
    elements: list = []

    _header(tenant, elements)
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(Paragraph("CONSTANCIA DE ASISTENCIA", s["cert_title"]))
    elements.append(Paragraph("Proceso Psicológico", s["cert_sub"]))

    doc_label = {"CC": "Cédula de Ciudadanía", "TI": "Tarjeta de Identidad",
                 "CE": "Cédula de Extranjería", "PA": "Pasaporte"}.get(patient.doc_type, patient.doc_type)

    cert_text = (
        f"Quien suscribe, <b>{tenant.full_name}</b>, certifica que el/la señor/a "
        f"<b>{patient.full_name}</b>, identificado/a con {doc_label} N° <b>{patient.doc_number}</b>, "
        "ha asistido al proceso de acompañamiento psicológico"
    )
    if include_session_count and sessions:
        cert_text += f" en <b>{len(sessions)} sesión(es)</b>"
    if include_dates and sessions:
        first_date = sessions[0].actual_start.strftime("%d de %B de %Y")
        last_date = sessions[-1].actual_start.strftime("%d de %B de %Y")
        cert_text += f" comprendidas entre el <b>{first_date}</b> y el <b>{last_date}</b>" if len(sessions) > 1 else f" el <b>{first_date}</b>"
    cert_text += "."
    elements.append(Paragraph(cert_text, s["body"]))

    # Session table (always shown when there are sessions)
    if sessions:
        elements.append(Spacer(1, 0.5 * cm))
        table_data = [["#", "Fecha", "Hora", "Tipo de atención", "Duración"]]
        for i, sess in enumerate(sessions, 1):
            if sess.actual_end:
                mins = int((sess.actual_end - sess.actual_start).total_seconds() / 60)
                dur = f"{mins} min"
            else:
                dur = "—"
            table_data.append([
                str(i),
                sess.actual_start.strftime("%d/%m/%Y"),
                sess.actual_start.strftime("%H:%M"),
                _CUPS_LABELS.get(sess.cups_code, sess.cups_code),
                dur,
            ])
        col_widths = [1 * cm, 2.5 * cm, 1.8 * cm, 7 * cm, 2 * cm]
        session_table = Table(table_data, colWidths=col_widths)
        session_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f8fafc"), colors.white]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (4, 0), (4, -1), "CENTER"),
        ]))
        elements.append(session_table)

    elements.append(Spacer(1, 0.5 * cm))
    today = datetime.now(tz=timezone.utc)
    elements.append(Paragraph(
        f"Esta constancia se expide a solicitud del/la interesado/a en "
        f"{getattr(tenant, 'city', 'Colombia')}, el {today.strftime('%d de %B de %Y')}.",
        s["body"],
    ))

    _signature(tenant, elements)
    doc.build(elements)
    buffer.seek(0)
    return buffer.read()
