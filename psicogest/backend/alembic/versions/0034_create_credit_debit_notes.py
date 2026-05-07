"""create credit_debit_notes table

Revision ID: 0034
Revises: 0033
Create Date: 2026-05-07
"""
from alembic import op

revision = "0034"
down_revision = "0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'note_type_enum') THEN
                CREATE TYPE note_type_enum AS ENUM ('credit', 'debit');
            END IF;
        END
        $$
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS credit_debit_notes (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id   UUID NOT NULL,
            invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
            type        note_type_enum NOT NULL,
            number      VARCHAR(30) NOT NULL,
            reason      TEXT NOT NULL,
            amount_cop  INTEGER NOT NULL,
            issued_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_credit_debit_notes_tenant_id ON credit_debit_notes (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_credit_debit_notes_invoice_id ON credit_debit_notes (invoice_id)")

    op.execute("ALTER TABLE credit_debit_notes ENABLE ROW LEVEL SECURITY")

    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE tablename = 'credit_debit_notes'
                  AND policyname = 'psychologist_owns_credit_debit_notes'
            ) THEN
                CREATE POLICY "psychologist_owns_credit_debit_notes" ON credit_debit_notes
                FOR ALL USING (
                    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
                );
            END IF;
        END
        $$
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS psychologist_owns_credit_debit_notes ON credit_debit_notes")
    op.execute("ALTER TABLE credit_debit_notes DISABLE ROW LEVEL SECURITY")
    op.execute("DROP INDEX IF EXISTS ix_credit_debit_notes_invoice_id")
    op.execute("DROP INDEX IF EXISTS ix_credit_debit_notes_tenant_id")
    op.execute("DROP TABLE IF EXISTS credit_debit_notes")
    op.execute("DROP TYPE IF EXISTS note_type_enum")
