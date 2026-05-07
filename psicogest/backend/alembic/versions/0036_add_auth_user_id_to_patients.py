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
    # Add column only if not already present
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'patients' AND column_name = 'auth_user_id'
            ) THEN
                ALTER TABLE patients ADD COLUMN auth_user_id UUID UNIQUE;
            END IF;
        END
        $$
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_patients_auth_user_id ON patients (auth_user_id)")

    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE tablename = 'patients' AND policyname = 'patient_reads_own_row'
            ) THEN
                CREATE POLICY "patient_reads_own_row" ON patients
                FOR SELECT
                USING (
                    auth_user_id = auth.uid()::uuid
                    OR tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
                );
            END IF;
        END
        $$
    """)

    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE tablename = 'appointments' AND policyname = 'patient_reads_own_appointments'
            ) THEN
                CREATE POLICY "patient_reads_own_appointments" ON appointments
                FOR SELECT
                USING (
                    patient_id IN (
                        SELECT id FROM patients WHERE auth_user_id = auth.uid()::uuid
                    )
                    OR tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
                );
            END IF;
        END
        $$
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS patient_reads_own_appointments ON appointments")
    op.execute("DROP POLICY IF EXISTS patient_reads_own_row ON patients")
    op.execute("DROP INDEX IF EXISTS ix_patients_auth_user_id")
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'patients' AND column_name = 'auth_user_id'
            ) THEN
                ALTER TABLE patients DROP COLUMN auth_user_id;
            END IF;
        END
        $$
    """)
