"""Create invoices table for private patient liquidations.

Revision ID: 0006
Revises: 0005_rips_status_columns
Create Date: 2026-04-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "invoices",
        sa.Column("id", sa.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("invoice_number", sa.String(20), nullable=False),
        sa.Column("patient_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "status",
            sa.Enum("draft", "issued", "paid", name="invoice_status"),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("issue_date", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("due_date", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("subtotal_cop", sa.Integer(), nullable=False),
        sa.Column("tax_cop", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_cop", sa.Integer(), nullable=False),
        sa.Column("session_ids", postgresql.JSONB(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("paid_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("pdf_file_path", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_invoices_tenant_id", "invoices", ["tenant_id"])
    op.create_index("ix_invoices_patient_id", "invoices", ["patient_id"])
    op.execute("CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();")
    
    # Enable RLS
    op.execute("ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE invoices FORCE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY invoices_tenant_isolation ON invoices
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS invoices CASCADE;")
    op.execute("DROP TYPE IF EXISTS invoice_status;")