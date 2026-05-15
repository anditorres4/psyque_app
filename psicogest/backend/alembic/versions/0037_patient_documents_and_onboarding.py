"""Create patient_documents table and add onboarding_status to patients

Revision ID: 0037
Revises: 0036
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa

revision = "0037"
down_revision = "0036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create patient_doc_type enum
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patient_doc_type') THEN
                CREATE TYPE patient_doc_type AS ENUM (
                    'service_conditions',
                    'consent_therapeutic',
                    'assent_minor_u13',
                    'assent_minor_13_18',
                    'consent_guardian',
                    'intake_questionnaire'
                );
            END IF;
        END
        $$
    """)

    # Create patient_documents table
    op.execute("""
        CREATE TABLE IF NOT EXISTS patient_documents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id UUID NOT NULL,
            psychologist_id UUID NOT NULL,
            doc_type patient_doc_type NOT NULL,
            signed_at TIMESTAMPTZ NOT NULL,
            ip VARCHAR(45) NOT NULL,
            content_version VARCHAR(20) NOT NULL DEFAULT '1.0',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_patient_documents_patient_id ON patient_documents (patient_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_patient_documents_psychologist_id ON patient_documents (psychologist_id)")

    # RLS
    op.execute("ALTER TABLE patient_documents ENABLE ROW LEVEL SECURITY")

    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE tablename = 'patient_documents' AND policyname = 'psychologist_owns_patient_documents'
            ) THEN
                CREATE POLICY "psychologist_owns_patient_documents" ON patient_documents
                FOR ALL USING (
                    psychologist_id = nullif(current_setting('app.tenant_id', true), '')::uuid
                    OR patient_id IN (
                        SELECT id FROM patients WHERE auth_user_id = auth.uid()::uuid
                    )
                );
            END IF;
        END
        $$
    """)

    # Add onboarding_status enum + column to patients
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'onboarding_status_enum') THEN
                CREATE TYPE onboarding_status_enum AS ENUM ('pending', 'active');
            END IF;
        END
        $$
    """)

    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'patients' AND column_name = 'onboarding_status'
            ) THEN
                ALTER TABLE patients ADD COLUMN onboarding_status onboarding_status_enum;
            END IF;
        END
        $$
    """)

    # Patients invited to portal but not yet onboarded get 'pending'
    # Existing patients without auth_user_id stay NULL (treated as active by app logic)
    op.execute("""
        UPDATE patients
        SET onboarding_status = 'pending'
        WHERE auth_user_id IS NOT NULL AND onboarding_status IS NULL
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS patient_documents")
    op.execute("DROP TYPE IF EXISTS patient_doc_type")
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'patients' AND column_name = 'onboarding_status'
            ) THEN
                ALTER TABLE patients DROP COLUMN onboarding_status;
            END IF;
        END
        $$
    """)
    op.execute("DROP TYPE IF EXISTS onboarding_status_enum")
