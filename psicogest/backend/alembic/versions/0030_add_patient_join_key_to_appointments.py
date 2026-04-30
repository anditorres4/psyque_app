"""add patient_join_key to appointments.

Revision ID: 0030
Revises: 0029
Create Date: 2026-04-30
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0030"
down_revision: Union[str, None] = "0029"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "appointments",
        sa.Column("patient_join_key", sa.String(length=36), nullable=True),
    )
    op.create_index(
        op.f("ix_appointments_patient_join_key"),
        "appointments",
        ["patient_join_key"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_appointments_patient_join_key"), table_name="appointments")
    op.drop_column("appointments", "patient_join_key")
