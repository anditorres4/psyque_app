"""Create clinical_documents table for patient document attachments.

Revision ID: 0007
Revises: 0006_invoices_table
Create Date: 2026-04-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006_invoices_table"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "clinical_documents",
        sa.Column("id", sa.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("patient_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("storage_path", sa.String(500), nullable=False),
        sa.Column("document_type", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_clinical_documents_tenant_id", "clinical_documents", ["tenant_id"])
    op.create_index("ix_clinical_documents_patient_id", "clinical_documents", ["patient_id"])
    op.create_index("ix_clinical_documents_created_at", "clinical_documents", ["created_at"])
    
    # Enable RLS
    op.execute("ALTER TABLE clinical_documents ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE clinical_documents FORCE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY clinical_documents_tenant_isolation ON clinical_documents
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS clinical_documents CASCADE;")