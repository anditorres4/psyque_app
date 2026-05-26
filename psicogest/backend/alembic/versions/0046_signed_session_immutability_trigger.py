"""signed session immutability trigger

Revision ID: 0046
Revises: 0044
Create Date: 2026-05-26
"""
from typing import Sequence, Union
from alembic import op

revision: str = "0046"
down_revision: Union[str, None] = "0044"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE OR REPLACE FUNCTION enforce_session_immutability()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF OLD.status = 'signed' AND (
            NEW.diagnosis_cie11          IS DISTINCT FROM OLD.diagnosis_cie11          OR
            NEW.diagnosis_description    IS DISTINCT FROM OLD.diagnosis_description    OR
            NEW.cups_code                IS DISTINCT FROM OLD.cups_code                OR
            NEW.consultation_reason      IS DISTINCT FROM OLD.consultation_reason      OR
            NEW.intervention             IS DISTINCT FROM OLD.intervention             OR
            NEW.session_fee              IS DISTINCT FROM OLD.session_fee              OR
            NEW.mental_exam              IS DISTINCT FROM OLD.mental_exam
          ) THEN
            RAISE EXCEPTION 'Cannot modify clinical fields of a signed session (Res. 1995/1999)';
          END IF;
          RETURN NEW;
        END;
        $$;
    """)

    op.execute("""
        CREATE TRIGGER trg_session_immutable
          BEFORE UPDATE ON sessions
          FOR EACH ROW EXECUTE FUNCTION enforce_session_immutability();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_session_immutable ON sessions;")
    op.execute("DROP FUNCTION IF EXISTS enforce_session_immutability();")
