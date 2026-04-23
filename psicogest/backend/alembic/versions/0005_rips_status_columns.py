"""Add status and file_hash to rips_exports for RIPS generation.

Revision ID: 0005
Revises: 0004_rls_safe_tenant_fn
Create Date: 2026-04-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    rips_status_enum = sa.Enum("pending", "generated", "submitted", name="rips_export_status")
    rips_status_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "rips_exports",
        sa.Column(
            "status",
            rips_status_enum,
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column(
        "rips_exports",
        sa.Column("file_hash", sa.String(64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("rips_exports", "file_hash")
    op.drop_column("rips_exports", "status")
    sa.Enum(name="rips_export_status").drop(op.get_bind(), checkfirst=True)