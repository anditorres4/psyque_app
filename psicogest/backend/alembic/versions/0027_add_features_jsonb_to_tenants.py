"""Add features JSONB column to tenants table.

Revision ID: 0027
Revises: 0026
Create Date: 2026-04-28
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0027"
down_revision: Union[str, None] = "0026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column(
            "features",
            JSONB(),
            nullable=False,
            server_default=sa.text(
                "'{\"ai_diagnosis\": true, \"ai_summaries\": true, \"ai_documents\": true}'::jsonb"
            ),
        ),
    )


def downgrade() -> None:
    op.drop_column("tenants", "features")