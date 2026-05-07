"""create triage_sessions table

Revision ID: 0035
Revises: 0034
Create Date: 2026-05-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0035"
down_revision = "0034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "triage_sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("patient_name", sa.String(200), nullable=False),
        sa.Column("patient_phone", sa.String(30), nullable=False),
        sa.Column("whatsapp_message_id", sa.String(100), nullable=True),
        sa.Column(
            "status",
            sa.Enum("pending", "completed", "escalated", name="triage_status_enum"),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column(
            "urgency_level",
            sa.Enum("low", "medium", "high", "critical", name="urgency_level_enum"),
            nullable=True,
        ),
        sa.Column("phq9_score", sa.Integer(), nullable=True),
        sa.Column("phq9_item9_score", sa.Integer(), nullable=True),
        sa.Column("responses", JSONB(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("booking_request_id", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("completed_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )

    op.create_index("ix_triage_sessions_tenant_id", "triage_sessions", ["tenant_id"])
    op.create_index("ix_triage_sessions_created_at", "triage_sessions", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_triage_sessions_created_at", table_name="triage_sessions")
    op.drop_index("ix_triage_sessions_tenant_id", table_name="triage_sessions")
    op.drop_table("triage_sessions")
    op.execute("DROP TYPE IF EXISTS triage_status_enum")
    op.execute("DROP TYPE IF EXISTS urgency_level_enum")
