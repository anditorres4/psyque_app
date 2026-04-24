"""Thin wrapper around Resend REST API for sending reminder emails."""
import base64
from datetime import datetime

import httpx

from app.core.config import settings


class EmailService:
    """Sends reminder emails via Resend. Skips silently if resend_api_key is empty."""

    RESEND_URL = "https://api.resend.com/emails"

    def send_reminder(
        self,
        *,
        to_email: str,
        patient_name: str,
        appointment_start: datetime,
        hours_ahead: int,
    ) -> bool:
        """POST reminder email to Resend. Returns True if sent, False if skipped."""
        if not settings.resend_api_key:
            return False

        label = "48 horas" if hours_ahead == 48 else "2 horas"
        date_str = appointment_start.strftime("%A %d de %B de %Y")
        time_str = appointment_start.strftime("%H:%M")

        payload = {
            "from": settings.resend_from_email,
            "to": [to_email],
            "subject": f"Recordatorio de cita — {label}",
            "html": (
                f"<p>Hola {patient_name},</p>"
                f"<p>Te recordamos que tienes una cita programada en "
                f"<strong>{label}</strong>:</p>"
                f"<p><strong>Fecha:</strong> {date_str}<br>"
                f"<strong>Hora:</strong> {time_str}</p>"
                f"<p>Si necesitas cancelar o reprogramar, contacta a tu psicólogo.</p>"
            ),
        }

        response = httpx.post(
            self.RESEND_URL,
            json=payload,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            timeout=10.0,
        )
        response.raise_for_status()
        return True

    def send_invoice(
        self,
        *,
        to_email: str,
        patient_name: str,
        invoice_number: str,
        total_cop: int,
        pdf_bytes: bytes,
    ) -> bool:
        """Send invoice PDF via email using Resend.

        Returns True if sent, False if skipped (no API key configured).
        """
        if not settings.resend_api_key:
            return False

        payload = {
            "from": settings.resend_from_email,
            "to": [to_email],
            "subject": f"Factura {invoice_number} — tu psicólogo",
            "html": (
                f"<p>Hola {patient_name},</p>"
                f"<p>Adjunto encontrarás tu factura <strong>{invoice_number}</strong> "
                f"por valor de <strong>${total_cop:,} COP</strong>.</p>"
                f"<p>Si tienes alguna pregunta, no dudes en contactarme.</p>"
                f"<p>Saludos,<br>Tu psicólogo</p>"
            ),
            "attachments": [
                {
                    "filename": f"{invoice_number}.pdf",
                    "content": base64.b64encode(pdf_bytes).decode(),
                }
            ],
        }

        response = httpx.post(
            self.RESEND_URL,
            json=payload,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            timeout=10.0,
        )
        response.raise_for_status()
        return True