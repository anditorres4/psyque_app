"""billing_stripe_columns

Revision ID: b7ae5e70f958
Revises: 0040
Create Date: 2026-05-21 12:17:30.902778

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7ae5e70f958'
down_revision: Union[str, None] = '0040'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Rename enum values
    op.execute("ALTER TYPE saas_plan RENAME VALUE 'starter' TO 'free_trial'")
    op.execute("ALTER TYPE saas_plan RENAME VALUE 'pro' TO 'estandar'")
    op.execute("ALTER TYPE saas_plan RENAME VALUE 'clinic' TO 'premium'")

    # Add Stripe tracking columns
    op.add_column("tenants", sa.Column("stripe_customer_id", sa.String(50), nullable=True))
    op.add_column("tenants", sa.Column("stripe_subscription_id", sa.String(50), nullable=True))
    op.add_column(
        "tenants",
        sa.Column(
            "subscription_status",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'trial'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("tenants", "subscription_status")
    op.drop_column("tenants", "stripe_subscription_id")
    op.drop_column("tenants", "stripe_customer_id")
    op.execute("ALTER TYPE saas_plan RENAME VALUE 'free_trial' TO 'starter'")
    op.execute("ALTER TYPE saas_plan RENAME VALUE 'estandar' TO 'pro'")
    op.execute("ALTER TYPE saas_plan RENAME VALUE 'premium' TO 'clinic'")
