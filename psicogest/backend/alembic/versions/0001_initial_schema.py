"""Initial schema: all tables with RLS policies.

Todas las tablas clínicas tienen Row-Level Security activo desde el primer
momento (Res. 1995/1999, multitenancy seguro). Esta migración es la base
del sistema — no puede hacerse downgrade si hay datos clínicos activos.

Revision ID: 0001
Revises:
Create Date: 2026-04-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # =========================================================
    # Trigger function: auto-update updated_at on every UPDATE
    # =========================================================
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql';
    """)

    # =========================================================
    # TABLE: tenants — one row per subscribed psychologist
    # =========================================================
    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("auth_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("colpsic_number", sa.String(20), nullable=False),
        sa.Column("reps_code", sa.String(30), nullable=True),
        sa.Column("nit", sa.String(15), nullable=True),
        sa.Column("plan", sa.Enum("starter", "pro", "clinic", name="saas_plan"), nullable=False, server_default="starter"),
        sa.Column("plan_expires_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("session_duration_min", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("auth_user_id"),
    )
    op.create_index("ix_tenants_auth_user_id", "tenants", ["auth_user_id"])
    op.execute("CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();")

    # =========================================================
    # TABLE: patients — Res. 1995/1999 ficha de identificación
    # =========================================================
    op.create_table(
        "patients",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("hc_number", sa.String(20), nullable=False),
        sa.Column("doc_type", sa.Enum("CC", "TI", "CE", "PA", "RC", "MS", name="doc_type"), nullable=False),
        sa.Column("doc_number", sa.String(20), nullable=False),
        sa.Column("first_surname", sa.String(100), nullable=False),
        sa.Column("second_surname", sa.String(100), nullable=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("second_name", sa.String(100), nullable=True),
        sa.Column("birth_date", sa.Date(), nullable=False),
        sa.Column("biological_sex", sa.Enum("M", "F", "I", name="biological_sex"), nullable=False),
        sa.Column("gender_identity", sa.String(50), nullable=True),
        sa.Column("marital_status", sa.Enum("S", "C", "U", "D", "V", "SE", name="marital_status"), nullable=False),
        sa.Column("occupation", sa.String(150), nullable=False),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("municipality_dane", sa.String(10), nullable=False),
        sa.Column("zone", sa.Enum("U", "R", name="zone"), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("emergency_contact_name", sa.String(200), nullable=True),
        sa.Column("emergency_contact_phone", sa.String(20), nullable=True),
        sa.Column("payer_type", sa.Enum("PA", "CC", "SS", "PE", "SE", name="payer_type"), nullable=False),
        sa.Column("eps_name", sa.String(200), nullable=True),
        sa.Column("eps_code", sa.String(10), nullable=True),
        sa.Column("authorization_number", sa.String(30), nullable=True),
        sa.Column("current_diagnosis_cie11", sa.String(20), nullable=True),
        # Ley 1581/2012: consentimiento informado con IP y timestamp inmutable
        sa.Column("consent_signed_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("consent_ip", postgresql.INET(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("tenant_id", "hc_number", name="uq_patients_hc_per_tenant"),
    )
    op.create_index("ix_patients_tenant_id", "patients", ["tenant_id"])
    op.create_index("ix_patients_tenant_doc", "patients", ["tenant_id", "doc_number"])
    op.create_index("ix_patients_tenant_name", "patients", ["tenant_id", "first_surname", "first_name"])
    op.execute("CREATE TRIGGER patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();")

    # =========================================================
    # TABLE: appointments — citas agendadas
    # =========================================================
    op.create_table(
        "appointments",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("scheduled_start", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("scheduled_end", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("session_type", sa.Enum("individual", "couple", "family", "followup", name="session_type"), nullable=False),
        sa.Column("modality", sa.Enum("presential", "virtual", name="modality"), nullable=False),
        sa.Column("status", sa.Enum("scheduled", "completed", "cancelled", "noshow", name="appointment_status"), nullable=False, server_default="scheduled"),
        sa.Column("cancellation_reason", sa.Text(), nullable=True),
        sa.Column("cancelled_by", sa.Enum("psychologist", "patient", name="cancelled_by"), nullable=True),
        sa.Column("reminder_sent_48h", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("reminder_sent_2h", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_appointments_tenant_id", "appointments", ["tenant_id"])
    op.create_index("ix_appointments_patient_id", "appointments", ["patient_id"])
    op.create_index("ix_appointments_scheduled_start", "appointments", ["tenant_id", "scheduled_start"])
    op.execute("CREATE TRIGGER appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();")

    # =========================================================
    # TABLE: sessions — notas clínicas (Res. 1995/1999)
    # CRÍTICO: los registros firmados son INMUTABLES por ley
    # =========================================================
    op.create_table(
        "sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("appointment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),  # desnormalizado para queries RIPS
        sa.Column("actual_start", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("actual_end", sa.TIMESTAMP(timezone=True), nullable=False),
        # CIE-11 obligatorio desde Res. 1442/2024 — no puede ser NULL en sesiones firmadas
        sa.Column("diagnosis_cie11", sa.String(20), nullable=False),
        sa.Column("diagnosis_description", sa.Text(), nullable=False),
        sa.Column("cups_code", sa.String(10), nullable=False),
        sa.Column("consultation_reason", sa.Text(), nullable=False),
        sa.Column("intervention", sa.Text(), nullable=False),
        sa.Column("evolution", sa.Text(), nullable=True),
        sa.Column("next_session_plan", sa.Text(), nullable=True),
        # Valores monetarios como enteros COP — Res. 2275/2023
        sa.Column("session_fee", sa.Integer(), nullable=False),
        sa.Column("authorization_number", sa.String(30), nullable=True),
        sa.Column("status", sa.Enum("draft", "signed", name="session_status"), nullable=False, server_default="draft"),
        # SHA-256 del contenido + timestamp servidor al momento del firmado
        sa.Column("session_hash", sa.String(64), nullable=True),
        sa.Column("signed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("rips_included", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["appointment_id"], ["appointments.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_sessions_tenant_id", "sessions", ["tenant_id"])
    op.create_index("ix_sessions_patient_id", "sessions", ["patient_id"])
    op.create_index("ix_sessions_actual_start", "sessions", ["tenant_id", "actual_start"])
    op.create_index("ix_sessions_rips", "sessions", ["tenant_id", "status", "rips_included"])
    op.execute("CREATE TRIGGER sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();")

    # =========================================================
    # TABLE: session_notes — notas aclaratorias (append-only)
    # Nunca modifica el registro original — Res. 1995/1999
    # =========================================================
    op.create_table(
        "session_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("note_hash", sa.String(64), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        # No updated_at — tabla append-only por diseño normativo
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_session_notes_session_id", "session_notes", ["session_id"])

    # =========================================================
    # TABLE: rips_exports — registro de exportaciones RIPS
    # =========================================================
    op.create_table(
        "rips_exports",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("period_year", sa.SmallInteger(), nullable=False),
        sa.Column("period_month", sa.SmallInteger(), nullable=False),
        sa.Column("sessions_count", sa.Integer(), nullable=False),
        sa.Column("total_value_cop", sa.Integer(), nullable=False),
        sa.Column("json_file_path", sa.Text(), nullable=False),
        sa.Column("generated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("validation_errors", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_rips_exports_tenant_id", "rips_exports", ["tenant_id"])
    op.execute("CREATE TRIGGER rips_exports_updated_at BEFORE UPDATE ON rips_exports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();")

    # =========================================================
    # TABLE: audit_logs — append-only, no UPDATE/DELETE permitido
    # Toda acción clínica queda registrada (Res. 1995/1999)
    # =========================================================
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("ip_address", postgresql.INET(), nullable=True),
        sa.Column("timestamp", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_tenant_id", "audit_logs", ["tenant_id"])
    op.create_index("ix_audit_logs_timestamp", "audit_logs", ["timestamp"])

    # =========================================================
    # TABLE: availability_blocks — horarios del psicólogo
    # =========================================================
    op.create_table(
        "availability_blocks",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("day_of_week", sa.SmallInteger(), nullable=False),  # 0=Lunes, 6=Domingo
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_availability_blocks_tenant_id", "availability_blocks", ["tenant_id"])
    op.execute("CREATE TRIGGER availability_updated_at BEFORE UPDATE ON availability_blocks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();")

    # =========================================================
    # ROW-LEVEL SECURITY — todas las tablas clínicas
    # Política base: tenant solo ve sus propios registros
    # =========================================================
    clinical_tables = [
        "patients",
        "appointments",
        "sessions",
        "session_notes",
        "rips_exports",
        "availability_blocks",
    ]
    for table in clinical_tables:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")
        op.execute(f"""
            CREATE POLICY {table}_tenant_isolation ON {table}
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
            WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
        """)

    # audit_logs: cualquier tenant puede insertar, solo lee los suyos
    op.execute("ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY audit_logs_select ON audit_logs
        FOR SELECT
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
    """)
    op.execute("""
        CREATE POLICY audit_logs_insert ON audit_logs
        FOR INSERT
        WITH CHECK (true);
    """)


def downgrade() -> None:
    """Remove all tables and types in reverse dependency order.

    ADVERTENCIA: Este downgrade elimina todos los datos clínicos.
    No ejecutar en producción si hay datos de pacientes.
    """
    tables = [
        "audit_logs",
        "availability_blocks",
        "rips_exports",
        "session_notes",
        "sessions",
        "appointments",
        "patients",
        "tenants",
    ]
    for table in tables:
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE;")

    for enum_type in [
        "saas_plan", "doc_type", "biological_sex", "marital_status",
        "zone", "payer_type", "session_type", "modality",
        "appointment_status", "cancelled_by", "session_status",
    ]:
        op.execute(f"DROP TYPE IF EXISTS {enum_type};")

    op.execute("DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;")
