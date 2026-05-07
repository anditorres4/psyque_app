"""create credit_debit_notes table

Revision ID: 0034
Revises: 0033
Create Date: 2026-05-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0034"
down_revision = "0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "credit_debit_notes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("invoice_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("type", sa.Enum("credit", "debit", name="note_type_enum"), nullable=False),
        sa.Column("number", sa.String(30), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("amount_cop", sa.Integer(), nullable=False),
        sa.Column("issued_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"], ondelete="RESTRICT"),
    )

    op.create_index("ix_credit_debit_notes_invoice_id", "credit_debit_notes", ["invoice_id"])

    op.execute("ALTER TABLE credit_debit_notes ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY "psychologist_owns_credit_debit_notes" ON credit_debit_notes
        FOR ALL USING (
            tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
        )
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS psychologist_owns_credit_debit_notes ON credit_debit_notes")
    op.execute("ALTER TABLE credit_debit_notes DISABLE ROW LEVEL SECURITY")
    op.drop_index("ix_credit_debit_notes_invoice_id", table_name="credit_debit_notes")
    op.drop_table("credit_debit_notes")
    op.execute("DROP TYPE IF EXISTS note_type_enum")
