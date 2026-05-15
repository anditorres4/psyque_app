"""Create appointment_series, add series_id to appointments, rename reminder_sent_48h to 24h

Revision ID: 0038
Revises: 0037
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa

revision = "0038"
down_revision = "0037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create appointment_series table
    op.execute("""
        CREATE TABLE IF NOT EXISTS appointment_series (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            patient_id UUID NOT NULL,
            day_of_week SMALLINT NOT NULL,
            time_hour SMALLINT NOT NULL,
            time_minute SMALLINT NOT NULL DEFAULT 0,
            duration_minutes SMALLINT NOT NULL DEFAULT 50,
            session_type session_type NOT NULL,
            modality modality NOT NULL,
            n_repetitions SMALLINT NOT NULL,
            first_date DATE NOT NULL,
            notes TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_appointment_series_tenant_id ON appointment_series (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_appointment_series_patient_id ON appointment_series (patient_id)")

    op.execute("ALTER TABLE appointment_series ENABLE ROW LEVEL SECURITY")
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE tablename = 'appointment_series' AND policyname = 'psychologist_owns_series'
            ) THEN
                CREATE POLICY "psychologist_owns_series" ON appointment_series
                FOR ALL USING (
                    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
                );
            END IF;
        END
        $$
    """)

    # Add series_id FK to appointments
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'appointments' AND column_name = 'series_id'
            ) THEN
                ALTER TABLE appointments ADD COLUMN series_id UUID;
            END IF;
        END
        $$
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_appointments_series_id ON appointments (series_id)")

    # Rename reminder_sent_48h → reminder_sent_24h
    # Copy existing data so reminders already sent stay marked
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'appointments' AND column_name = 'reminder_sent_48h'
            ) AND NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'appointments' AND column_name = 'reminder_sent_24h'
            ) THEN
                ALTER TABLE appointments RENAME COLUMN reminder_sent_48h TO reminder_sent_24h;
            END IF;
        END
        $$
    """)


def downgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'appointments' AND column_name = 'reminder_sent_24h'
            ) AND NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'appointments' AND column_name = 'reminder_sent_48h'
            ) THEN
                ALTER TABLE appointments RENAME COLUMN reminder_sent_24h TO reminder_sent_48h;
            END IF;
        END
        $$
    """)

    op.execute("DROP INDEX IF EXISTS ix_appointments_series_id")
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'appointments' AND column_name = 'series_id'
            ) THEN
                ALTER TABLE appointments DROP COLUMN series_id;
            END IF;
        END
        $$
    """)

    op.execute("DROP TABLE IF EXISTS appointment_series")
