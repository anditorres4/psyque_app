"""APScheduler job: pull external Google Calendar events for all connected tenants."""
from app.models.gcal_token import GoogleCalendarToken
from app.services.gcal_sync_service import GCalSyncService


def run_gcal_sync(session_factory) -> None:
    """Fetch external GCal events for every tenant with sync enabled.

    Runs every 15 minutes via APScheduler. Errors per tenant are isolated.
    """
    with session_factory() as db:
        tokens = (
            db.query(GoogleCalendarToken)
            .filter(GoogleCalendarToken.sync_enabled.is_(True))
            .all()
        )
        sync = GCalSyncService(db)
        for token in tokens:
            try:
                sync.pull_external_blocks(token.tenant_id)
            except Exception:
                pass