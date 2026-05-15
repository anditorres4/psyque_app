"""Sprint 3: patient_summary_text on sessions, is_sent_to_patient on ai_session_summaries, therapeutic_goals table.

Revision ID: 0039
Revises: 0038
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PgEnum

revision = "0039"
down_revision = "0038"
branch_labels = None
depends_on = None

# Create with create_type=False so Alembic won't try to CREATE TYPE automatically.
# We manage creation manually via IF NOT EXISTS logic.
_goal_status_enum = PgEnum(
    "active", "achieved", "abandoned",
    name="therapeutic_goal_status",
    create_type=False,
)


def upgrade() -> None:
    # --- sessions: add patient summary fields ---
    # Use IF NOT EXISTS in case a partial migration ran before
    op.execute(
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS patient_summary_text TEXT;"
    )
    op.execute(
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS "
        "patient_summary_sent_at TIMESTAMP WITH TIME ZONE;"
    )

    # --- ai_session_summaries: track if summary was sent ---
    op.execute(
        "ALTER TABLE ai_session_summaries ADD COLUMN IF NOT EXISTS "
        "is_sent_to_patient BOOLEAN NOT NULL DEFAULT FALSE;"
    )

    # --- therapeutic_goals: create enum type + table ---
    op.execute(
        "DO $$ BEGIN "
        "  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'therapeutic_goal_status') THEN "
        "    CREATE TYPE therapeutic_goal_status AS ENUM ('active', 'achieved', 'abandoned'); "
        "  END IF; "
        "END $$;"
    )

    # Only create table if it doesn't exist
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS therapeutic_goals (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
            goal_text TEXT NOT NULL,
            status therapeutic_goal_status NOT NULL DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        );
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_therapeutic_goals_tenant ON therapeutic_goals(tenant_id);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_therapeutic_goals_patient ON therapeutic_goals(patient_id);"
    )
    op.execute("ALTER TABLE therapeutic_goals ENABLE ROW LEVEL SECURITY;")
    op.execute(
        "DO $$ BEGIN "
        "  IF NOT EXISTS ("
        "    SELECT 1 FROM pg_policies WHERE tablename='therapeutic_goals' "
        "    AND policyname='psychologist_owns_therapeutic_goals'"
        "  ) THEN "
        "    CREATE POLICY psychologist_owns_therapeutic_goals ON therapeutic_goals "
        "    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid); "
        "  END IF; "
        "END $$;"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS psychologist_owns_therapeutic_goals ON therapeutic_goals;")
    op.execute("DROP TABLE IF EXISTS therapeutic_goals;")
    op.execute("DROP TYPE IF EXISTS therapeutic_goal_status;")
    op.execute(
        "ALTER TABLE ai_session_summaries DROP COLUMN IF EXISTS is_sent_to_patient;"
    )
    op.execute(
        "ALTER TABLE sessions DROP COLUMN IF EXISTS patient_summary_sent_at;"
    )
    op.execute(
        "ALTER TABLE sessions DROP COLUMN IF EXISTS patient_summary_text;"
    )
