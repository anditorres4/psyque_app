"""Add mental exam and symptom fields to clinical_records.

Revision ID: 0018
Revises: 0017
Create Date: 2026-04-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("clinical_records", sa.Column("presenting_problems", sa.Text(), nullable=True))
    op.add_column("clinical_records", sa.Column("symptom_description", sa.Text(), nullable=True))
    op.add_column("clinical_records", sa.Column("mental_exam", JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column("clinical_records", "mental_exam")
    op.drop_column("clinical_records", "symptom_description")
    op.drop_column("clinical_records", "presenting_problems")
