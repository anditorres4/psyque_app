"""GCalSyncService — business logic for Google Calendar bidirectional sync."""
import uuid
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import insert

from app.models.gcal_external_block import GCalExternalBlock
from app.models.patient import Patient
from app.services.gcal_service import GCalService


class GCalSyncService:
    def __init__(self, db) -> None:
        self.db = db
        self._gcal = GCalService(db)

    def push_appointment(self, tenant_id: uuid.UUID, appointment, action: str) -> None:
        """Sync one appointment change to Google Calendar.

        action: "create" | "update" | "cancel"
        Silently skips if tenant not connected or sync disabled.
        """
        token = self._gcal.get_token(tenant_id)
        if not token or not token.sync_enabled:
            return

        if action == "cancel":
            if appointment.gcal_event_id:
                self._gcal.delete_event(token, appointment.gcal_event_id)
                appointment.gcal_event_id = None
                self.db.commit()
            return

        patient = self.db.get(Patient, appointment.patient_id)
        patient_name = patient.full_name if patient else "Paciente"

        if not appointment.gcal_event_id:
            gcal_id = self._gcal.create_event(token, appointment, patient_name)
            appointment.gcal_event_id = gcal_id
            self.db.commit()
        else:
            self._gcal.update_event(token, appointment, patient_name)

    def pull_external_blocks(self, tenant_id: uuid.UUID) -> None:
        """Fetch upcoming external GCal events and upsert into gcal_external_blocks."""
        token = self._gcal.get_token(tenant_id)
        if not token or not token.sync_enabled:
            return

        external_events = self._gcal.list_upcoming_external_events(token)
        now = datetime.now(tz=timezone.utc)
        current_ids: set[str] = set()

        for event in external_events:
            gcal_event_id = event["id"]
            start = self._parse_event_dt(event.get("start", {}))
            end = self._parse_event_dt(event.get("end", {}))

            if not start or not end or end <= now:
                continue

            current_ids.add(gcal_event_id)

            stmt = (
                insert(GCalExternalBlock)
                .values(
                    tenant_id=tenant_id,
                    gcal_event_id=gcal_event_id,
                    start_time=start,
                    end_time=end,
                    synced_at=now,
                )
                .on_conflict_do_update(
                    constraint="uix_gcal_ext_blocks_tenant_event",
                    set_={"start_time": start, "end_time": end, "synced_at": now},
                )
            )
            self.db.execute(stmt)

        if current_ids:
            self.db.query(GCalExternalBlock).filter(
                GCalExternalBlock.tenant_id == tenant_id,
                GCalExternalBlock.gcal_event_id.not_in(current_ids),
            ).delete(synchronize_session=False)
        else:
            self.db.query(GCalExternalBlock).filter(
                GCalExternalBlock.tenant_id == tenant_id
            ).delete(synchronize_session=False)

        self.db.commit()

    @staticmethod
    def _parse_event_dt(dt_dict: dict) -> datetime | None:
        """Parse dateTime or date from a GCal event start/end dict."""
        if not dt_dict:
            return None
        if "dateTime" in dt_dict:
            try:
                return datetime.fromisoformat(dt_dict["dateTime"]).astimezone(timezone.utc)
            except ValueError:
                return None
        if "date" in dt_dict:
            try:
                d = datetime.strptime(dt_dict["date"], "%Y-%m-%d")
                return d.replace(tzinfo=timezone.utc)
            except ValueError:
                return None
        return None


def sync_appointment_background(tenant_id_str: str, appointment_id_str: str, action: str) -> None:
    """Standalone function for FastAPI BackgroundTasks."""
    from app.core.database import SessionLocal
    from app.models.appointment import Appointment

    with SessionLocal() as db:
        try:
            appt = db.get(Appointment, uuid.UUID(appointment_id_str))
            if appt:
                GCalSyncService(db).push_appointment(uuid.UUID(tenant_id_str), appt, action)
        except Exception:
            pass