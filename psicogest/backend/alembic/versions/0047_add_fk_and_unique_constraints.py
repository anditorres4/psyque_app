"""add_fk_and_unique_constraints

Adds FK constraints (patient_id → patients.id CASCADE) to:
  - sessions, appointments, invoices, clinical_documents, clinical_records

Adds UNIQUE constraints:
  - sessions.appointment_id
  - invoices.invoice_number

Revision ID: 0047
Revises: 0046
Create Date: 2026-05-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0047'
down_revision: Union[str, None] = '0046'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # sessions: unique on appointment_id + FK patient_id → patients.id
    op.create_unique_constraint(
        'uq_sessions_appointment_id', 'sessions', ['appointment_id']
    )
    op.create_foreign_key(
        'fk_sessions_patient_id', 'sessions', 'patients',
        ['patient_id'], ['id'], ondelete='CASCADE'
    )

    # appointments: FK patient_id → patients.id
    op.create_foreign_key(
        'fk_appointments_patient_id', 'appointments', 'patients',
        ['patient_id'], ['id'], ondelete='CASCADE'
    )

    # invoices: unique on invoice_number + FK patient_id → patients.id
    op.create_unique_constraint(
        'uq_invoices_invoice_number', 'invoices', ['invoice_number']
    )
    op.create_foreign_key(
        'fk_invoices_patient_id', 'invoices', 'patients',
        ['patient_id'], ['id'], ondelete='CASCADE'
    )

    # clinical_documents: FK patient_id → patients.id
    op.create_foreign_key(
        'fk_clinical_documents_patient_id', 'clinical_documents', 'patients',
        ['patient_id'], ['id'], ondelete='CASCADE'
    )

    # clinical_records: FK patient_id → patients.id
    op.create_foreign_key(
        'fk_clinical_records_patient_id', 'clinical_records', 'patients',
        ['patient_id'], ['id'], ondelete='CASCADE'
    )


def downgrade() -> None:
    op.drop_constraint('fk_clinical_records_patient_id', 'clinical_records', type_='foreignkey')
    op.drop_constraint('fk_clinical_documents_patient_id', 'clinical_documents', type_='foreignkey')
    op.drop_constraint('fk_invoices_patient_id', 'invoices', type_='foreignkey')
    op.drop_constraint('uq_invoices_invoice_number', 'invoices', type_='unique')
    op.drop_constraint('fk_appointments_patient_id', 'appointments', type_='foreignkey')
    op.drop_constraint('fk_sessions_patient_id', 'sessions', type_='foreignkey')
    op.drop_constraint('uq_sessions_appointment_id', 'sessions', type_='unique')
