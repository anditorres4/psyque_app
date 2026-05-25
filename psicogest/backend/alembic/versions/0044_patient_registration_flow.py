"""Add registration token to booking_requests; make optional patient fields nullable.

Revision ID: 0044
Revises: 0043
Create Date: 2026-05-25
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0044"
down_revision: Union[str, None] = "0043"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- booking_requests: registration token columns ---
    op.add_column("booking_requests",
        sa.Column("registration_token", sa.String(36), nullable=True))
    op.add_column("booking_requests",
        sa.Column("registration_token_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("booking_requests",
        sa.Column("registration_token_used_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(
        "ix_booking_requests_registration_token",
        "booking_requests", ["registration_token"], unique=True,
        postgresql_where=sa.text("registration_token IS NOT NULL"),
    )

    # --- patients: make clinical fields nullable (filled during first session) ---
    op.alter_column("patients", "marital_status", nullable=True)
    op.alter_column("patients", "occupation",     nullable=True)
    op.alter_column("patients", "address",        nullable=True)
    op.alter_column("patients", "municipality_dane", nullable=True)
    op.alter_column("patients", "zone",           nullable=True)
    op.alter_column("patients", "payer_type",     nullable=True)
    # Consent fields — not collected in minimum registration form
    op.alter_column("patients", "consent_signed_at", nullable=True)
    op.alter_column("patients", "consent_ip",     nullable=True)


def downgrade() -> None:
    op.alter_column("patients", "consent_ip",        nullable=False)
    op.alter_column("patients", "consent_signed_at",  nullable=False)
    op.alter_column("patients", "payer_type",        nullable=False)
    op.alter_column("patients", "zone",              nullable=False)
    op.alter_column("patients", "municipality_dane", nullable=False)
    op.alter_column("patients", "address",           nullable=False)
    op.alter_column("patients", "occupation",        nullable=False)
    op.alter_column("patients", "marital_status",    nullable=False)

    op.drop_index("ix_booking_requests_registration_token", table_name="booking_requests")
    op.drop_column("booking_requests", "registration_token_used_at")
    op.drop_column("booking_requests", "registration_token_expires_at")
    op.drop_column("booking_requests", "registration_token")
