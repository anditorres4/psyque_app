"""Profile service — tenant profile management."""
import uuid

from sqlalchemy.orm import Session as DBSession

from app.models.tenant import Tenant


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
        allowed = {"full_name", "colpsic_number", "reps_code", "nit", "city", "session_duration_min"}
        for field, value in data.items():
            if field in allowed and value is not None:
                setattr(tenant, field, value)
        self.db.commit()
        self.db.refresh(tenant)
        return tenant