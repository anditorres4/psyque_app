"""BookingService — generación de slots y gestión de solicitudes."""
import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.availability import AvailabilityBlock
from app.models.booking_request import BookingRequest
from app.models.gcal_external_block import GCalExternalBlock
from app.models.patient import Patient
from app.models.tenant import Tenant

BOGOTA_TZ = ZoneInfo("America/Bogota")


class BookingNotFoundError(Exception):
    pass


class BookingService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_tenant_by_slug(self, slug: str) -> Tenant:
        tenant = (
            self.db.query(Tenant)
            .filter(Tenant.booking_slug == slug, Tenant.booking_enabled.is_(True))
            .first()
        )
        if not tenant:
            raise BookingNotFoundError(slug)
        return tenant

    def get_available_slots(self, tenant: Tenant, days_ahead: int = 14) -> list[str]:
        """Retorna datetimes ISO8601 (TZ Bogotá) de slots libre."""
        tenant_uuid = tenant.id
        blocks = (
            self.db.query(AvailabilityBlock)
            .filter(AvailabilityBlock.tenant_id == tenant_uuid, AvailabilityBlock.is_active.is_(True))
            .all()
        )
        if not blocks:
            return []

        now_utc = datetime.now(tz=timezone.utc)
        future_cutoff = now_utc + timedelta(days=days_ahead + 1)

        existing_appts = (
            self.db.query(Appointment)
            .filter(
                Appointment.tenant_id == tenant_uuid,
                Appointment.status == "scheduled",
                Appointment.scheduled_start >= now_utc,
                Appointment.scheduled_start < future_cutoff,
            )
            .all()
        )

        pending_requests = (
            self.db.query(BookingRequest)
            .filter(
                BookingRequest.tenant_id == tenant_uuid,
                BookingRequest.status == "pending",
                BookingRequest.requested_start >= now_utc,
                BookingRequest.requested_start < future_cutoff,
            )
            .all()
        )

        external_blocks = (
            self.db.query(GCalExternalBlock)
            .filter(
                GCalExternalBlock.tenant_id == tenant_uuid,
                GCalExternalBlock.end_time > now_utc,
                GCalExternalBlock.start_time < future_cutoff,
            )
            .all()
        )

        session_min = tenant.session_duration_min
        today = datetime.now(tz=BOGOTA_TZ).date()
        slots: list[str] = []

        for delta in range(1, days_ahead + 1):
            day = today + timedelta(days=delta)
            weekday = day.weekday()

            for block in blocks:
                if block.day_of_week != weekday:
                    continue

                slot_dt = datetime.combine(day, block.start_time).replace(tzinfo=BOGOTA_TZ)
                block_end_dt = datetime.combine(day, block.end_time).replace(tzinfo=BOGOTA_TZ)

                while slot_dt + timedelta(minutes=session_min) <= block_end_dt:
                    slot_end = slot_dt + timedelta(minutes=session_min)
                    slot_utc = slot_dt.astimezone(timezone.utc)
                    slot_end_utc = slot_end.astimezone(timezone.utc)

                    busy = any(
                        a.scheduled_start < slot_end_utc and a.scheduled_end > slot_utc
                        for a in existing_appts
                    ) or any(
                        r.requested_start < slot_end_utc and r.requested_end > slot_utc
                        for r in pending_requests
                    ) or any(
                        b.start_time < slot_end_utc and b.end_time > slot_utc
                        for b in external_blocks
                    )

                    if not busy:
                        slots.append(slot_dt.isoformat())

                    slot_dt += timedelta(minutes=session_min)

        return slots

    def create_request(
        self, *, tenant: Tenant, patient_name: str, patient_email: str,
        patient_phone: str | None, session_type: str,
        requested_start: datetime, notes: str | None,
    ) -> BookingRequest:
        requested_end = requested_start + timedelta(minutes=tenant.session_duration_min)
        req = BookingRequest(
            tenant_id=tenant.id,
            patient_name=patient_name, patient_email=patient_email,
            patient_phone=patient_phone, session_type=session_type,
            requested_start=requested_start, requested_end=requested_end,
            notes=notes,
        )
        self.db.add(req)
        self.db.flush()
        self.db.refresh(req)
        return req

    def list_by_tenant(self, tenant_id: uuid.UUID, status: str | None = None) -> list[BookingRequest]:
        q = self.db.query(BookingRequest).filter(BookingRequest.tenant_id == tenant_id)
        if status:
            q = q.filter(BookingRequest.status == status)
        return q.order_by(BookingRequest.requested_start).all()

    def confirm(self, request_id: uuid.UUID, tenant_id: uuid.UUID) -> BookingRequest:
        req = self._get(request_id, tenant_id)
        req.status = "confirmed"

        valid_session_types = {"individual", "couple", "family", "followup"}
        session_type = req.session_type if req.session_type in valid_session_types else "individual"

        patient = (
            self.db.query(Patient)
            .filter(Patient.tenant_id == tenant_id, Patient.email == req.patient_email)
            .first()
        ) if req.patient_email else None

        if patient:
            appt = Appointment(
                tenant_id=tenant_id,
                patient_id=patient.id,
                scheduled_start=req.requested_start,
                scheduled_end=req.requested_end,
                session_type=session_type,
                modality="virtual",
                status="scheduled",
                notes=req.notes,
            )
            self.db.add(appt)
        else:
            # Patient unknown — generate 48h registration token
            req.registration_token = str(uuid.uuid4())
            req.registration_token_expires_at = datetime.now(tz=timezone.utc) + timedelta(hours=48)

        self.db.flush()
        self.db.refresh(req)
        return req

    def resend_registration(self, request_id: uuid.UUID, tenant_id: uuid.UUID) -> BookingRequest:
        """Regenerate registration token and reset 48h expiry."""
        req = self._get(request_id, tenant_id)
        if req.status != "confirmed" or req.registration_token_used_at is not None:
            raise BookingNotFoundError(str(request_id))
        req.registration_token = str(uuid.uuid4())
        req.registration_token_expires_at = datetime.now(tz=timezone.utc) + timedelta(hours=48)
        req.registration_token_used_at = None
        self.db.flush()
        self.db.refresh(req)
        return req

    def get_registration_info(self, token: str) -> tuple[BookingRequest, Tenant]:
        """Validate token and return booking request + tenant for form pre-fill."""
        req = (
            self.db.query(BookingRequest)
            .filter(BookingRequest.registration_token == token)
            .first()
        )
        self._validate_token(req)
        tenant = self.db.get(Tenant, req.tenant_id)
        return req, tenant

    def complete_registration(
        self,
        token: str,
        *,
        doc_type: str,
        doc_number: str,
        birth_date,
        biological_sex: str,
        phone: str,
    ) -> tuple[BookingRequest, Patient, Appointment]:
        """Create Patient + Appointment from token. Marks token as used."""
        from app.services.patient_service import PatientService

        req = (
            self.db.query(BookingRequest)
            .filter(BookingRequest.registration_token == token)
            .first()
        )
        self._validate_token(req)

        valid_session_types = {"individual", "couple", "family", "followup"}
        session_type = req.session_type if req.session_type in valid_session_types else "individual"

        # Idempotency: reuse existing patient on race condition
        patient = (
            self.db.query(Patient)
            .filter(Patient.tenant_id == req.tenant_id, Patient.email == req.patient_email)
            .first()
        )

        if not patient:
            parts = req.patient_name.strip().split()
            first_name = " ".join(parts[:-1]) if len(parts) > 1 else parts[0]
            first_surname = parts[-1] if len(parts) > 1 else "N/A"

            hc_number = PatientService(self.db, str(req.tenant_id))._next_hc_number()

            patient = Patient(
                tenant_id=req.tenant_id,
                hc_number=hc_number,
                doc_type=doc_type,
                doc_number=doc_number,
                first_name=first_name,
                first_surname=first_surname,
                birth_date=birth_date,
                biological_sex=biological_sex,
                phone=phone,
                email=req.patient_email,
            )
            self.db.add(patient)
            self.db.flush()
            self.db.refresh(patient)

        appt = Appointment(
            tenant_id=req.tenant_id,
            patient_id=patient.id,
            scheduled_start=req.requested_start,
            scheduled_end=req.requested_end,
            session_type=session_type,
            modality="virtual",
            status="scheduled",
            notes=req.notes,
        )
        self.db.add(appt)

        req.registration_token_used_at = datetime.now(tz=timezone.utc)
        self.db.flush()
        self.db.refresh(appt)
        return req, patient, appt

    def _validate_token(self, req: BookingRequest | None) -> None:
        if req is None:
            raise BookingNotFoundError("token_not_found")
        if req.registration_token_used_at is not None:
            raise BookingNotFoundError("token_used")
        if req.registration_token_expires_at and req.registration_token_expires_at < datetime.now(tz=timezone.utc):
            raise BookingNotFoundError("token_expired")

    def reject(self, request_id: uuid.UUID, tenant_id: uuid.UUID) -> BookingRequest:
        req = self._get(request_id, tenant_id)
        req.status = "rejected"
        self.db.flush()
        self.db.refresh(req)
        return req

    def _get(self, request_id: uuid.UUID, tenant_id: uuid.UUID) -> BookingRequest:
        req = self.db.get(BookingRequest, request_id)
        if not req or req.tenant_id != tenant_id:
            raise BookingNotFoundError(str(request_id))
        return req