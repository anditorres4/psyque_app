"""Fix RLS policies to handle empty/null tenant context gracefully.

When app.tenant_id is reset or not set, current_setting returns '' or NULL.
Casting '' to UUID raises an error instead of returning 0 rows.
Updated policies return FALSE (no rows visible) when tenant context is absent.

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-17
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CLINICAL_TABLES = [
    "patients",
    "appointments",
    "sessions",
    "session_notes",
    "rips_exports",
    "availability_blocks",
]


def upgrade() -> None:
    for table in CLINICAL_TABLES:
        # Drop existing policy and recreate with safe empty-string guard.
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation ON {table};")
        op.execute(f"""
            CREATE POLICY {table}_tenant_isolation ON {table}
            USING (
                current_setting('app.tenant_id', true) IS NOT NULL
                AND current_setting('app.tenant_id', true) <> ''
                AND tenant_id = current_setting('app.tenant_id', true)::uuid
            )
            WITH CHECK (
                current_setting('app.tenant_id', true) IS NOT NULL
                AND current_setting('app.tenant_id', true) <> ''
                AND tenant_id = current_setting('app.tenant_id', true)::uuid
            );
        """)

    # audit_logs select policy
    op.execute("DROP POLICY IF EXISTS audit_logs_select ON audit_logs;")
    op.execute("""
        CREATE POLICY audit_logs_select ON audit_logs
        FOR SELECT
        USING (
            current_setting('app.tenant_id', true) IS NOT NULL
            AND current_setting('app.tenant_id', true) <> ''
            AND tenant_id = current_setting('app.tenant_id', true)::uuid
        );
    """)


def downgrade() -> None:
    # Restore original policies (without empty-string guard)
    for table in CLINICAL_TABLES:
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation ON {table};")
        op.execute(f"""
            CREATE POLICY {table}_tenant_isolation ON {table}
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
            WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
        """)

    op.execute("DROP POLICY IF EXISTS audit_logs_select ON audit_logs;")
    op.execute("""
        CREATE POLICY audit_logs_select ON audit_logs
        FOR SELECT
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
    """)
