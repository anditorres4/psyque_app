"""Create referrals table.

Revision ID: 0020
Revises: 0019
Create Date: 2026-04-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "referrals",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("patient_id", UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", UUID(as_uuid=True), nullable=True),
        sa.Column("referred_to_name", sa.String(200), nullable=False),
        sa.Column("referred_to_specialty", sa.String(100), nullable=False),
        sa.Column("referred_to_institution", sa.String(200), nullable=True),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("priority", sa.Enum("urgente", "preferente", "programado", name="referral_priority"), nullable=False, server_default="programado"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_referrals_tenant_id", "referrals", ["tenant_id"])
    op.create_index("ix_referrals_patient_id", "referrals", ["patient_id"])
    op.create_index("ix_referrals_session_id", "referrals", ["session_id"])


def downgrade() -> None:
    op.drop_table("referrals")
