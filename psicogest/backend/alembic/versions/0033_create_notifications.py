"""create notifications table

Revision ID: 0033
Revises: 0032
Create Date: 2026-05-07
"""
from alembic import op

revision = "0033"
down_revision = "0032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            psychologist_id UUID NOT NULL,
            type        VARCHAR(50) NOT NULL,
            title       VARCHAR(200) NOT NULL,
            body        TEXT,
            read_at     TIMESTAMPTZ,
            metadata    JSONB NOT NULL DEFAULT '{}',
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_notifications_psychologist_id ON notifications (psychologist_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_notifications_created_at ON notifications (created_at)")

    op.execute("ALTER TABLE notifications ENABLE ROW LEVEL SECURITY")

    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE tablename = 'notifications'
                  AND policyname = 'psychologist_reads_own_notifications'
            ) THEN
                CREATE POLICY "psychologist_reads_own_notifications" ON notifications
                FOR ALL USING (psychologist_id = auth.uid()::uuid);
            END IF;
        END
        $$
    """)

    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_publication_tables
                WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
            ) THEN
                ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
            END IF;
        END
        $$
    """)


def downgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_publication_tables
                WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
            ) THEN
                ALTER PUBLICATION supabase_realtime DROP TABLE notifications;
            END IF;
        END
        $$
    """)
    op.execute("DROP POLICY IF EXISTS psychologist_reads_own_notifications ON notifications")
    op.execute("ALTER TABLE notifications DISABLE ROW LEVEL SECURITY")
    op.execute("DROP INDEX IF EXISTS ix_notifications_created_at")
    op.execute("DROP INDEX IF EXISTS ix_notifications_psychologist_id")
    op.execute("DROP TABLE IF EXISTS notifications")
