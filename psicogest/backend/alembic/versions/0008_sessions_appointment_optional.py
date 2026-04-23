"""Make sessions.appointment_id nullable — sessions can exist without a scheduled appointment.

Revision ID: 0008
Revises: 0007
Create Date: 2026-04-22
"""
from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("sessions", "appointment_id", nullable=True)


def downgrade() -> None:
    # Set NULL values to a sentinel before restoring NOT NULL
    op.execute(
        "UPDATE sessions SET appointment_id = '00000000-0000-0000-0000-000000000000' WHERE appointment_id IS NULL"
    )
    op.alter_column("sessions", "appointment_id", nullable=False)
