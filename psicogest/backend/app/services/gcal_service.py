"""Google Calendar Service — OAuth2 flow and raw API calls."""
import hashlib
import hmac
import uuid
from datetime import datetime, timedelta, timezone

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.core.config import settings
from app.models.gcal_token import GoogleCalendarToken

SCOPES = ["https://www.googleapis.com/auth/calendar.events"]

SESSION_TYPE_LABELS = {
    "individual": "Consulta individual",
    "couple": "Terapia de pareja",
    "family": "Terapia familiar",
    "followup": "Sesión de seguimiento",
}
MODALITY_LABELS = {
    "presential": "Presencial",
    "virtual": "Virtual",
}


class GCalNotConfiguredError(Exception):
    """Raised when Google OAuth credentials are not configured in settings."""


class GCalAuthError(Exception):
    """Raised when the OAuth2 state is invalid or code exchange fails."""


class GCalService:
    def __init__(self, db) -> None:
        self.db = db

    def build_auth_url(self) -> str:
        """Return a Google OAuth2 authorization URL. Raises GCalNotConfiguredError if not set up."""
        if not settings.google_client_id or not settings.google_client_secret:
            raise GCalNotConfiguredError("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured.")
        flow = self._create_flow()
        auth_url, _ = flow.authorization_url(access_type="offline", prompt="consent")
        return auth_url

    def exchange_code(self, code: str, tenant_id: uuid.UUID) -> GoogleCalendarToken:
        """Exchange OAuth2 authorization code for tokens and persist. Returns the token record."""
        flow = self._create_flow()
        try:
            flow.fetch_token(code=code)
        except Exception as exc:
            raise GCalAuthError(f"Code exchange failed: {exc}") from exc

        creds = flow.credentials
        expiry = creds.expiry.replace(tzinfo=timezone.utc) if creds.expiry else (
            datetime.now(tz=timezone.utc) + timedelta(hours=1)
        )

        token = self.db.get(GoogleCalendarToken, tenant_id)
        if token:
            token.access_token = creds.token
            token.refresh_token = creds.refresh_token or token.refresh_token
            token.token_expiry = expiry
            token.sync_enabled = True
        else:
            token = GoogleCalendarToken(
                tenant_id=tenant_id,
                access_token=creds.token,
                refresh_token=creds.refresh_token or "",
                token_expiry=expiry,
            )
            self.db.add(token)

        self.db.commit()
        self.db.refresh(token)
        return token

    def get_token(self, tenant_id: uuid.UUID) -> GoogleCalendarToken | None:
        """Return the stored token for a tenant, or None if not connected."""
        return self.db.get(GoogleCalendarToken, tenant_id)

    def disconnect(self, tenant_id: uuid.UUID) -> None:
        """Delete token record and external blocks for tenant."""
        token = self.db.get(GoogleCalendarToken, tenant_id)
        if token:
            self.db.delete(token)
        from app.models.gcal_external_block import GCalExternalBlock
        self.db.query(GCalExternalBlock).filter_by(tenant_id=tenant_id).delete()
        self.db.commit()

    def get_credentials(self, token: GoogleCalendarToken) -> Credentials:
        """Return valid Google Credentials, refreshing the access token if expired."""
        creds = Credentials(
            token=token.access_token,
            refresh_token=token.refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
        )
        if datetime.now(tz=timezone.utc) >= token.token_expiry - timedelta(minutes=5):
            creds.refresh(Request())
            token.access_token = creds.token
            token.token_expiry = (
                creds.expiry.replace(tzinfo=timezone.utc)
                if creds.expiry
                else datetime.now(tz=timezone.utc) + timedelta(hours=1)
            )
            self.db.commit()
        return creds

    def create_event(self, token: GoogleCalendarToken, appointment, patient_name: str) -> str:
        """Create a GCal event for an appointment. Returns the Google event ID."""
        creds = self.get_credentials(token)
        service = build("calendar", "v3", credentials=creds)
        body = self._build_event_body(appointment, patient_name)
        created = service.events().insert(calendarId=token.calendar_id, body=body).execute()
        return created["id"]

    def update_event(self, token: GoogleCalendarToken, appointment, patient_name: str) -> None:
        """Update an existing GCal event. Ignores 404 (event already deleted)."""
        if not appointment.gcal_event_id:
            return
        creds = self.get_credentials(token)
        service = build("calendar", "v3", credentials=creds)
        body = self._build_event_body(appointment, patient_name)
        try:
            service.events().update(
                calendarId=token.calendar_id,
                eventId=appointment.gcal_event_id,
                body=body,
            ).execute()
        except HttpError as exc:
            if exc.status_code not in (404, 410):
                raise

    def delete_event(self, token: GoogleCalendarToken, gcal_event_id: str) -> None:
        """Delete a GCal event. Ignores 404/410 (already deleted)."""
        creds = self.get_credentials(token)
        service = build("calendar", "v3", credentials=creds)
        try:
            service.events().delete(
                calendarId=token.calendar_id, eventId=gcal_event_id
            ).execute()
        except HttpError as exc:
            if exc.status_code not in (404, 410):
                raise

    def list_upcoming_external_events(
        self, token: GoogleCalendarToken, days_ahead: int = 30
    ) -> list[dict]:
        """Return upcoming GCal events NOT created by psyque (no psyque_appointment_id)."""
        creds = self.get_credentials(token)
        service = build("calendar", "v3", credentials=creds)
        now = datetime.now(tz=timezone.utc)
        time_max = now + timedelta(days=days_ahead)

        result = (
            service.events()
            .list(
                calendarId=token.calendar_id,
                timeMin=now.isoformat(),
                timeMax=time_max.isoformat(),
                singleEvents=True,
                orderBy="startTime",
                fields="items(id,status,summary,start,end,extendedProperties)",
                maxResults=500,
            )
            .execute()
        )

        return [
            e
            for e in result.get("items", [])
            if e.get("status") != "cancelled"
            and not (
                e.get("extendedProperties", {})
                .get("private", {})
                .get("psyque_appointment_id")
            )
        ]

    def _create_flow(self) -> Flow:
        return Flow.from_client_config(
            {
                "web": {
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [settings.google_redirect_uri],
                }
            },
            scopes=SCOPES,
            redirect_uri=settings.google_redirect_uri,
        )

    @staticmethod
    def _build_event_body(appointment, patient_name: str) -> dict:
        session_label = SESSION_TYPE_LABELS.get(appointment.session_type, appointment.session_type)
        modality_label = MODALITY_LABELS.get(appointment.modality, appointment.modality)
        return {
            "summary": f"{patient_name} — {session_label}",
            "description": f"Modalidad: {modality_label}\n\nGestionado desde Psyque App.",
            "start": {
                "dateTime": appointment.scheduled_start.isoformat(),
                "timeZone": "America/Bogota",
            },
            "end": {
                "dateTime": appointment.scheduled_end.isoformat(),
                "timeZone": "America/Bogota",
            },
            "extendedProperties": {
                "private": {"psyque_appointment_id": str(appointment.id)}
            },
            "reminders": {"useDefault": False},
        }

    @staticmethod
    def sign_state(tenant_id: str) -> str:
        """Generate HMAC-signed state for OAuth2 CSRF protection: `tenant_id:sig`."""
        key = settings.supabase_service_key[:32].encode()
        sig = hmac.new(key, tenant_id.encode(), hashlib.sha256).hexdigest()[:16]
        return f"{tenant_id}:{sig}"

    @staticmethod
    def verify_state(state: str) -> str:
        """Verify state signature and return tenant_id. Raises GCalAuthError if invalid."""
        parts = state.split(":", 1)
        if len(parts) != 2:
            raise GCalAuthError("Invalid OAuth state format.")
        tenant_id, sig = parts
        key = settings.supabase_service_key[:32].encode()
        expected_sig = hmac.new(key, tenant_id.encode(), hashlib.sha256).hexdigest()[:16]
        if not hmac.compare_digest(sig, expected_sig):
            raise GCalAuthError("OAuth state signature mismatch.")
        return tenant_id