"""Add amount_paid and payment_status to invoices.

Revision ID: 0009
Revises: 0008
Create Date: 2026-04-23
"""
from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE TYPE payment_status_enum AS ENUM ('unpaid', 'partial', 'paid')")
    op.add_column(
        "invoices",
        sa.Column(
            "amount_paid",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "invoices",
        sa.Column(
            "payment_status",
            sa.Enum("unpaid", "partial", "paid", name="payment_status_enum", create_type=False),
            nullable=False,
            server_default="unpaid",
        ),
    )
    # Migrate existing paid invoices
    op.execute(
        "UPDATE invoices SET amount_paid = total_cop, payment_status = 'paid' WHERE status = 'paid'"
    )


def downgrade() -> None:
    op.drop_column("invoices", "payment_status")
    op.drop_column("invoices", "amount_paid")
    op.execute("DROP TYPE payment_status_enum")