"""Add booking fields to tenants.

Revision ID: 0021
Revises: 0020
Create Date: 2026-04-25
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("booking_slug", sa.String(50), nullable=True))
    op.add_column("tenants", sa.Column("booking_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("tenants", sa.Column("booking_welcome_message", sa.Text(), nullable=True))
    op.create_index("ix_tenants_booking_slug", "tenants", ["booking_slug"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_tenants_booking_slug", table_name="tenants")
    op.drop_column("tenants", "booking_welcome_message")
    op.drop_column("tenants", "booking_enabled")
    op.drop_column("tenants", "booking_slug")