"""Fix tipo_dx_principal: String(1) → String(2), default '1' → '01'.

The SISPRO API spec requires 2-char codes: '01' (confirmed) / '02' (presumptive).

Revision ID: 0043
Revises: 0042
Create Date: 2026-05-23
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0043"
down_revision: Union[str, None] = "0042"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "sessions",
        "tipo_dx_principal",
        type_=sa.String(2),
        server_default=sa.text("'01'"),
        nullable=False,
    )
    # Back-fill existing rows: '1' → '01', '2' → '02', anything else → '01'
    op.execute(
        "UPDATE sessions SET tipo_dx_principal = '0' || tipo_dx_principal "
        "WHERE char_length(tipo_dx_principal) = 1"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE sessions SET tipo_dx_principal = RIGHT(tipo_dx_principal, 1)"
    )
    op.alter_column(
        "sessions",
        "tipo_dx_principal",
        type_=sa.String(1),
        server_default=sa.text("'1'"),
        nullable=False,
    )
