"""Patient business logic: CRUD, HC number generation, search, pagination."""
from __future__ import annotations

import math
from datetime import date, datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.patient import Patient
from app.schemas.patient import (
    PaginatedPatients,
    PatientSummary,
)


# ---------------------------------------------------------------------------
# Domain exceptions
# ---------------------------------------------------------------------------
class PatientNotFoundError(Exception):
    """Raised when a patient UUID doesn't exist for the current tenant."""
    pass


class DuplicateDocumentError(Exception):
    """Raised when doc_type + doc_number already exists for the current tenant."""
    pass


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------
class PatientService:
    """All patient operations for a single authenticated tenant.

    Args:
        db: SQLAlchemy session with tenant context already set via set_tenant_context().
        tenant_id: UUID string of the authenticated tenant.
    """

    def __init__(self, db: Session, tenant_id: str) -> None:
        self.db = db
        self.tenant_id = tenant_id

    # ------------------------------------------------------------------
    # HC Number generation — HC-YYYY-NNNN, sequential per tenant per year
    # ------------------------------------------------------------------
    def _next_hc_number(self) -> str:
        """Generate the next HC number for this tenant in the current year.

        Uses MAX on the numeric suffix to avoid collisions. Safe within a
        single transaction because INSERT is atomic and RLS prevents other
        tenants from affecting the count.

        Returns:
            HC number string in format HC-YYYY-NNNN.
        """
        year = date.today().year
        prefix = f"HC-{year}-"

        result = self.db.execute(
            text("""
                SELECT COALESCE(
                    MAX(CAST(SPLIT_PART(hc_number, '-', 3) AS INTEGER)),
                    0
                ) + 1 AS next_num
                FROM patients
                WHERE tenant_id = :tid
                  AND hc_number LIKE :prefix
            """),
            {"tid": self.tenant_id, "prefix": f"{prefix}%"},
        ).scalar()

        return f"{prefix}{result:04d}"

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------
    def create(self, data: dict, *, client_ip: str) -> Patient:
        """Create a new patient record.

        Args:
            data: Dict matching PatientCreate fields (consent_accepted already validated).
            client_ip: Client IP address from HTTP request (stored for Ley 1581/2012).

        Returns:
            Newly created Patient ORM instance.

        Raises:
            DuplicateDocumentError: If doc_type + doc_number already exists for tenant.
        """
        # Check for duplicate doc_number within tenant
        existing = self.db.execute(
            text("""
                SELECT id FROM patients
                WHERE tenant_id = :tid
                  AND doc_type = :doc_type
                  AND doc_number = :doc_number
            """),
            {
                "tid": self.tenant_id,
                "doc_type": data["doc_type"],
                "doc_number": data["doc_number"],
            },
        ).fetchone()

        if existing:
            raise DuplicateDocumentError(
                f"Ya existe un paciente con {data['doc_type']} {data['doc_number']}."
            )

        hc_number = self._next_hc_number()
        patient = Patient(
            tenant_id=self.tenant_id,
            hc_number=hc_number,
            doc_type=data["doc_type"],
            doc_number=data["doc_number"],
            first_surname=data["first_surname"],
            second_surname=data.get("second_surname"),
            first_name=data["first_name"],
            second_name=data.get("second_name"),
            birth_date=data["birth_date"],
            biological_sex=data["biological_sex"],
            gender_identity=data.get("gender_identity"),
            marital_status=data["marital_status"],
            occupation=data["occupation"],
            address=data["address"],
            municipality_dane=data["municipality_dane"],
            zone=data["zone"],
            phone=data["phone"],
            email=data.get("email"),
            emergency_contact_name=data.get("emergency_contact_name"),
            emergency_contact_phone=data.get("emergency_contact_phone"),
            payer_type=data["payer_type"],
            eps_name=data.get("eps_name"),
            eps_code=data.get("eps_code"),
            authorization_number=data.get("authorization_number"),
            consent_signed_at=datetime.now(tz=timezone.utc),
            consent_ip=client_ip,
        )
        self.db.add(patient)
        self.db.flush()  # Get the generated UUID without committing
        self.db.refresh(patient)
        return patient

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------
    def get_by_id(self, patient_id: str) -> Patient:
        """Fetch a single patient by UUID.

        RLS ensures only this tenant's patients are visible — a different
        tenant's patient UUID returns NotFound, never Forbidden.

        Args:
            patient_id: UUID string.

        Returns:
            Patient ORM instance.

        Raises:
            PatientNotFoundError: If not found (including cross-tenant access attempts).
        """
        patient = self.db.get(Patient, patient_id)
        if not patient:
            raise PatientNotFoundError(f"Paciente {patient_id} no encontrado.")
        return patient

    def list(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        active_only: bool | None = None,
        has_eps: bool | None = None,
    ) -> PaginatedPatients:
        """Return paginated patient list for the current tenant.

        Args:
            page: 1-based page number.
            page_size: Results per page (max 100).
            active_only: If True, only active patients; if False, only inactive; None = all.
            has_eps: If True, only patients with EPS; if False, only without; None = all.

        Returns:
            PaginatedPatients with items, total, page, page_size, pages.
        """
        page_size = min(page_size, 100)
        offset = (page - 1) * page_size

        conditions = ["tenant_id = :tid"]
        params: dict = {"tid": self.tenant_id}

        if active_only is True:
            conditions.append("is_active = true")
        elif active_only is False:
            conditions.append("is_active = false")

        if has_eps is True:
            conditions.append("eps_code IS NOT NULL")
        elif has_eps is False:
            conditions.append("eps_code IS NULL")

        where = " AND ".join(conditions)

        total = self.db.execute(
            text(f"SELECT COUNT(*) FROM patients WHERE {where}"),
            params,
        ).scalar() or 0

        rows = self.db.execute(
            text(f"""
                SELECT * FROM patients
                WHERE {where}
                ORDER BY first_surname, first_name
                LIMIT :limit OFFSET :offset
            """),
            {**params, "limit": page_size, "offset": offset},
        ).mappings().fetchall()

        items = [PatientSummary.model_validate(dict(r)) for r in rows]
        return PaginatedPatients(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            pages=math.ceil(total / page_size) if total > 0 else 1,
        )

    def search(self, query: str, *, limit: int = 10) -> list[PatientSummary]:
        """Full-text search on name, surname, and document number.

        Args:
            query: Search string (case-insensitive prefix match).
            limit: Maximum number of results.

        Returns:
            List of PatientSummary ordered by relevance (surname, name).
        """
        q = f"%{query.lower()}%"
        rows = self.db.execute(
            text("""
                SELECT * FROM patients
                WHERE tenant_id = :tid
                  AND (
                      LOWER(first_surname) LIKE :q
                   OR LOWER(second_surname) LIKE :q
                   OR LOWER(first_name) LIKE :q
                   OR LOWER(doc_number) LIKE :q
                  )
                ORDER BY first_surname, first_name
                LIMIT :limit
            """),
            {"tid": self.tenant_id, "q": q, "limit": limit},
        ).mappings().fetchall()
        return [PatientSummary.model_validate(dict(r)) for r in rows]

    # ------------------------------------------------------------------
    # Update
    # ------------------------------------------------------------------
    def update(self, patient_id: str, data: dict) -> Patient:
        """Partial update of a patient record.

        Only fields present in data (non-None) are updated. doc_type,
        doc_number, birth_date, consent_*, and hc_number cannot be changed
        after creation.

        Args:
            patient_id: UUID string.
            data: Dict of fields to update (from PatientUpdate schema).

        Returns:
            Updated Patient ORM instance.

        Raises:
            PatientNotFoundError: If patient doesn't exist for this tenant.
        """
        # Immutable fields — never allow update
        immutable = {
            "doc_type", "doc_number", "birth_date",
            "consent_signed_at", "consent_ip", "hc_number", "tenant_id",
        }
        update_data = {k: v for k, v in data.items() if v is not None and k not in immutable}

        if not update_data:
            return self.get_by_id(patient_id)

        set_clause = ", ".join(f"{k} = :{k}" for k in update_data)
        result = self.db.execute(
            text(f"""
                UPDATE patients
                SET {set_clause}
                WHERE id = :pid AND tenant_id = :tid
                RETURNING id
            """),
            {**update_data, "pid": patient_id, "tid": self.tenant_id},
        ).fetchone()

        if not result:
            raise PatientNotFoundError(f"Paciente {patient_id} no encontrado.")

        self.db.expire_all()
        return self.get_by_id(patient_id)
