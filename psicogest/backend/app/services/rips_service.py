"""RIPS generation service (Res. 0948/2026).

Aggregates signed sessions for a given month/year and generates the RIPS
JSON structure (v4.3 nested format) required by Res. 0948/2026
(which replaced Res. 2275/2023 on 14 May 2026).
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

from app.core.config import settings
from app.core.constants import ADRES_DOC_TYPES
from app.models.patient import Patient
from app.models.rips_export import RipsExport
from app.models.session import Session
from app.models.tenant import Tenant


class RipsGenerationError(Exception):
    pass


# Maps patient payer_type to SISPRO tipoUsuario code
_PAYER_TIPO: dict[str, str] = {
    "SS": "01",  # Contributivo EPS
    "CC": "11",  # Compañía de seguros
    "PA": "12",  # Particular / pago directo
    "PE": "12",
    "SE": "12",
}


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
        """Validate sessions for RIPS generation."""
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
        elif len(tenant.reps_code) != 12:
            errors.append({
                "field": "tenant.reps_code",
                "message": (
                    f"El codPrestador debe tener exactamente 12 caracteres "
                    f"(actual: '{tenant.reps_code}', {len(tenant.reps_code)} chars). "
                    "Formato: NIT relleno a 10 dígitos + 2 dígitos de sede. "
                    "Ej: NIT 902058078 → 090205807801"
                ),
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
        """Generate RIPS export for signed sessions in the given period."""
        validation = self.validate(year, month)
        if not validation["valid"]:
            if validation.get("sessions_count") == 0:
                raise RipsGenerationError(
                    f"No hay sesiones firmadas en el período {year:04d}-{month:02d}."
                )
            raise RipsGenerationError(
                f"Hay errores de validación: {len(validation['errors'])} error(es). "
                "Use /rips/validate para ver los detalles."
            )

        sessions = validation["sessions"]
        patients = validation["patients"]

        tenant = self.db.get(Tenant, self._tenant_uuid)
        if not tenant:
            raise RipsGenerationError("Tentante no encontrado.")

        # Build new v4.3 nested JSON and store as snapshot
        snapshot = self._build_fev_rips_json(tenant, sessions, patients)
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

    def _build_fev_rips_json(
        self,
        tenant: Tenant,
        sessions: list[Session],
        patients: dict[uuid.UUID, Patient],
        num_factura: str | None = None,
    ) -> dict[str, Any]:
        """Build RIPS v4.3 nested JSON per Res. 0948/2026 (Doc. Técnico 1)."""
        patient_sessions: dict[uuid.UUID, list[Session]] = {}
        for sess in sessions:
            patient_sessions.setdefault(sess.patient_id, []).append(sess)

        usuarios = []
        for usr_idx, (patient_id, sess_list) in enumerate(patient_sessions.items()):
            patient = patients[patient_id]
            consultas = []
            for svc_idx, sess in enumerate(sess_list):
                consultas.append({
                    "codPrestador": tenant.reps_code or "",
                    "fechaInicioAtencion": sess.actual_start.strftime("%Y-%m-%d %H:%M"),
                    "numAutorizacion": sess.authorization_number,
                    "codConsulta": sess.cups_code,
                    "modalidadGrupoServicioTecSal": sess.modalidad_grupo_servicio or "01",
                    "grupoServicios": sess.grupo_servicios or "02",
                    "codServicio": sess.cod_servicio or 706,
                    "finalidadTecnologiaSalud": sess.finalidad_tecnologia_salud or "44",
                    "causaMotivoAtencion": sess.causa_motivo_atencion or "27",
                    "codDiagnosticoPrincipal": sess.diagnosis_cie11,
                    "codDiagnosticoRelacionado1": None,
                    "codDiagnosticoRelacionado2": None,
                    "codDiagnosticoRelacionado3": None,
                    "tipoDiagnosticoPrincipal": sess.tipo_dx_principal or "01",
                    "tipoDocumentoIdentificacion": patient.doc_type,
                    "numDocumentoIdentificacion": patient.doc_number,
                    "vrServicio": sess.session_fee,
                    "conceptoRecaudo": sess.concepto_recaudo or "05",
                    "valorPagoModerador": sess.valor_pago_moderador or 0,
                    "numFEVPagoModerador": None,
                    "consecutivo": svc_idx + 1,
                })
            usuarios.append({
                "consecutivo": usr_idx + 1,
                "tipoDocumentoIdentificacion": patient.doc_type,
                "numDocumentoIdentificacion": patient.doc_number,
                "tipoUsuario": _PAYER_TIPO.get(patient.payer_type, "12"),
                "fechaNacimiento": patient.birth_date.isoformat(),
                "codSexo": patient.biological_sex,
                "codPaisResidencia": patient.cod_pais_residencia or "170",
                "codMunicipioResidencia": patient.municipality_dane,
                "codZonaTerritorialResidencia": "01" if patient.zone == "U" else "02",
                "incapacidad": patient.incapacidad or "NO",
                "codPaisOrigen": patient.cod_pais_origen or "170",
                "servicios": {"consultas": consultas},
            })

        return {
            "numDocumentoIdObligado": tenant.nit or "",
            "numFactura": num_factura,
            "tipoNota": "RS",
            "numNota": None,
            "usuarios": usuarios,
        }

    def _build_zip_from_snapshot(
        self,
        snapshot: dict[str, Any],
        year: int,
        month: int,
    ) -> bytes:
        """Build ZIP with single RIPS v4.3 JSON file (new format)."""
        buffer = BytesIO()
        with ZipFile(buffer, "w", ZIP_DEFLATED) as zf:
            zf.writestr(
                f"rips_{year:04d}{month:02d}.json",
                json.dumps(snapshot, ensure_ascii=False, indent=2),
            )
        return buffer.getvalue()

    def submit(
        self,
        export_id: str,
        num_factura: str | None = None,
        xml_fev_b64: str = "",
    ) -> RipsExport:
        """Submit RIPS to MinSalud API (premium only). Returns export with CUV."""
        from app.services.fevrips_client import FevRipsClient, FevRipsError

        export = self.get_export(export_id)
        tenant = self.db.get(Tenant, self._tenant_uuid)

        if not tenant or not tenant.fevrips_sispro_password:
            raise RipsGenerationError(
                "Credenciales SISPRO no configuradas. "
                "Configure su usuario y contraseña SISPRO en Ajustes de perfil."
            )

        base_url = getattr(tenant, "fevrips_base_url", None) or settings.fevrips_base_url
        if not base_url:
            raise RipsGenerationError(
                "URL del API FEV-RIPS no configurada. "
                "Contacte a soporte para configurar la integración."
            )

        sessions, patients = self._fetch_sessions_and_patients(
            export.period_year, export.period_month
        )
        rips_json = self._build_fev_rips_json(tenant, sessions, patients, num_factura)

        client = FevRipsClient(
            base_url=base_url,
            nit=tenant.nit or "",
            password=tenant.fevrips_sispro_password,
            tipo_usuario=tenant.fevrips_tipo_usuario or "PIN",
            doc_type=tenant.fevrips_doc_type or "CC",
            doc_number=tenant.fevrips_doc_number,
        )

        try:
            token = client.login()
            if xml_fev_b64:
                response = client.cargar_fev_rips(rips_json, xml_fev_b64, token)
            else:
                response = client.cargar_rips_sin_factura(rips_json, token)
        except FevRipsError as exc:
            raise RipsGenerationError(f"Error en API MinSalud: {exc}") from exc

        result_ok = bool(response.get("ResultState"))
        export.fevrips_api_response = response
        export.num_factura = num_factura
        if result_ok:
            export.cuv = response.get("CodigoUnicoValidacion")
            export.fecha_radicacion = response.get("FechaRadicacion")
            export.status = "submitted"
        else:
            validation_msgs = [
                r.get("Observaciones", r.get("Descripcion", ""))
                for r in response.get("ResultadosValidacion", [])
            ]
            raise RipsGenerationError(
                "MinSalud rechazó el RIPS: " + " | ".join(dict.fromkeys(validation_msgs))
            )
        self.db.flush()
        self.db.refresh(export)
        return export

    def list_exports(self, limit: int = 20) -> list[RipsExport]:
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
        """Build and return the RIPS ZIP archive for the given export."""
        export = self.get_export(export_id)
        if export.status not in ("generated", "submitted"):
            raise RipsGenerationError("La exportación aún no está generada.")

        if not export.snapshot:
            raise RipsGenerationError("Exportación corrupta: snapshot no encontrado.")

        return self._build_zip_from_snapshot(
            export.snapshot,
            export.period_year,
            export.period_month,
        )
