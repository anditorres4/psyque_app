"""RIPS generation service (Res. 2275/2023).

Aggregates signed sessions for a given month/year and generates the RIPS
JSON structure required by EPS/aseguradoras.
"""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from io import BytesIO
from typing import Any
from zipfile import ZipFile, ZIP_DEFLATED

from sqlalchemy.orm import Session as DBSession

from app.core.constants import ADRES_DOC_TYPES
from app.models.patient import Patient
from app.models.rips_export import RipsExport
from app.models.session import Session
from app.models.tenant import Tenant


class RipsGenerationError(Exception):
    pass


class RipsService:
    """Generate RIPS JSON exports for EPS/aseguradoras."""

    def __init__(self, db: DBSession, tenant_id: str) -> None:
        self.db = db
        self.tenant_id = tenant_id
        self._tenant_uuid = uuid.UUID(tenant_id)

    def _get_date_range(self, year: int, month: int) -> tuple[datetime, datetime]:
        """Get start and end datetime for a month."""
        start_date = datetime(year, month, 1, 0, 0, 0, tzinfo=timezone.utc)
        if month == 12:
            end_date = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        else:
            end_date = datetime(year, month + 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        return start_date, end_date

    def _fetch_sessions_and_patients(
        self, year: int, month: int
    ) -> tuple[list[Session], dict[uuid.UUID, Patient]]:
        """Fetch signed sessions and their patients for a given period."""
        start_date, end_date = self._get_date_range(year, month)

        sessions = (
            self.db.query(Session)
            .filter(
                Session.tenant_id == self._tenant_uuid,
                Session.status == "signed",
                Session.actual_start >= start_date,
                Session.actual_start < end_date,
            )
            .order_by(Session.actual_start)
            .all()
        )

        patient_ids = set(s.patient_id for s in sessions)
        patients = {
            p.id: p
            for p in self.db.query(Patient)
            .filter(Patient.id.in_(patient_ids))
            .all()
        }

        return sessions, patients

    def validate(self, year: int, month: int) -> dict[str, Any]:
        """Validate sessions for RIPS generation.

        Returns:
            dict with keys: valid, errors, warnings, sessions_count, sessions, patients
        """
        errors: list[dict[str, Any]] = []
        warnings: list[dict[str, Any]] = []

        tenant = self.db.get(Tenant, self._tenant_uuid)
        if not tenant:
            return {
                "valid": False,
                "errors": [{"field": "tenant", "message": "Tentante no encontrado"}],
                "warnings": [],
                "sessions_count": 0,
                "sessions": [],
                "patients": {},
            }

        if not tenant.reps_code:
            errors.append({
                "field": "tenant.reps_code",
                "message": "Código REPS del prestador no configurado",
            })
        if not tenant.nit:
            errors.append({
                "field": "tenant.nit",
                "message": "NIT del prestador no configurado",
            })

        sessions, patients = self._fetch_sessions_and_patients(year, month)

        if not sessions:
            errors.append({
                "field": "sessions",
                "message": f"No hay sesiones firmadas en el período {year:04d}-{month:02d}",
            })
            return {
                "valid": False,
                "errors": errors,
                "warnings": warnings,
                "sessions_count": 0,
                "sessions": [],
                "patients": {},
            }

        for sess in sessions:
            patient = patients.get(sess.patient_id)
            if not patient:
                continue

            if patient.doc_type not in ADRES_DOC_TYPES:
                errors.append({
                    "session_id": str(sess.id),
                    "field": "patient.doc_type",
                    "value": patient.doc_type,
                    "message": f"Tipo de documento inválido: {patient.doc_type}. Valores válidos: {', '.join(sorted(ADRES_DOC_TYPES))}",
                })

            if not sess.diagnosis_cie11 or not sess.diagnosis_cie11.strip():
                errors.append({
                    "session_id": str(sess.id),
                    "field": "session.diagnosis_cie11",
                    "value": sess.diagnosis_cie11,
                    "message": "Diagnóstico CIE-11 no puede estar vacío",
                })

            if not sess.cups_code or not sess.cups_code.strip():
                errors.append({
                    "session_id": str(sess.id),
                    "field": "session.cups_code",
                    "value": sess.cups_code,
                    "message": "Código CUPS no puede estar vacío",
                })

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "sessions_count": len(sessions),
            "sessions": sessions,
            "patients": patients,
        }

    def generate(self, year: int, month: int) -> RipsExport:
        """Generate RIPS export for signed sessions in the given period.

        Args:
            year: Year (e.g., 2026)
            month: Month (1-12)

        Returns:
            RipsExport record with generated snapshot.
        """
        existing = self.db.query(RipsExport).filter(
            RipsExport.tenant_id == self._tenant_uuid,
            RipsExport.period_year == year,
            RipsExport.period_month == month,
        ).first()
        if existing and existing.status == "generated":
            raise RipsGenerationError(
                f"Ya existe exportación RIPS para {year:04d}-{month:02d}. "
                "Genere un nuevo período o descárguelo."
            )

        validation = self.validate(year, month)
        if not validation["valid"]:
            raise RipsGenerationError(
                f"Hay errores de validación: {len(validation['errors'])} error(es). "
                "Use /rips/validate para ver los detalles."
            )

        sessions = validation["sessions"]
        patients = validation["patients"]

        tenant = self.db.get(Tenant, self._tenant_uuid)
        if not tenant:
            raise RipsGenerationError("Tentante no encontrado.")

        snapshot = self._build_snapshot(tenant, sessions, patients, year, month)
        zip_bytes = self._build_zip_from_snapshot(snapshot, year, month)
        zip_hash = hashlib.sha256(zip_bytes).hexdigest()

        validation_errors: dict[str, Any] | None = None
        if validation.get("warnings"):
            validation_errors = {"warnings": validation["warnings"]}

        export = RipsExport(
            id=uuid.uuid4(),
            tenant_id=self._tenant_uuid,
            period_year=year,
            period_month=month,
            status="generated",
            sessions_count=len(sessions),
            total_value_cop=sum(s.session_fee for s in sessions),
            json_file_path=f"rips_{year:04d}{month:02d}_{self.tenant_id[:8]}.zip",
            file_hash=zip_hash,
            generated_at=datetime.now(tz=timezone.utc),
            validation_errors=validation_errors,
            snapshot=snapshot,
        )
        self.db.add(export)

        for sess in sessions:
            sess.rips_included = True
        self.db.flush()
        self.db.refresh(export)

        return export

    def _build_snapshot(
        self,
        tenant: Tenant,
        sessions: list[Session],
        patients: dict[uuid.UUID, Patient],
        year: int,
        month: int,
    ) -> dict[str, Any]:
        """Build RIPS snapshot structure per Res. 2275/2023."""
        usuarios: list[dict[str, Any]] = []
        consultas: list[dict[str, Any]] = []
        procedimientos: list[dict[str, Any]] = []
        seen_patients: set[uuid.UUID] = set()

        for sess in sessions:
            patient = patients.get(sess.patient_id)
            if not patient:
                continue

            if sess.patient_id not in seen_patients:
                seen_patients.add(sess.patient_id)
                usuarios.append({
                    "tipoId": patient.doc_type,
                    "id": patient.doc_number,
                    "apellido1": patient.first_surname,
                    "apellido2": patient.second_surname or "",
                    "nombre1": patient.first_name,
                    "nombre2": patient.second_name or "",
                    "fechaNacimiento": patient.birth_date.isoformat(),
                    "sexo": patient.biological_sex,
                    "codEPS": patient.eps_code or "",
                    "tipoUsuario": patient.payer_type,
                })

            date_str = sess.actual_start.date().isoformat()
            time_str = sess.actual_start.strftime("%H:%M")

            consultas.append({
                "fecha": date_str,
                "hora": time_str,
                "tipoIdPrestador": "RT",
                "idPrestador": tenant.nit or "",
                "codPrestador": tenant.reps_code or "",
                "tipoIdUsuario": patient.doc_type,
                "idUsuario": patient.doc_number,
                "codConsulta": sess.cups_code,
                "dxPrincipal": sess.diagnosis_cie11,
                "tipoDxPrincipal": sess.tipo_dx_principal,
                "valorConsulta": sess.session_fee,
                "numAutorizacion": sess.authorization_number or "",
            })

            procedimientos.append({
                "fecha": date_str,
                "hora": time_str,
                "tipoIdPrestador": "RT",
                "idPrestador": tenant.nit or "",
                "codPrestador": tenant.reps_code or "",
                "tipoIdUsuario": patient.doc_type,
                "idUsuario": patient.doc_number,
                "codProcedimiento": sess.cups_code,
                "dxPrincipal": sess.diagnosis_cie11,
                "cantidad": 1,
                "valorProcedimiento": sess.session_fee,
            })

        return {
            "header": {
                "codPrestador": tenant.reps_code or "",
                "tipoIdPrestador": "RT",
                "idPrestador": tenant.nit or "",
                "periodo": f"{year:04d}{month:02d}",
                "fechaGeneracion": datetime.now(tz=timezone.utc).isoformat(),
                "cantUsuarios": len(usuarios),
                "cantConsultas": len(consultas),
                "cantProcedimientos": len(procedimientos),
                "valorTotal": sum(s.session_fee for s in sessions),
            },
            "usuarios": usuarios,
            "consultas": consultas,
            "procedimientos": procedimientos,
        }

    def _build_zip_from_snapshot(
        self,
        snapshot: dict[str, Any],
        year: int,
        month: int,
    ) -> bytes:
        """Build ZIP file from snapshot data."""
        prefix = f"rips_{year:04d}{month:02d}"

        buffer = BytesIO()
        with ZipFile(buffer, "w", ZIP_DEFLATED) as zf:
            zf.writestr(
                f"{prefix}_AC.json",
                json.dumps(snapshot["usuarios"], ensure_ascii=False, indent=2),
            )
            zf.writestr(
                f"{prefix}_AD.json",
                json.dumps(snapshot["consultas"], ensure_ascii=False, indent=2),
            )
            zf.writestr(
                f"{prefix}_AP.json",
                json.dumps(snapshot["procedimientos"], ensure_ascii=False, indent=2),
            )
            zf.writestr(
                f"{prefix}_header.json",
                json.dumps(snapshot["header"], ensure_ascii=False, indent=2),
            )

        return buffer.getvalue()

    def list_exports(
        self,
        limit: int = 20,
    ) -> list[RipsExport]:
        """List recent RIPS exports for this tenant."""
        return (
            self.db.query(RipsExport)
            .filter(RipsExport.tenant_id == self._tenant_uuid)
            .order_by(RipsExport.generated_at.desc())
            .limit(limit)
            .all()
        )

    def get_export(self, export_id: str) -> RipsExport:
        """Get a specific RIPS export by ID."""
        export = self.db.get(RipsExport, uuid.UUID(export_id))
        if not export or export.tenant_id != self._tenant_uuid:
            raise RipsGenerationError("Exportación no encontrada.")
        return export

    def download_zip(self, export_id: str) -> bytes:
        """Build and return a RIPS ZIP archive for the given export.

        Uses snapshot stored during generation to ensure consistency.
        """
        export = self.get_export(export_id)
        if export.status != "generated":
            raise RipsGenerationError(
                "La exportación aún no está generada."
            )

        if not export.snapshot:
            raise RipsGenerationError(
                "Exportación corrupta: snapshot no encontrado."
            )

        return self._build_zip_from_snapshot(
            export.snapshot,
            export.period_year,
            export.period_month,
        )
