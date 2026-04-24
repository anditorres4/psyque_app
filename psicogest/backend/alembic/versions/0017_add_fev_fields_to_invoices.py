"""Add FEV fields to invoices (CUFE, QR, DIAN response, XML path, sent_at).

Revision ID: 0017
Revises: 0016
Create Date: 2026-04-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("invoices", sa.Column("cufe", sa.String(96), nullable=True))
    op.add_column("invoices", sa.Column("qr_data", sa.Text(), nullable=True))
    op.add_column("invoices", sa.Column("dian_response_code", sa.String(10), nullable=True))
    op.add_column("invoices", sa.Column("dian_response_message", sa.Text(), nullable=True))
    op.add_column("invoices", sa.Column("xml_file_path", sa.Text(), nullable=True))
    op.add_column(
        "invoices",
        sa.Column("fev_sent_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("invoices", "fev_sent_at")
    op.drop_column("invoices", "xml_file_path")
    op.drop_column("invoices", "dian_response_message")
    op.drop_column("invoices", "dian_response_code")
    op.drop_column("invoices", "qr_data")
    op.drop_column("invoices", "cufe")
