"""Add status and file_hash to rips_exports for RIPS generation.

Revision ID: 0005
Revises: 0004_rls_safe_tenant_fn
Create Date: 2026-04-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004_rls_safe_tenant_fn"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "rips_exports",
        sa.Column(
            "status",
            sa.Enum("pending", "generated", "submitted", name="rips_export_status"),
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column(
        "rips_exports",
        sa.Column("file_hash", sa.String(64), nullable=True),
    )
    
    # Make generated_at non-nullable if it's nullable
    op.alter_column(
        "rips_exports",
        "generated_at",
        nullable=False,
    )


def downgrade() -> None:
    op.drop_column("rips_exports", "file_hash")
    op.drop_column("rips_exports", "status")