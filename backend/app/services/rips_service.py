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
from pathlib import Path
from typing import Any, Set
from zipfile import ZipFile, ZIP_DEFLATED

from sqlalchemy.orm import Session as DBSession

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

    def generate(self, year: int, month: int) -> RipsExport:
        """Generate RIPS JSON for signed sessions in the given period.

        Args:
            year: Year (e.g., 2026)
            month: Month (1-12)

        Returns:
            RipsExport record with generated JSON file path.
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

        start_date = datetime(year, month, 1, 0, 0, 0, tzinfo=timezone.utc)
        if month == 12:
            end_date = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        else:
            end_date = datetime(year, month + 1, 1, 0, 0, 0, tzinfo=timezone.utc)

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

        if not sessions:
            raise RipsGenerationError(
                f"No hay sesiones firmadas en el período {year:04d}-{month:02d}."
            )

        tenant = self.db.get(Tenant, self._tenant_uuid)
        if not tenant:
            raise RipsGenerationError("Tentante no encontrado.")

        rips_json = self._build_rips_json(tenant, sessions, year, month)

        json_content = json.dumps(rips_json, ensure_ascii=False, indent=2)
        json_hash = hashlib.sha256(json_content.encode("utf-8")).hexdigest()

        export = RipsExport(
            id=uuid.uuid4(),
            tenant_id=self._tenant_uuid,
            period_year=year,
            period_month=month,
            status="generated",
            sessions_count=len(sessions),
            total_value_cop=sum(s.session_fee for s in sessions),
            json_file_path=f"rips_{year:04d}{month:02d}_{self.tenant_id[:8]}.json",
            file_hash=json_hash,
            generated_at=datetime.now(tz=timezone.utc),
            validation_errors=None,
        )
        self.db.add(export)

        for sess in sessions:
            sess.rips_included = True
        self.db.flush()
        self.db.refresh(export)

        return export

    def _build_rips_json(
        self,
        tenant: Tenant,
        sessions: list[Session],
        year: int,
        month: int,
    ) -> dict[str, Any]:
        """Build RIPS JSON structure per Res. 2275/2023."""
        patient_ids = set(s.patient_id for s in sessions)
        patients = {
            p.id: p
            for p in self.db.query(Patient).filter(
                Patient.id.in_(patient_ids)
            ).all()
        }

        usuarios_ids: Set[uuid.UUID] = set()
        usuarios = []
        consultas = []
        procedimientos = []

        for sess in sessions:
            patient = patients.get(sess.patient_id)
            if not patient:
                continue

            if sess.patient_id not in usuarios_ids:
                usuarios_ids.add(sess.patient_id)
                usuarios.append({
                    "tipo_id": patient.doc_type,
                    "num_id": patient.doc_number,
                    "apellido1": patient.first_surname,
                    "apellido2": patient.second_surname or "",
                    "nombre1": patient.first_name,
                    "nombre2": patient.second_name or "",
                    "Sexo": patient.biological_sex,
                    "fecha_nacimiento": patient.birth_date.isoformat(),
                    "cod_eps": patient.eps_code or "",
                    "tipo_usuario": patient.payer_type,
                })

            date_str = sess.actual_start.date().isoformat()
            time_str = sess.actual_start.strftime("%H:%M")

            consultas.append({
                "fecha": date_str,
                "hora": time_str,
                "tipo_id": patient.doc_type,
                "num_id": patient.doc_number,
                "cod_prestador": tenant.reps_code or "",
                "tipo_doc_prestador": "RT",
                "num_doc_prestador": tenant.nit or "",
                "cod_consulta": sess.cups_code,
                "dx": sess.diagnosis_cie11,
                "tipo_dx": "1",
                "valor": sess.session_fee,
                "autorizacion": sess.authorization_number or "",
            })

            procedimientos.append({
                "fecha": date_str,
                "hora": time_str,
                "tipo_id": patient.doc_type,
                "num_id": patient.doc_number,
                "cod_prestador": tenant.reps_code or "",
                "tipo_doc_prestador": "RT",
                "num_doc_prestador": tenant.nit or "",
                "cod_procedimiento": sess.cups_code,
                "dx": sess.diagnosis_cie11,
                "cantidad": 1,
                "valor": sess.session_fee,
            })

        return {
            "header": {
                "cod_prestador": tenant.reps_code or "",
                "tipo_doc_prestador": "RT",
                "num_doc_prestador": tenant.nit or "",
                "periodo": f"{year:04d}{month:02d}",
                "fecha_generacion": datetime.now(tz=timezone.utc).isoformat(),
                "cant_usuarios": len(usuarios),
                "cant_consultas": len(consultas),
                "cant_procedimientos": len(procedimientos),
            },
            "usuarios": usuarios,
            "consultas": consultas,
            "procedimientos": procedimientos,
        }

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

        The ZIP contains individual JSON files per RIPS table (AC, AD, AP)
        following the Res. 2275/2023 format used by EPS in Colombia.
        """
        export = self.get_export(export_id)
        if export.status != "generated":
            raise RipsGenerationError(
                "La exportación aún no está generada."
            )

        year = export.period_year
        month = export.period_month
        prefix = f"rips_{year:04d}{month:02d}"
        tenant = self.db.get(Tenant, self._tenant_uuid)

        if not tenant:
            raise RipsGenerationError("Tentante no encontrado.")

        start_date = datetime(year, month, 1, 0, 0, 0, tzinfo=timezone.utc)
        if month == 12:
            end_date = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        else:
            end_date = datetime(year, month + 1, 1, 0, 0, 0, tzinfo=timezone.utc)

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

        if not sessions:
            raise RipsGenerationError("No hay sesiones para exportar.")

        buffer = BytesIO()
        with ZipFile(buffer, "w", ZIP_DEFLATED) as zf:
            patient_ids = set(s.patient_id for s in sessions)
            patients = {
                p.id: p
                for p in self.db.query(Patient)
                .filter(Patient.id.in_(patient_ids))
                .all()
            }

            usuarios_data: list[dict[str, Any]] = []
            consultas_data: list[dict[str, Any]] = []
            procedimientos_data: list[dict[str, Any]] = []
            seen_patients: set[uuid.UUID] = set()

            for sess in sessions:
                patient = patients.get(sess.patient_id)
                if not patient:
                    continue

                if sess.patient_id not in seen_patients:
                    seen_patients.add(sess.patient_id)
                    usuarios_data.append({
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

                consultas_data.append({
                    "fecha": date_str,
                    "hora": time_str,
                    "tipoIdPrestador": "RT",
                    "idPrestador": tenant.nit or "",
                    "codPrestador": tenant.reps_code or "",
                    "tipoIdUsuario": patient.doc_type,
                    "idUsuario": patient.doc_number,
                    "codConsulta": sess.cups_code,
                    "dxPrincipal": sess.diagnosis_cie11,
                    "tipoDxPrincipal": "1",
                    "valorConsulta": sess.session_fee,
                    "autorizacion": sess.authorization_number or "",
                })

                procedimientos_data.append({
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

            zf.writestr(
                f"{prefix}_AC.json",
                json.dumps(usuarios_data, ensure_ascii=False, indent=2),
            )
            zf.writestr(
                f"{prefix}_AD.json",
                json.dumps(consultas_data, ensure_ascii=False, indent=2),
            )
            zf.writestr(
                f"{prefix}_AP.json",
                json.dumps(procedimientos_data, ensure_ascii=False, indent=2),
            )
            zf.writestr(
                f"{prefix}_header.json",
                json.dumps({
                    "codPrestador": tenant.reps_code or "",
                    "tipoIdPrestador": "RT",
                    "idPrestador": tenant.nit or "",
                    "periodo": f"{year:04d}{month:02d}",
                    "fechaGeneracion": datetime.now(tz=timezone.utc).isoformat(),
                    "cantUsuarios": len(usuarios_data),
                    "cantConsultas": len(consultas_data),
                    "cantProcedimientos": len(procedimientos_data),
                    "valorTotal": sum(s.session_fee for s in sessions),
                }, ensure_ascii=False, indent=2),
            )

        return buffer.getvalue()