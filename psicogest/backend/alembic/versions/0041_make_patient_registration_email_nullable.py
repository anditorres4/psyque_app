"""Make patient_registrations.email nullable

Revision ID: 0041
Revises: b7ae5e70f958
Create Date: 2026-05-21

"""
from alembic import op
import sqlalchemy as sa

revision = "0041"
down_revision = "b7ae5e70f958"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "patient_registrations",
        "email",
        existing_type=sa.String(255),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "patient_registrations",
        "email",
        existing_type=sa.String(255),
        nullable=False,
    )
