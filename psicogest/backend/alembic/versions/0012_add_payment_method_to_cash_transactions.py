"""Fix cash_transactions: convert payment_method enum to varchar (spanish values).

Revision ID: 0012
Revises: 0011
Create Date: 2026-04-23
"""
from alembic import op
import sqlalchemy as sa

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Convert payment_method from enum (cash/transfer/card) to varchar so
    # the frontend can send Spanish values (efectivo/transferencia/tarjeta)
    op.execute("ALTER TABLE cash_transactions ALTER COLUMN payment_method TYPE VARCHAR(20) USING payment_method::TEXT")
    op.execute("DROP TYPE IF EXISTS payment_method")


def downgrade() -> None:
    op.execute("CREATE TYPE payment_method AS ENUM ('cash', 'transfer', 'card')")
    op.execute("ALTER TABLE cash_transactions ALTER COLUMN payment_method TYPE payment_method USING NULL")
