"""Sprint 4: patient_tasks table — structured task assignment from sessions to patients.

Revision ID: 0040
Revises: 0039
Create Date: 2026-05-15
"""
from alembic import op

revision = "0040"
down_revision = "0039"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "DO $$ BEGIN "
        "  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patient_task_status') THEN "
        "    CREATE TYPE patient_task_status AS ENUM ('pending', 'submitted', 'reviewed'); "
        "  END IF; "
        "END $$;"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS patient_tasks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
            session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            due_date DATE,
            status patient_task_status NOT NULL DEFAULT 'pending',
            submission_text TEXT,
            submission_file_path TEXT,
            reviewed_at TIMESTAMP WITH TIME ZONE,
            reviewer_notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        );
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_patient_tasks_tenant ON patient_tasks(tenant_id);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_patient_tasks_patient ON patient_tasks(patient_id);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_patient_tasks_session ON patient_tasks(session_id);"
    )
    op.execute("ALTER TABLE patient_tasks ENABLE ROW LEVEL SECURITY;")
    op.execute(
        "DO $$ BEGIN "
        "  IF NOT EXISTS ("
        "    SELECT 1 FROM pg_policies WHERE tablename='patient_tasks' "
        "    AND policyname='psychologist_owns_patient_tasks'"
        "  ) THEN "
        "    CREATE POLICY psychologist_owns_patient_tasks ON patient_tasks "
        "    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid); "
        "  END IF; "
        "END $$;"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS psychologist_owns_patient_tasks ON patient_tasks;")
    op.execute("DROP TABLE IF EXISTS patient_tasks;")
    op.execute("DROP TYPE IF EXISTS patient_task_status;")
