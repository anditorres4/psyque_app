"""Create clinical_records table for patient clinical intake data.

Revision ID: 0013
Revises: 0012
Create Date: 2026-04-23
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "clinical_records",
        sa.Column("id", sa.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("patient_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("chief_complaint", sa.Text(), nullable=True),
        sa.Column("antecedentes_personales", JSONB(), nullable=True),
        sa.Column("antecedentes_familiares", JSONB(), nullable=True),
        sa.Column("antecedentes_medicos", JSONB(), nullable=True),
        sa.Column("antecedentes_psicologicos", JSONB(), nullable=True),
        sa.Column("initial_diagnosis_cie11", sa.String(20), nullable=True),
        sa.Column("initial_diagnosis_description", sa.Text(), nullable=True),
        sa.Column("treatment_plan", sa.Text(), nullable=True),
        sa.Column("therapeutic_goals", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "patient_id", name="uq_clinical_records_tenant_patient"),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_clinical_records_tenant_id", "clinical_records", ["tenant_id"])
    op.create_index("ix_clinical_records_patient_id", "clinical_records", ["patient_id"])

    op.execute("ALTER TABLE clinical_records ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE clinical_records FORCE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY clinical_records_tenant_isolation ON clinical_records
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS clinical_records CASCADE;")