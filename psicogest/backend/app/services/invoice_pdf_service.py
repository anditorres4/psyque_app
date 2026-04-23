"""PDF generation for invoices using ReportLab."""
from __future__ import annotations

from datetime import date
from io import BytesIO
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def build_invoice_pdf(data: dict[str, Any]) -> bytes:
    """Build a PDF invoice from structured data.

    Args:
        data: Output from InvoiceService.get_pdf_data()

    Returns:
        PDF bytes ready for streaming as attachment.
    """
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
        spaceAfter=2,
    )
    section_style = ParagraphStyle(
        "Section",
        parent=styles["Heading2"],
        fontSize=12,
        spaceBefore=12,
        spaceAfter=4,
        textColor=colors.HexColor("#2E86AB"),
    )

    elements = []

    elements.append(Paragraph("FACTURA DE HONORARIOS", title_style))
    elements.append(Paragraph(f"N° {data['invoice_number']}", subtitle_style))
    elements.append(Spacer(1, 8 * mm))

    psy = data["psychologist"]
    elements.append(Paragraph(f"<b>Profesional:</b> {psy['name']}", subtitle_style))
    elements.append(Paragraph(f"<b>Reg. Colpsic:</b> {psy['colpsic_number']}", subtitle_style))
    if psy.get("reps_code"):
        elements.append(Paragraph(f"<b>Código REPS:</b> {psy['reps_code']}", subtitle_style))
    elements.append(Paragraph(f"<b>NIT:</b> {psy['nit']}", subtitle_style))
    if psy.get("city"):
        elements.append(Paragraph(f"<b>Ciudad:</b> {psy['city']}", subtitle_style))
    elements.append(Spacer(1, 6 * mm))

    patient = data["patient"]
    elements.append(Paragraph("<b>DATOS DEL PACIENTE</b>", section_style))
    elements.append(
        Paragraph(
            f"<b>Paciente:</b> {patient['name']} &nbsp;&nbsp;"
            f"<b>{patient['doc_type']}</b>: {patient['doc_number']}",
            subtitle_style,
        )
    )
    if patient.get("address"):
        elements.append(
            Paragraph(f"<b>Dirección:</b> {patient['address']}", subtitle_style)
        )
    elements.append(Spacer(1, 6 * mm))

    issue_date = ""
    if data.get("issue_date"):
        try:
            issue_date = date.fromisoformat(data["issue_date"].split("T")[0]).strftime("%d/%m/%Y")
        except Exception:
            issue_date = data["issue_date"]
    elements.append(Paragraph("<b>DETALLE DE SESIONES</b>", section_style))

    session_rows = [["Fecha", "Diagnóstico (CIE-11)", "CUPS", "Valor (COP)"]]
    for s in data["sessions"]:
        session_date = ""
        try:
            session_date = date.fromisoformat(s["date"]).strftime("%d/%m/%Y")
        except Exception:
            session_date = s["date"]
        session_rows.append([
            session_date,
            s["diagnosis"][:40] + ("…" if len(s["diagnosis"]) > 40 else ""),
            s["cups_code"],
            f"${s['fee']:,.0f}".replace(",", "."),
        ])

    session_table = Table(session_rows, colWidths=[30 * mm, 80 * mm, 25 * mm, 35 * mm])
    session_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2E86AB")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("ALIGN", (-1, 0), (-1, -1), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("TOPPADDING", (0, 0), (-1, 0), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#F5F9FC"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CCCCCC")),
        ("TOPPADDING", (0, 1), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
    ]))
    elements.append(session_table)
    elements.append(Spacer(1, 8 * mm))

    subtotal = data.get("subtotal", 0)
    tax = data.get("tax", 0)
    total = data.get("total", 0)

    summary_rows = [
        ["Subtotal:", f"${subtotal:,.0f}".replace(",", ".")],
        ["Impuestos:", f"${tax:,.0f}".replace(",", ".")],
        ["TOTAL:", f"${total:,.0f}".replace(",", ".")],
    ]
    summary_table = Table(summary_rows, colWidths=[140 * mm, 30 * mm])
    summary_table.setStyle(TableStyle([
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (-1, 0), (-1, -1), "RIGHT"),
        ("LINEABOVE", (0, -1), (-1, -1), 1, colors.HexColor("#2E86AB")),
        ("TOPPADDING", (0, -1), (-1, -1), 6),
    ]))
    elements.append(summary_table)

    if data.get("notes"):
        elements.append(Spacer(1, 10 * mm))
        elements.append(Paragraph("<b>Observaciones:</b>", section_style))
        elements.append(Paragraph(data["notes"], subtitle_style))

    elements.append(Spacer(1, 15 * mm))
    status = data.get("status", "draft")
    status_labels = {"draft": "BORRADOR", "issued": "EMITIDA", "paid": "PAGADA"}
    status_text = status_labels.get(status, status.upper())
    elements.append(Paragraph(f"Estado: {status_text}", subtitle_style))
    if issue_date:
        elements.append(Paragraph(f"Fecha de emisión: {issue_date}", subtitle_style))

    doc.build(elements)
    return buffer.getvalue()