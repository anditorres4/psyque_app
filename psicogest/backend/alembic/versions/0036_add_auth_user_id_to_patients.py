"""add auth_user_id to patients for portal login

Revision ID: 0036
Revises: 0035
Create Date: 2026-05-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0036"
down_revision = "0035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "patients",
        sa.Column("auth_user_id", UUID(as_uuid=True), nullable=True, unique=True),
    )
    op.create_index("ix_patients_auth_user_id", "patients", ["auth_user_id"])

    # RLS policy: patient can read their own row in the patients table
    op.execute("""
        CREATE POLICY "patient_reads_own_row" ON patients
        FOR SELECT
        USING (
            auth_user_id = auth.uid()::uuid
            OR tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
        )
    """)

    # RLS policy: patient reads their own appointments
    op.execute("""
        CREATE POLICY "patient_reads_own_appointments" ON appointments
        FOR SELECT
        USING (
            patient_id IN (
                SELECT id FROM patients WHERE auth_user_id = auth.uid()::uuid
            )
            OR tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
        )
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS patient_reads_own_appointments ON appointments")
    op.execute("DROP POLICY IF EXISTS patient_reads_own_row ON patients")
    op.drop_index("ix_patients_auth_user_id", table_name="patients")
    op.drop_column("patients", "auth_user_id")
