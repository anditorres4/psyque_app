"""Replace RLS policies with a safe helper function.

PostgreSQL may reorder AND conditions in RLS policy evaluation, causing
''::uuid cast errors when app.tenant_id is reset to empty string.
Solution: a STABLE function that returns NULL on empty/invalid input so
the comparison 'tenant_id = get_tenant_id_setting()' evaluates to NULL
(not TRUE) and the row is invisible — no cast error.

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-17
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
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
    # Helper function: returns NULL when tenant context is absent or invalid.
    # NULL makes 'tenant_id = get_tenant_id_setting()' evaluate to NULL, which
    # RLS treats as FALSE — zero rows visible.
    op.execute("""
        CREATE OR REPLACE FUNCTION get_tenant_id_setting() RETURNS uuid AS $$
        DECLARE
            tid text;
        BEGIN
            tid := current_setting('app.tenant_id', true);
            IF tid IS NULL OR tid = '' THEN
                RETURN NULL;
            END IF;
            RETURN tid::uuid;
        EXCEPTION WHEN OTHERS THEN
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
    """)

    # Grant execute to authenticated so the function works under SET ROLE
    op.execute("GRANT EXECUTE ON FUNCTION get_tenant_id_setting() TO authenticated;")

    for table in CLINICAL_TABLES:
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation ON {table};")
        op.execute(f"""
            CREATE POLICY {table}_tenant_isolation ON {table}
            USING (tenant_id = get_tenant_id_setting())
            WITH CHECK (tenant_id = get_tenant_id_setting());
        """)

    op.execute("DROP POLICY IF EXISTS audit_logs_select ON audit_logs;")
    op.execute("""
        CREATE POLICY audit_logs_select ON audit_logs
        FOR SELECT
        USING (tenant_id = get_tenant_id_setting());
    """)


def downgrade() -> None:
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

    op.execute("DROP FUNCTION IF EXISTS get_tenant_id_setting();")
