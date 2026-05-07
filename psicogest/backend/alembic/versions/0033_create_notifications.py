"""create notifications table

Revision ID: 0033
Revises: 0032
Create Date: 2026-05-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0033"
down_revision = "0032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        # References auth.users(id) directly — used by Supabase Realtime RLS
        sa.Column("psychologist_id", UUID(as_uuid=True), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("read_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("metadata", JSONB(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_index("ix_notifications_psychologist_id", "notifications", ["psychologist_id"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])

    # Enable RLS — Supabase Realtime uses this for real-time pushes to the correct client
    op.execute("ALTER TABLE notifications ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY "psychologist_reads_own_notifications" ON notifications
        FOR ALL USING (psychologist_id = auth.uid()::uuid)
    """)

    # Add to Supabase Realtime publication so the frontend can subscribe
    op.execute("ALTER PUBLICATION supabase_realtime ADD TABLE notifications")


def downgrade() -> None:
    op.execute("ALTER PUBLICATION supabase_realtime DROP TABLE notifications")
    op.execute("DROP POLICY IF EXISTS psychologist_reads_own_notifications ON notifications")
    op.execute("ALTER TABLE notifications DISABLE ROW LEVEL SECURITY")
    op.drop_index("ix_notifications_created_at", table_name="notifications")
    op.drop_index("ix_notifications_psychologist_id", table_name="notifications")
    op.drop_table("notifications")
