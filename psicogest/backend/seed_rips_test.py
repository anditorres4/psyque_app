"""Seed de datos de prueba para testing completo del flujo RIPS.

Crea 4 pacientes y 6 sesiones firmadas en julio 2026 para el tenant
de anetorres4@gmail.com. Ejecutar desde psicogest/backend/:

    python seed_rips_test.py

Requiere .env con SUPABASE_DATABASE_URL y SUPABASE_SERVICE_KEY.
"""
from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone, date

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session as DBSession

from app.core.config import settings
from app.models.patient import Patient
from app.models.session import Session


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sha256(text_val: str) -> str:
    return hashlib.sha256(text_val.encode()).hexdigest()


def _ts(year: int, month: int, day: int, hour: int = 9) -> datetime:
    return datetime(year, month, day, hour, 0, 0, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# Test data definitions
# ---------------------------------------------------------------------------

PATIENTS = [
    {
        "hc_number": "HC-2026-0901",
        "doc_type": "CC",
        "doc_number": "1020481234",
        "first_surname": "GARCIA",
        "second_surname": "LOPEZ",
        "first_name": "MARIA",
        "second_name": "ALEJANDRA",
        "birth_date": date(1990, 3, 15),
        "biological_sex": "F",
        "marital_status": "S",
        "phone": "3001234567",
        "email": "maria.garcia.test@example.com",
        "payer_type": "PA",   # Particular
        "municipality_dane": "11001",
        "zone": "U",
        "current_diagnosis_cie11": "6A70",
        "cod_pais_residencia": "170",
        "cod_pais_origen": "170",
        "incapacidad": "NO",
    },
    {
        "hc_number": "HC-2026-0902",
        "doc_type": "CC",
        "doc_number": "79854321",
        "first_surname": "RODRIGUEZ",
        "second_surname": "PEREZ",
        "first_name": "CARLOS",
        "second_name": None,
        "birth_date": date(1985, 7, 22),
        "biological_sex": "M",
        "marital_status": "C",
        "phone": "3109876543",
        "email": "carlos.rodriguez.test@example.com",
        "payer_type": "SS",   # EPS contributivo
        "eps_name": "Nueva EPS",
        "eps_code": "EPS018",
        "municipality_dane": "11001",
        "zone": "U",
        "current_diagnosis_cie11": "6B00",
        "cod_pais_residencia": "170",
        "cod_pais_origen": "170",
        "incapacidad": "NO",
    },
    {
        "hc_number": "HC-2026-0903",
        "doc_type": "CC",
        "doc_number": "52741098",
        "first_surname": "MARTINEZ",
        "second_surname": None,
        "first_name": "LUCIA",
        "second_name": "CAROLINA",
        "birth_date": date(1998, 11, 5),
        "biological_sex": "F",
        "marital_status": "U",
        "phone": "3152345678",
        "email": None,
        "payer_type": "PA",
        "municipality_dane": "11001",
        "zone": "U",
        "current_diagnosis_cie11": "6B41",
        "cod_pais_residencia": "170",
        "cod_pais_origen": "170",
        "incapacidad": "NO",
    },
    {
        "hc_number": "HC-2026-0904",
        "doc_type": "CC",
        "doc_number": "1010654321",
        "first_surname": "VARGAS",
        "second_surname": "SUAREZ",
        "first_name": "JUAN",
        "second_name": "DAVID",
        "birth_date": date(2002, 4, 18),
        "biological_sex": "M",
        "marital_status": "S",
        "phone": "3208765432",
        "email": "juan.vargas.test@example.com",
        "payer_type": "PA",
        "municipality_dane": "11001",
        "zone": "U",
        "current_diagnosis_cie11": "6B01",
        "cod_pais_residencia": "170",
        "cod_pais_origen": "170",
        "incapacidad": "NO",
    },
]

# (patient_index, actual_start, actual_end, cie11, cie10, cups, cups_desc, reason, fee)
SESSIONS_TEMPLATE = [
    # 890208 = control por medicina especializada, finalidad 40 (CONTROL)
    # 890201 = primera vez medicina especializada, finalidad 27 (TRATAMIENTO)
    (0, _ts(2026, 7, 1, 9),  _ts(2026, 7, 1, 10),  "6A70", "F321",
     "890208", "Consulta de control por psicología",
     "Paciente refiere tristeza persistente y anhedonia durante las últimas semanas.",
     "Psicoterapia cognitivo-conductual sesión 4. Reestructuración cognitiva de creencias disfuncionales.", 80000),

    (1, _ts(2026, 7, 3, 10), _ts(2026, 7, 3, 11),  "6B00", "F411",
     "890208", "Consulta de control por psicología",
     "Ansiedad generalizada con preocupación excesiva y tensión muscular.",
     "Técnicas de relajación progresiva y exposición gradual a situaciones de estrés.", 80000),

    (2, _ts(2026, 7, 7, 14), _ts(2026, 7, 7, 15),  "6B41", "F431",
     "890201", "Consulta de primera vez por psicología",
     "Primera consulta. Paciente con estrés postraumático complejo post accidente vehicular.",
     "Evaluación clínica inicial. Psicoeducación sobre TEPT. Elaboración de plan terapéutico.", 90000),

    (0, _ts(2026, 7, 8, 9),  _ts(2026, 7, 8, 10),  "6A70", "F321",
     "890208", "Consulta de control por psicología",
     "Segunda sesión del mes. Avances en activación conductual y registro de pensamientos.",
     "Revisión de tareas. Trabajo sobre distorsiones cognitivas y planificación de actividades.", 80000),

    (3, _ts(2026, 7, 10, 11), _ts(2026, 7, 10, 12), "6B01", "F400",
     "890208", "Consulta de control por psicología",
     "Trastorno de pánico con agorafobia leve. Control post crisis.",
     "Entrenamiento en respiración diafragmática. Exposición interoceptiva gradual.", 80000),

    (1, _ts(2026, 7, 14, 10), _ts(2026, 7, 14, 11), "6B00", "F411",
     "890208", "Consulta de control por psicología",
     "Mejora parcial en síntomas ansiosos. Continúa con preocupación laboral.",
     "Psicoterapia ACT. Trabajo de valores y compromiso. Defusión cognitiva.", 80000),
]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    engine = create_engine(settings.supabase_database_url, echo=False)

    with DBSession(engine) as db:
        # 1. Find tenant by email (queries auth.users via service role connection)
        row = db.execute(
            text("SELECT id FROM auth.users WHERE email = :email"),
            {"email": "anetorres4@gmail.com"},
        ).fetchone()

        if not row:
            print("ERROR: usuario anetorres4@gmail.com no encontrado en auth.users")
            return

        auth_user_id = row[0]
        print(f"auth_user_id: {auth_user_id}")

        # 2. Get tenant
        tenant_row = db.execute(
            text("SELECT id FROM tenants WHERE auth_user_id = :uid"),
            {"uid": auth_user_id},
        ).fetchone()

        if not tenant_row:
            print("ERROR: no existe tenant para este usuario")
            return

        tenant_id: uuid.UUID = tenant_row[0]
        print(f"tenant_id: {tenant_id}")

        # 3. Create patients (skip if hc_number already exists for this tenant)
        patient_ids: list[uuid.UUID] = []
        for pdata in PATIENTS:
            existing = db.execute(
                text("SELECT id FROM patients WHERE hc_number = :hc AND tenant_id = :tid"),
                {"hc": pdata["hc_number"], "tid": tenant_id},
            ).fetchone()

            if existing:
                patient_ids.append(existing[0])
                print(f"  [skip] paciente {pdata['hc_number']} ya existe")
                continue

            p = Patient(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                consent_signed_at=_ts(2026, 6, 1, 8),
                consent_ip="192.168.1.1",
                is_active=True,
                **{k: v for k, v in pdata.items()},
            )
            db.add(p)
            db.flush()
            patient_ids.append(p.id)
            print(f"  [+] paciente {pdata['hc_number']} - {pdata['first_name']} {pdata['first_surname']}")

        # 4. Create signed sessions
        now = datetime.now(timezone.utc)
        created_sessions = 0

        for (pidx, start, end, cie11, cie10, cups, cups_desc, reason, intervention, fee) in SESSIONS_TEMPLATE:
            patient_id = patient_ids[pidx]

            # Skip if session for this patient at this exact time already exists
            existing = db.execute(
                text(
                    "SELECT id FROM sessions "
                    "WHERE patient_id = :pid AND actual_start = :start AND tenant_id = :tid"
                ),
                {"pid": patient_id, "start": start, "tid": tenant_id},
            ).fetchone()

            if existing:
                print(f"  [skip] sesión {start.date()} paciente idx={pidx} ya existe")
                continue

            content = f"{patient_id}|{start.isoformat()}|{cie11}|{cups}"
            s = Session(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                patient_id=patient_id,
                actual_start=start,
                actual_end=end,
                diagnosis_cie11=cie11,
                diagnosis_cie10=cie10,
                diagnosis_description=cups_desc,
                cups_code=cups,
                consultation_reason=reason,
                intervention=intervention,
                evolution="Evolución favorable. Paciente colaborador/a con el proceso terapéutico.",
                next_session_plan="Continuar con plan terapéutico. Próxima sesión en 7 días.",
                session_fee=fee,
                status="signed",
                signed_at=now,
                session_hash=_sha256(content),
                rips_included=False,
                tipo_dx_principal="01",
                modalidad_grupo_servicio="01",
                grupo_servicios="01",
                cod_servicio=344,
                # 890208 control → "40", 890201 primera vez → "27"
                finalidad_tecnologia_salud="40" if cups == "890208" else "27",
                causa_motivo_atencion="27",
                concepto_recaudo="05",
                valor_pago_moderador=0,
                is_emergency=False,
            )
            db.add(s)
            created_sessions += 1
            print(f"  [+] sesión {start.date()} - {cie11} ({cups}) paciente idx={pidx}")

        db.commit()
        print(f"\n✓ Seed completado: {len(patient_ids)} pacientes, {created_sessions} sesiones nuevas en julio 2026")
        print("\nPuedes ahora ir a RIPS → Generar → Julio 2026 para probar el flujo completo.")


if __name__ == "__main__":
    main()
