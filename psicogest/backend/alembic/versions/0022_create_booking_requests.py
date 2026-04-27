"""Create booking_requests table.

Revision ID: 0022
Revises: 0021
Create Date: 2026-04-25
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "booking_requests",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("patient_name", sa.String(200), nullable=False),
        sa.Column("patient_email", sa.String(200), nullable=False),
        sa.Column("patient_phone", sa.String(20), nullable=True),
        sa.Column("session_type", sa.String(20), nullable=False, server_default="individual"),
        sa.Column("requested_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("requested_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("pending", "confirmed", "rejected", name="booking_request_status"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_booking_requests_tenant_id", "booking_requests", ["tenant_id"])
    op.create_index("ix_booking_requests_status", "booking_requests", ["status"])


def downgrade() -> None:
    op.drop_index("ix_booking_requests_status", table_name="booking_requests")
    op.drop_index("ix_booking_requests_tenant_id", table_name="booking_requests")
    op.drop_table("booking_requests")
    op.execute("DROP TYPE IF EXISTS booking_request_status")