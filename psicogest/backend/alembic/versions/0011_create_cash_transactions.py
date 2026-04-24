"""Create cash_transactions table.

Revision ID: 0011
Revises: 0010
Create Date: 2026-04-23
"""
from alembic import op
import sqlalchemy as sa

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cash_transactions",
        sa.Column(
            "id",
            sa.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "tenant_id",
            sa.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            sa.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "type",
            sa.Enum("income", "expense", name="cash_transaction_type"),
            nullable=False,
        ),
        sa.Column(
            "amount",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "category",
            sa.Enum("particular", "eps", "nomina", "servicios", "compras", "otro", name="transaction_category"),
            nullable=False,
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "invoice_id",
            sa.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "patient_id",
            sa.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "payment_method",
            sa.Enum("cash", "transfer", "card", name="payment_method"),
            nullable=True,
        ),
        sa.Column(
            "eps_name",
            sa.String(200),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_by",
            sa.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cash_transactions_tenant_id", "cash_transactions", ["tenant_id"])
    op.create_index("ix_cash_transactions_session_id", "cash_transactions", ["session_id"])
    op.create_index("ix_cash_transactions_invoice_id", "cash_transactions", ["invoice_id"])
    op.create_index("ix_cash_transactions_patient_id", "cash_transactions", ["patient_id"])
    op.create_foreign_key(
        "fk_cash_transactions_session",
        "cash_transactions",
        "cash_sessions",
        ["session_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_cash_transactions_invoice",
        "cash_transactions",
        "invoices",
        ["invoice_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_cash_transactions_patient",
        "cash_transactions",
        "patients",
        ["patient_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.execute(
        "ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY"
    )
    op.execute(
        "CREATE POLICY \"cash_transactions_tenant_isolation\" ON cash_transactions FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::UUID)"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS \"cash_transactions_tenant_isolation\" ON cash_transactions")
    op.execute("ALTER TABLE cash_transactions DISABLE ROW LEVEL SECURITY")
    op.drop_constraint("fk_cash_transactions_patient", table_name="cash_transactions")
    op.drop_constraint("fk_cash_transactions_invoice", table_name="cash_transactions")
    op.drop_constraint("fk_cash_transactions_session", table_name="cash_transactions")
    op.drop_index("ix_cash_transactions_patient_id", table_name="cash_transactions")
    op.drop_index("ix_cash_transactions_invoice_id", table_name="cash_transactions")
    op.drop_index("ix_cash_transactions_session_id", table_name="cash_transactions")
    op.drop_index("ix_cash_transactions_tenant_id", table_name="cash_transactions")
    op.drop_table("cash_transactions")