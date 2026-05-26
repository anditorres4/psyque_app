"""Add RLS tenant isolation to 7 clinical tables missing row-level security.

Tables therapy_indicators, therapy_measurements, referrals,
ai_diagnosis_suggestions, ai_session_summaries,
ai_clinical_record_summaries, and triage_sessions all carry a
tenant_id column but were created without RLS enabled. This migration
enables RLS, forces it (so superusers are also restricted when acting
as authenticated), adds the standard tenant-isolation policy, and
grants SELECT/INSERT/UPDATE/DELETE to the authenticated role so that
app code running under that role can read and write its own rows.

Revision ID: 0048
Revises: 0047
Create Date: 2026-05-26
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0048"
down_revision: Union[str, None] = "0047"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = [
    "therapy_indicators",
    "therapy_measurements",
    "referrals",
    "ai_diagnosis_suggestions",
    "ai_session_summaries",
    "ai_clinical_record_summaries",
    "triage_sessions",
]


def upgrade() -> None:
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")
        op.execute(
            f"""
            CREATE POLICY {table}_tenant_isolation ON {table}
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
            WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
            """
        )
        op.execute(
            f"GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO authenticated;"
        )


def downgrade() -> None:
    for table in TABLES:
        op.execute(f"REVOKE ALL ON {table} FROM authenticated;")
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation ON {table};")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
