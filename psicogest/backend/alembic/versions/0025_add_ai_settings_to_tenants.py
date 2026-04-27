"""Add AI provider settings to tenants table.

Revision ID: 0025
Revises: 0024
Create Date: 2026-04-28
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0025"
down_revision: Union[str, None] = "0024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("ai_provider", sa.String(20), nullable=True))
    op.add_column("tenants", sa.Column("ai_model", sa.String(100), nullable=True))
    op.add_column("tenants", sa.Column("ai_api_key", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("tenants", "ai_api_key")
    op.drop_column("tenants", "ai_model")
    op.drop_column("tenants", "ai_provider")
