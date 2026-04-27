"""Create gcal_external_blocks table and add gcal_event_id to appointments.

Revision ID: 0024
Revises: 0023
Create Date: 2026-04-25
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0024"
down_revision: Union[str, None] = "0023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "gcal_external_blocks",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("gcal_event_id", sa.String(200), nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("synced_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "gcal_event_id", name="uix_gcal_ext_blocks_tenant_event"),
    )
    op.create_index("ix_gcal_ext_blocks_tenant_start", "gcal_external_blocks", ["tenant_id", "start_time"])

    op.add_column("appointments", sa.Column("gcal_event_id", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("appointments", "gcal_event_id")
    op.drop_index("ix_gcal_ext_blocks_tenant_start", table_name="gcal_external_blocks")
    op.drop_table("gcal_external_blocks")