"""Add tipo_dx_principal to sessions table.

Revision ID: 0014
Revises: 0013
Create Date: 2026-04-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column("tipo_dx_principal", sa.String(1), nullable=False, server_default=sa.text("'1'")),
    )


def downgrade() -> None:
    op.drop_column("sessions", "tipo_dx_principal")
