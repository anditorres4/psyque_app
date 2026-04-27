"""Create AI results tables.

Revision ID: 0028
Revises: 0027
Create Date: 2026-04-28
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "0028"
down_revision: Union[str, None] = "0027"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_session_summaries",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", UUID(as_uuid=True), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("key_topics", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("model_version", sa.String(100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ai_session_summaries_session",
        "ai_session_summaries",
        ["tenant_id", "session_id"],
    )

    op.create_table(
        "ai_clinical_record_summaries",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("patient_id", UUID(as_uuid=True), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column(
            "key_aspects", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")
        ),
        sa.Column(
            "recommendations", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")
        ),
        sa.Column("model_version", sa.String(100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ai_clinical_record_summaries_patient",
        "ai_clinical_record_summaries",
        ["tenant_id", "patient_id"],
    )

    op.create_table(
        "ai_document_analyses",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("document_id", UUID(as_uuid=True), nullable=False),
        sa.Column("analysis", JSONB(), nullable=False),
        sa.Column(
            "key_findings", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")
        ),
        sa.Column("model_version", sa.String(100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ai_document_analyses_document",
        "ai_document_analyses",
        ["tenant_id", "document_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_ai_document_analyses_document", table_name="ai_document_analyses")
    op.drop_table("ai_document_analyses")
    op.drop_index(
        "ix_ai_clinical_record_summaries_patient", table_name="ai_clinical_record_summaries"
    )
    op.drop_table("ai_clinical_record_summaries")
    op.drop_index("ix_ai_session_summaries_session", table_name="ai_session_summaries")
    op.drop_table("ai_session_summaries")