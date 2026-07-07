"""widen cuv column to TEXT

Revision ID: 0049
Revises: 0048
Create Date: 2026-07-07

"""
from alembic import op
import sqlalchemy as sa

revision = "0049"
down_revision = "0048"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "rips_exports",
        "cuv",
        type_=sa.Text(),
        existing_type=sa.String(128),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "rips_exports",
        "cuv",
        type_=sa.String(128),
        existing_type=sa.Text(),
        existing_nullable=True,
    )
