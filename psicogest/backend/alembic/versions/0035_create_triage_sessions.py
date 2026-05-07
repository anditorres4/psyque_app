"""create triage_sessions table

Revision ID: 0035
Revises: 0034
Create Date: 2026-05-07
"""
from alembic import op

revision = "0035"
down_revision = "0034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'triage_status_enum') THEN
                CREATE TYPE triage_status_enum AS ENUM ('pending', 'completed', 'escalated');
            END IF;
        END
        $$
    """)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'urgency_level_enum') THEN
                CREATE TYPE urgency_level_enum AS ENUM ('low', 'medium', 'high', 'critical');
            END IF;
        END
        $$
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS triage_sessions (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id           UUID NOT NULL,
            patient_name        VARCHAR(200) NOT NULL,
            patient_phone       VARCHAR(30) NOT NULL,
            whatsapp_message_id VARCHAR(100),
            status              triage_status_enum NOT NULL DEFAULT 'pending',
            urgency_level       urgency_level_enum,
            phq9_score          INTEGER,
            phq9_item9_score    INTEGER,
            responses           JSONB NOT NULL DEFAULT '[]',
            summary             TEXT,
            booking_request_id  UUID,
            created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
            completed_at        TIMESTAMPTZ
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_triage_sessions_tenant_id ON triage_sessions (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_triage_sessions_created_at ON triage_sessions (created_at)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_triage_sessions_created_at")
    op.execute("DROP INDEX IF EXISTS ix_triage_sessions_tenant_id")
    op.execute("DROP TABLE IF EXISTS triage_sessions")
    op.execute("DROP TYPE IF EXISTS triage_status_enum")
    op.execute("DROP TYPE IF EXISTS urgency_level_enum")
