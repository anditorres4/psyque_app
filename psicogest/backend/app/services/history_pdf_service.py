"""History clinical PDF generation (Res. 1995/1999 Art. 15).

Generates a downloadable PDF containing the complete clinical history
for a patient — all signed sessions, notes, and integrity hashes.
"""
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
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
from app.models.session import SessionNote
from app.models.tenant import Tenant


@dataclass
class PDFOptions:
    include_diagnosis: bool = True
    include_treatment: bool = True
    include_evolution: bool = True
    patient_profile: Literal["adulto", "infante", "familiar"] = "adulto"


def _build_pdf(
    buffer,
    tenant: Tenant,
    patient: Patient,
    sessions: list[ClinicalSession],
    notes: dict[str, list[SessionNote]],
    opts: PDFOptions | None = None,
) -> None:
    """Build PDF into an existing buffer (file-like object)."""
    if opts is None:
        opts = PDFOptions()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="SectionHeader",
            fontSize=12,
            fontName="Helvetica-Bold",
            textColor=colors.HexColor("#1E3A5F"),
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="FieldLabel",
            fontSize=9,
            fontName="Helvetica-Bold",
            textColor=colors.grey,
            spaceAfter=2,
        )
    )
    styles.add(
        ParagraphStyle(
            name="FieldValue",
            fontSize=10,
            fontName="Helvetica",
            textColor=colors.black,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SessionTitle",
            fontSize=10,
            fontName="Helvetica-Bold",
            textColor=colors.HexColor("#1E3A5F"),
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Footer",
            fontSize=7,
            fontName="Helvetica-Oblique",
            textColor=colors.grey,
            alignment=1,
        )
    )

    story = []

    # Encabezado del consultorio
    story.append(
        Paragraph(
            f"<b>{tenant.full_name}</b>",
            ParagraphStyle(
                name="OfficeName",
                fontSize=14,
                fontName="Helvetica-Bold",
                textColor=colors.HexColor("#1E3A5F"),
            ),
        )
    )
    story.append(
        Paragraph(
            f"Cop.{tenant.colpsic_number}"
            + (f" | REPS: {tenant.reps_code}" if tenant.reps_code else "")
            + (f" | NIT: {tenant.nit}" if tenant.nit else "")
            + f" | {tenant.city}",
            styles["FieldValue"],
        )
    )
    story.append(Spacer(1, 0.3 * cm))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#1E3A5F")))
    story.append(Spacer(1, 0.3 * cm))

    # Título de la historia
    export_time = datetime.now(tz=timezone.utc).strftime("%d/%m/%Y %H:%M")
    story.append(
        Paragraph(
            f"<b>HISTORIA CLÍNICA</b> — exportada el {export_time}",
            ParagraphStyle(
                name="HistoryTitle",
                fontSize=13,
                fontName="Helvetica-Bold",
                textColor=colors.HexColor("#2E86AB"),
                alignment=1,
            ),
        )
    )
    story.append(Spacer(1, 0.5 * cm))

    # Datos demográficos del paciente
    story.append(Paragraph("DATOS DEL PACIENTE", styles["SectionHeader"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E0E0E0")))
    story.append(Spacer(1, 0.3 * cm))

    doc_type_labels = {
        "CC": "Cédula de Ciudadanía",
        "TI": "Tarjeta de Identidad",
        "CE": "Cédula de Extranjería",
        "PA": "Pasaporte",
        "RC": "Registro Civil",
        "MS": "Menor sin identificación",
    }

    payer_labels = {
        "PA": "Particular",
        "CC": " Contributivo",
        "SS": "Subsidiado",
        "PE": "Especial",
        "SE": "Excepción",
    }

    sex_labels = {"M": "Masculino", "F": "Femenino", "I": "Indeterminado"}

    def patient_field(label, value):
        if not value:
            return []
        return [
            Paragraph(label.upper(), styles["FieldLabel"]),
            Paragraph(str(value), styles["FieldValue"]),
        ]

    patient_data = [
        *patient_field("Nombre completo", patient.full_name),
        *patient_field(
            "Documento",
            f"{doc_type_labels.get(patient.doc_type, patient.doc_type)} {patient.doc_number}",
        ),
        *patient_field("Fecha de nacimiento", patient.birth_date.isoformat()),
        *patient_field("Sexo biológico", sex_labels.get(patient.biological_sex, patient.biological_sex)),
        *patient_field("Dirección", patient.address),
        *patient_field("Teléfono", patient.phone),
        *patient_field("Email", patient.email),
        *patient_field("Ocupación", patient.occupation),
        *patient_field(
            "Vinculación",
            payer_labels.get(patient.payer_type, patient.payer_type),
        ),
    ]
    if patient.eps_name:
        patient_data += [
            *patient_field("EPS", patient.eps_name),
        ]

    if opts.patient_profile == "infante" and (patient.emergency_contact_name or patient.emergency_contact_phone):
        patient_data += [
            *patient_field("Responsable legal", patient.emergency_contact_name),
            *patient_field("Teléfono responsable", patient.emergency_contact_phone),
        ]

    for i in range(0, len(patient_data), 2):
        row = patient_data[i : i + 2]
        t = Table([row], colWidths=["50%", "50%"])
        t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        story.append(t)

    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph("SESIONES CLÍNICAS FIRMADAS", styles["SectionHeader"]))
    story.append(
        Paragraph(
            f"Total: {len(sessions)} sesiones — Res. 1995/1999 (Art. 13)",
            styles["FieldLabel"],
        )
    )
    story.append(Spacer(1, 0.3 * cm))

    if not sessions:
        story.append(
            Paragraph("No hay sesiones firmadas en este momento.", styles["FieldValue"])
        )
    else:
        for i, sess in enumerate(sessions, 1):
            story.append(Spacer(1, 0.3 * cm))
            story.append(
                Paragraph(
                    f"<b>Sesión {i} — {sess.actual_start.strftime('%d/%m/%Y')}</b>",
                    styles["SessionTitle"],
                )
            )

            sess_fields = [
                ("Fecha", sess.actual_start.strftime("%d/%m/%Y %H:%M")),
            ]
            if sess.actual_end:
                sess_fields.append(("Hora fin", sess.actual_end.strftime("%H:%M")))
            if sess.cups_code:
                sess_fields.append(("CUPS", sess.cups_code))
            if sess.session_fee is not None:
                sess_fields.append(("Valor", f"${sess.session_fee:,.0f} COP"))
            if opts.include_diagnosis and sess.diagnosis_cie11:
                sess_fields += [
                    ("CIE-11", sess.diagnosis_cie11),
                    ("Diagnóstico", sess.diagnosis_description or ""),
                ]
            if sess.authorization_number:
                sess_fields.append(("Autorización", sess.authorization_number))
            if sess.consultation_reason:
                sess_fields.append(("Motivo de consulta", sess.consultation_reason))
            if opts.include_treatment and sess.intervention:
                sess_fields.append(("Intervención", sess.intervention))
                if sess.next_session_plan:
                    sess_fields.append(("Plan", sess.next_session_plan))
            if opts.include_evolution and sess.evolution:
                sess_fields.append(("Evolución", sess.evolution))

            for label, value in sess_fields:
                story.append(Paragraph(label.upper(), styles["FieldLabel"]))
                story.append(Paragraph(str(value), styles["FieldValue"]))

            if sess.session_hash:
                story.append(Spacer(1, 0.1 * cm))
                story.append(
                    Paragraph(
                        f"<b>Hash SHA-256:</b> {sess.session_hash}",
                        ParagraphStyle(
                            name="HashText",
                            fontSize=7,
                            fontName="Courier",
                            textColor=colors.grey,
                        ),
                    )
                )

            sess_notes = notes.get(str(sess.id), [])
            if sess_notes:
                story.append(Spacer(1, 0.2 * cm))
                story.append(
                    Paragraph("NOTAS ACLARATORIAS", styles["FieldLabel"])
                )
                for n in sess_notes:
                    story.append(
                        Paragraph(
                            f"<b>{n.created_at.strftime('%d/%m/%Y %H:%M')}</b>: {n.content}",
                            styles["FieldValue"],
                        )
                    )
                    if n.note_hash:
                        story.append(
                            Paragraph(
                                f"Hash: {n.note_hash}",
                                ParagraphStyle(
                                    name="NoteHash",
                                    fontSize=7,
                                    fontName="Courier",
                                    textColor=colors.grey,
                                ),
                            )
                        )

            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E0E0E0")))

    # Pie de página
    story.append(PageBreak())
    story.append(Spacer(1, 0.5 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E0E0E0")))
    story.append(Spacer(1, 0.3 * cm))
    story.append(
        Paragraph(
            "Este documento fue generado electrónicamente y cumple con lo establecido en la Resolución 1995 de 1999 del Ministerio de Salud. "
            "La información contenida es de carácter confidencial y está protegida por la Ley 1581 de 2012 (Habeas Data). "
            "El hash SHA-256 de cada sesión garantiza la integridad del contenido desde el momento de la firma electrónica.",
            styles["Footer"],
        )
    )
    story.append(Spacer(1, 0.3 * cm))
    story.append(
        Paragraph(
            f"Exportado por: {tenant.full_name} | Cop. {tenant.colpsic_number} | {export_time}",
            styles["Footer"],
        )
    )

    doc.build(story)


class HistoryPDFService:
    """Generate clinical history PDF for a patient."""

    def __init__(self, db: DBSession, tenant_id: str) -> None:
        self.db = db
        self._tenant_id = uuid.UUID(tenant_id)

    def generate(self, patient_id: str, opts: PDFOptions | None = None) -> bytes:
        """Generate clinical history PDF and return as bytes."""
        import io
        if opts is None:
            opts = PDFOptions()

        patient_uuid = uuid.UUID(patient_id)
        patient = self.db.get(Patient, patient_uuid)
        if not patient or patient.tenant_id != self._tenant_id:
            raise ValueError("Paciente no encontrado.")

        tenant = self.db.get(Tenant, self._tenant_id)
        if not tenant:
            raise ValueError("Tentante no encontrado.")

        sessions = list(
            self.db.execute(
                select(ClinicalSession)
                .where(ClinicalSession.tenant_id == self._tenant_id)
                .where(ClinicalSession.patient_id == patient_uuid)
                .where(ClinicalSession.status == "signed")
                .order_by(ClinicalSession.actual_start)
            ).scalars()
        )

        session_ids = [str(s.id) for s in sessions]
        all_notes: dict[str, list[SessionNote]] = {}
        if session_ids:
            notes_list = list(
                self.db.execute(
                    select(SessionNote)
                    .where(SessionNote.session_id.in_([uuid.UUID(sid) for sid in session_ids]))
                    .order_by(SessionNote.created_at)
                ).scalars()
            )
            all_notes = {}
            for n in notes_list:
                key = str(n.session_id)
                if key not in all_notes:
                    all_notes[key] = []
                all_notes[key].append(n)

        buffer = io.BytesIO()
        _build_pdf(buffer, tenant, patient, sessions, all_notes, opts)
        buffer.seek(0)
        return buffer.read()