"""add ai_context_summary to sessions

Revision ID: 0032
Revises: 0031
Create Date: 2026-05-06
"""
from alembic import op
import sqlalchemy as sa

revision = "0032"
down_revision = "0031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column("ai_context_summary", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("sessions", "ai_context_summary")
