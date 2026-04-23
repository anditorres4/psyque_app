"""Grant table permissions to authenticated role for RLS enforcement.

Superusers (postgres) bypass RLS automatically. To enforce RLS policies,
app code and tests must run as the 'authenticated' role (non-superuser).
These grants allow that role to read/write clinical tables.

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-17
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CLINICAL_TABLES = [
    "tenants",
    "patients",
    "appointments",
    "sessions",
    "session_notes",
    "rips_exports",
    "audit_logs",
    "availability_blocks",
]


def upgrade() -> None:
    # Allow authenticated role to operate on all clinical tables.
    # RLS policies then restrict which rows are actually visible.
    op.execute("GRANT USAGE ON SCHEMA public TO authenticated;")
    for table in CLINICAL_TABLES:
        op.execute(
            f"GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO authenticated;"
        )


def downgrade() -> None:
    for table in CLINICAL_TABLES:
        op.execute(f"REVOKE ALL ON {table} FROM authenticated;")
    op.execute("REVOKE USAGE ON SCHEMA public FROM authenticated;")
