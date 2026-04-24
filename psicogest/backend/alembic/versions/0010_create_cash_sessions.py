"""Create cash_sessions table.

Revision ID: 0010
Revises: 0009
Create Date: 2026-04-23
"""
from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cash_sessions",
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
            "user_id",
            sa.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "opened_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "closed_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.Enum("open", "closed", name="cash_session_status"),
            nullable=False,
            server_default="open",
        ),
        sa.Column(
            "notes",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
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
    op.create_index("ix_cash_sessions_tenant_id", "cash_sessions", ["tenant_id"])
    op.create_index("ix_cash_sessions_user_id", "cash_sessions", ["user_id"])
    op.create_index(
        "ix_cash_sessions_unique_open",
        "cash_sessions",
        ["tenant_id", "user_id"],
        unique=True,
        postgresql_where=(sa.text("status = 'open'")),
    )
    op.execute(
        "ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY"
    )
    op.execute(
        "CREATE POLICY \"cash_sessions_tenant_isolation\" ON cash_sessions FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::UUID)"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS \"cash_sessions_tenant_isolation\" ON cash_sessions")
    op.execute("ALTER TABLE cash_sessions DISABLE ROW LEVEL SECURITY")
    op.drop_index("ix_cash_sessions_unique_open", table_name="cash_sessions")
    op.drop_index("ix_cash_sessions_user_id", table_name="cash_sessions")
    op.drop_index("ix_cash_sessions_tenant_id", table_name="cash_sessions")
    op.drop_table("cash_sessions")