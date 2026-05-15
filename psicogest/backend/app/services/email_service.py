"""Thin wrapper around Resend REST API for sending transactional emails."""
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
        modality: str = "virtual",
    ) -> bool:
        """POST reminder email to Resend. Returns True if sent, False if skipped."""
        if not settings.resend_api_key:
            return False

        label = "mañana" if hours_ahead >= 20 else "en 2 horas"
        date_str = appointment_start.strftime("%A %d de %B de %Y")
        time_str = appointment_start.strftime("%H:%M")

        if modality == "virtual":
            recommendations = (
                "<p><strong>Antes de conectarte:</strong></p><ul>"
                "<li>Verifica que tu cámara y micrófono funcionen correctamente.</li>"
                "<li>Busca un espacio bien iluminado y sin ruido de fondo.</li>"
                "<li>Asegúrate de tener una conexión a internet estable.</li>"
                "<li>No te conectes desde transporte público ni mientras conduces.</li>"
                "<li>Conéctate 2–3 minutos antes para verificar el video.</li>"
                "</ul>"
            )
        else:
            recommendations = (
                "<p><strong>Recuerda:</strong></p><ul>"
                "<li>Llega con 5 minutos de anticipación.</li>"
                "<li>Si necesitas cancelar o reprogramar, avisa con al menos 24 horas.</li>"
                "</ul>"
            )

        payload = {
            "from": settings.resend_from_email,
            "to": [to_email],
            "subject": f"Tu cita es {label} — {time_str}",
            "html": (
                f"<p>Hola {patient_name},</p>"
                f"<p>Te recordamos que tienes una cita <strong>{label}</strong>:</p>"
                f"<p><strong>Fecha:</strong> {date_str}<br>"
                f"<strong>Hora:</strong> {time_str}</p>"
                f"{recommendations}"
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

    def _post(self, payload: dict) -> bool:
        response = httpx.post(
            self.RESEND_URL, json=payload,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"}, timeout=10.0,
        )
        response.raise_for_status()
        return True

    def send_welcome(
        self,
        *,
        to_email: str,
        patient_name: str,
        psychologist_name: str,
        registration_link: str | None = None,
    ) -> bool:
        """Welcome email sent after a patient is registered in the system."""
        if not settings.resend_api_key:
            return False
        registration_section = (
            f"<p>Para completar tu registro y acceder a tu portal de paciente, haz clic aquí:<br>"
            f"<a href='{registration_link}' style='color:#2E86AB'>Completar registro</a></p>"
        ) if registration_link else ""
        return self._post({
            "from": settings.resend_from_email,
            "to": [to_email],
            "subject": f"Bienvenido/a a tu proceso terapéutico — {psychologist_name}",
            "html": (
                f"<p>Hola {patient_name},</p>"
                f"<p>Nos complace darte la bienvenida al proceso terapéutico con <strong>{psychologist_name}</strong>. "
                f"Tu bienestar es nuestra prioridad.</p>"
                f"{registration_section}"
                f"<p>Si tienes alguna pregunta antes de tu primera sesión, no dudes en escribirnos.</p>"
                f"<p>Con apoyo,<br><strong>{psychologist_name}</strong></p>"
            ),
        })

    def send_appointment_confirmation(
        self,
        *,
        to_email: str,
        patient_name: str,
        psychologist_name: str,
        appointment_start: datetime,
        join_url: str | None = None,
        modality: str = "virtual",
        location: str | None = None,
    ) -> bool:
        """Appointment confirmation with video join link (virtual) or address (presencial)."""
        if not settings.resend_api_key:
            return False
        date_str = appointment_start.strftime("%A %d de %B de %Y")
        time_str = appointment_start.strftime("%H:%M")
        if modality == "virtual" and join_url:
            modality_section = (
                f"<p><strong>Modalidad:</strong> Videoconsulta<br>"
                f"<strong>Enlace de acceso:</strong> <a href='{join_url}' style='color:#2E86AB'>{join_url}</a><br>"
                f"<em>Ingresa 5 minutos antes desde un lugar tranquilo con buena conexión.</em></p>"
                f"<p style='background:#f0f9ff;padding:12px;border-radius:8px;font-size:13px;'>"
                f"🔒 <strong>Seguridad:</strong> Este enlace es personal e intransferible.</p>"
            )
        elif modality == "presencial" and location:
            modality_section = f"<p><strong>Modalidad:</strong> Presencial<br><strong>Lugar:</strong> {location}</p>"
        else:
            modality_section = ""
        return self._post({
            "from": settings.resend_from_email,
            "to": [to_email],
            "subject": f"Confirmación de cita — {date_str} {time_str}",
            "html": (
                f"<p>Hola {patient_name},</p>"
                f"<p>Tu cita con <strong>{psychologist_name}</strong> ha sido confirmada:</p>"
                f"<p><strong>Fecha:</strong> {date_str}<br><strong>Hora:</strong> {time_str}</p>"
                f"{modality_section}"
                f"<p><strong>Recomendaciones:</strong></p><ul>"
                f"<li>Busca un espacio privado y sin interrupciones.</li>"
                f"<li>Si necesitas cancelar, avisa con al menos 24 horas de anticipación.</li>"
                f"<li>Llega o conéctate puntualmente.</li></ul>"
                f"<p>Para confirmar tu asistencia, responde este correo o contáctanos.</p>"
                f"<p>Saludos,<br><strong>{psychologist_name}</strong></p>"
            ),
        })

    def send_homework(
        self,
        *,
        to_email: str,
        patient_name: str,
        psychologist_name: str,
        homework_text: str,
        next_session_plan: str | None = None,
    ) -> bool:
        """Send assigned tasks/homework to the patient after a session is signed."""
        if not settings.resend_api_key:
            return False
        plan_section = (
            f"<p><strong>Enfoque de la próxima sesión:</strong><br>{next_session_plan}</p>"
        ) if next_session_plan else ""
        return self._post({
            "from": settings.resend_from_email,
            "to": [to_email],
            "subject": f"Tareas de tu sesión — {psychologist_name}",
            "html": (
                f"<p>Hola {patient_name},</p>"
                f"<p>Gracias por tu sesión de hoy. Actividades para trabajar entre sesiones:</p>"
                f"<div style='background:#f0f9ff;padding:16px;border-radius:8px;border-left:4px solid #2E86AB;'>"
                f"<p style='margin:0;white-space:pre-wrap;'>{homework_text}</p></div>"
                f"{plan_section}"
                f"<p>Hazlas a tu ritmo y anota cualquier reflexión que quieras compartir.</p>"
                f"<p>Saludos,<br><strong>{psychologist_name}</strong></p>"
            ),
        })

    def send_nps_survey(
        self,
        *,
        to_email: str,
        patient_name: str,
        psychologist_name: str,
        survey_url: str,
    ) -> bool:
        """Send NPS satisfaction survey link after session is signed."""
        if not settings.resend_api_key:
            return False
        return self._post({
            "from": settings.resend_from_email,
            "to": [to_email],
            "subject": f"¿Cómo fue tu sesión? — {psychologist_name}",
            "html": (
                f"<p>Hola {patient_name},</p>"
                f"<p>Gracias por tu sesión con <strong>{psychologist_name}</strong>. "
                f"Tu opinión nos ayuda a mejorar.</p>"
                f"<p><a href='{survey_url}' "
                f"style='display:inline-block;background:#2E86AB;color:white;padding:12px 24px;"
                f"border-radius:8px;text-decoration:none;font-weight:bold;'>Calificar mi sesión</a></p>"
                f"<p style='font-size:12px;color:#666;'>Tu respuesta es completamente confidencial.</p>"
            ),
        })

    def send_booking_notification(
        self, *, to_email: str, tenant_name: str, patient_name: str,
        patient_email: str, patient_phone: str | None,
        requested_start: datetime, session_type: str, notes: str | None,
    ) -> bool:
        """Notifica al psicólogo sobre una nueva solicitud de cita."""
        if not settings.resend_api_key:
            return False

        session_labels = {
            "individual": "Individual", "couple": "Pareja",
            "family": "Familia", "followup": "Seguimiento",
        }
        date_str = requested_start.strftime("%A %d de %B de %Y")
        time_str = requested_start.strftime("%H:%M")
        phone_line = f"<br><strong>Teléfono:</strong> {patient_phone}" if patient_phone else ""
        notes_line = f"<p><strong>Notas:</strong> {notes}</p>" if notes else ""

        payload = {
            "from": settings.resend_from_email,
            "to": [to_email],
            "subject": f"Nueva solicitud de cita — {patient_name}",
            "html": (
                f"<p>Hola {tenant_name},</p>"
                f"<p>Nueva solicitud de cita:</p>"
                f"<p><strong>Paciente:</strong> {patient_name}<br>"
                f"<strong>Email:</strong> {patient_email}{phone_line}<br>"
                f"<strong>Tipo:</strong> {session_labels.get(session_type, session_type)}<br>"
                f"<strong>Fecha:</strong> {date_str} — {time_str}</p>"
                f"{notes_line}"
                f"<p>Ingresa a PsyCent para confirmar o rechazar.</p>"
            ),
        }
        response = httpx.post(
            self.RESEND_URL, json=payload,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"}, timeout=10.0,
        )
        response.raise_for_status()
        return True

    def send_portal_invite(
        self,
        *,
        to_email: str,
        patient_name: str,
        psychologist_name: str,
        action_link: str,
    ) -> bool:
        """Send portal access invite with the Supabase recovery link embedded."""
        if not settings.resend_api_key:
            return False
        return self._post({
            "from": settings.resend_from_email,
            "to": [to_email],
            "subject": f"Accede a tu portal de paciente — {psychologist_name}",
            "html": (
                f"<p>Hola {patient_name},</p>"
                f"<p><strong>{psychologist_name}</strong> te ha dado acceso a tu portal de paciente, "
                f"donde podrás ver tus citas, sesiones y facturas.</p>"
                f"<p>Haz clic en el botón para establecer tu contraseña y acceder:</p>"
                f"<p style='margin:24px 0;'>"
                f"<a href='{action_link}' style='display:inline-block;background:#0F2A4A;color:white;"
                f"padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;'>"
                f"Activar mi acceso</a></p>"
                f"<p style='font-size:12px;color:#6B7A7E;'>Este enlace expira en 24 horas. "
                f"Si no lo solicitaste, ignora este mensaje.</p>"
                f"<p>Saludos,<br><strong>{psychologist_name}</strong></p>"
            ),
        })

    def send_invoice(
        self,
        *,
        to_email: str,
        patient_name: str,
        invoice_number: str,
        total_cop: int,
        pdf_bytes: bytes,
        psychologist_name: str = "tu psicólogo",
    ) -> bool:
        """Send invoice PDF via email using Resend.

        Returns True if sent, False if skipped (no API key configured).
        """
        if not settings.resend_api_key:
            return False

        payload = {
            "from": settings.resend_from_email,
            "to": [to_email],
            "subject": f"Factura {invoice_number} — {psychologist_name}",
            "html": (
                f"<p>Hola {patient_name},</p>"
                f"<p>Adjunto encontrarás tu factura <strong>{invoice_number}</strong> "
                f"por valor de <strong>${total_cop:,} COP</strong>.</p>"
                f"<p>Si tienes alguna pregunta, no dudes en contactarme.</p>"
                f"<p>Saludos,<br><strong>{psychologist_name}</strong></p>"
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

    def send_patient_session_summary(
        self,
        *,
        to_email: str,
        patient_name: str,
        psychologist_name: str,
        summary_text: str,
        session_date: datetime,
    ) -> bool:
        """Send session summary to the patient before the session is signed."""
        if not settings.resend_api_key:
            return False
        date_str = session_date.strftime("%A %d de %B de %Y")
        return self._post({
            "from": settings.resend_from_email,
            "to": [to_email],
            "subject": f"Resumen de tu sesión del {date_str} — {psychologist_name}",
            "html": (
                f"<p>Hola {patient_name},</p>"
                f"<p>Tu psicólogo/a <strong>{psychologist_name}</strong> ha preparado este resumen "
                f"de la sesión del <strong>{date_str}</strong>:</p>"
                f"<div style='background:#f8fafc;padding:20px;border-radius:10px;"
                f"border-left:4px solid #4A90A4;margin:16px 0;'>"
                f"<p style='margin:0;white-space:pre-wrap;font-size:15px;line-height:1.6;"
                f"color:#1a2332;'>{summary_text}</p></div>"
                f"<p style='font-size:13px;color:#6B7A7E;'>Si tienes preguntas sobre este resumen, "
                f"puedes comentarlo en tu próxima sesión.</p>"
                f"<p>Saludos,<br><strong>{psychologist_name}</strong></p>"
            ),
        })