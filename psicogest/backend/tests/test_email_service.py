"""Tests for EmailService — httpx calls mocked to avoid real Resend API."""
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.services.email_service import EmailService


@pytest.fixture
def svc():
    return EmailService()


def test_send_reminder_returns_false_when_no_api_key(svc):
    """Should not call httpx and return False when resend_api_key is empty."""
    with patch("app.services.email_service.settings") as mock_settings:
        mock_settings.resend_api_key = ""
        result = svc.send_reminder(
            to_email="patient@example.com",
            patient_name="Juan Pérez",
            appointment_start=datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc),
            hours_ahead=48,
        )
    assert result is False


def test_send_48h_reminder_posts_to_resend(svc):
    """Should POST to Resend with correct payload and return True."""
    mock_response = MagicMock()
    mock_response.raise_for_status.return_value = None

    with patch("app.services.email_service.settings") as mock_settings, \
         patch("app.services.email_service.httpx.post", return_value=mock_response) as mock_post:
        mock_settings.resend_api_key = "re_test_key"
        mock_settings.resend_from_email = "noreply@psyque.app"

        result = svc.send_reminder(
            to_email="patient@example.com",
            patient_name="Juan Pérez",
            appointment_start=datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc),
            hours_ahead=48,
        )

    assert result is True
    mock_post.assert_called_once()
    payload = mock_post.call_args.kwargs["json"]
    assert payload["to"] == ["patient@example.com"]
    assert "48 horas" in payload["subject"]
    assert "Juan Pérez" in payload["html"]


def test_send_2h_reminder_subject_says_2_horas(svc):
    """Subject must say '2 horas' for the 2h reminder."""
    mock_response = MagicMock()
    mock_response.raise_for_status.return_value = None

    with patch("app.services.email_service.settings") as mock_settings, \
         patch("app.services.email_service.httpx.post", return_value=mock_response) as mock_post:
        mock_settings.resend_api_key = "re_test_key"
        mock_settings.resend_from_email = "noreply@psyque.app"

        svc.send_reminder(
            to_email="p@example.com",
            patient_name="Ana García",
            appointment_start=datetime(2026, 5, 1, 14, 0, tzinfo=timezone.utc),
            hours_ahead=2,
        )

    payload = mock_post.call_args.kwargs["json"]
    assert "2 horas" in payload["subject"]
    assert "48 horas" not in payload["subject"]