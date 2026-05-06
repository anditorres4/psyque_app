"""add mental_exam, is_emergency, homework_assigned to sessions; add nps_surveys table.

Revision ID: 0031
Revises: 0030
Create Date: 2026-05-06
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
from alembic import op

revision: str = "0031"
down_revision: Union[str, None] = "0030"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Sessions: examen mental por sesión, flag emergencia, tareas asignadas ──
    op.add_column("sessions", sa.Column("mental_exam", JSONB(), nullable=True))
    op.add_column(
        "sessions",
        sa.Column(
            "is_emergency",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column("sessions", sa.Column("homework_assigned", sa.Text(), nullable=True))

    # ── NPS surveys ───────────────────────────────────────────────────────────
    op.create_table(
        "nps_surveys",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("psychologist_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("session_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("patient_email", sa.String(255), nullable=False),
        sa.Column("patient_name", sa.String(200), nullable=False),
        sa.Column("token", sa.String(64), nullable=False, unique=True),
        sa.Column("score", sa.SmallInteger(), nullable=True),
        sa.Column("feedback", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("responded_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_nps_surveys_token", "nps_surveys", ["token"], unique=True)

    # RLS for nps_surveys
    op.execute("ALTER TABLE nps_surveys ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY psychologist_owns_nps ON nps_surveys
        FOR ALL USING (psychologist_id = current_setting('app.current_tenant', true)::uuid)
        """
    )

    # ── Patient portal users (registration tracking) ──────────────────────────
    op.create_table(
        "patient_registrations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("psychologist_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("patient_id", UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("registration_token", sa.String(64), nullable=False, unique=True),
        sa.Column("intake_data", JSONB(), nullable=True),
        sa.Column("consent_signed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("consent_ip", sa.String(45), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index("ix_patient_registrations_token", "patient_registrations", ["registration_token"], unique=True)
    op.create_index("ix_patient_registrations_email", "patient_registrations", ["email"])


def downgrade() -> None:
    op.drop_index("ix_patient_registrations_email", table_name="patient_registrations")
    op.drop_index("ix_patient_registrations_token", table_name="patient_registrations")
    op.drop_table("patient_registrations")

    op.execute("DROP POLICY IF EXISTS psychologist_owns_nps ON nps_surveys")
    op.drop_index("ix_nps_surveys_token", table_name="nps_surveys")
    op.drop_table("nps_surveys")

    op.drop_column("sessions", "homework_assigned")
    op.drop_column("sessions", "is_emergency")
    op.drop_column("sessions", "mental_exam")
