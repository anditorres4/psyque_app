"""Profile service — tenant profile management."""
import secrets
import string
import uuid

from sqlalchemy.orm import Session as DBSession

from app.models.tenant import Tenant


def _generate_booking_slug() -> str:
    """Genera un slug aleatorio de 10 chars alfanuméricos, URL-safe."""
    alphabet = string.ascii_lowercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(10))


class ProfileService:
    def __init__(self, db: DBSession, tenant_id: str) -> None:
        self.db = db
        self._tenant_id = uuid.UUID(tenant_id)

    def get_profile(self) -> Tenant:
        tenant = self.db.get(Tenant, self._tenant_id)
        if not tenant:
            raise ValueError("Perfil no encontrado")
        return tenant

    def update_profile(self, data: dict) -> Tenant:
        tenant = self.get_profile()
        allowed = {
            "full_name", "colpsic_number", "reps_code", "nit", "city",
            "session_duration_min", "booking_enabled", "booking_welcome_message",
        }
        for field, value in data.items():
            if field in allowed and value is not None:
                setattr(tenant, field, value)

        if tenant.booking_enabled and not tenant.booking_slug:
            tenant.booking_slug = _generate_booking_slug()

        self.db.commit()
        self.db.refresh(tenant)
        return tenant