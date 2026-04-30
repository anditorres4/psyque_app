"""add video_room_id to appointments.

Revision ID: 0029
Revises: 0028
Create Date: 2026-04-28
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0029"
down_revision: Union[str, None] = "0028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "appointments",
        sa.Column("video_room_id", sa.String(100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("appointments", "video_room_id")