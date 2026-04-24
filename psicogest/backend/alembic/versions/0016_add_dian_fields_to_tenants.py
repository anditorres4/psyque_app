"""Add fiscal and DIAN resolution fields to tenants for FEV support.

Revision ID: 0016
Revises: 0015
Create Date: 2026-04-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE TYPE tipo_persona_enum AS ENUM ('natural', 'juridica')")
    op.execute("CREATE TYPE regime_tributario_enum AS ENUM ('ordinario', 'simplificado')")

    op.add_column("tenants", sa.Column("email", sa.String(200), nullable=True))
    op.add_column("tenants", sa.Column("address", sa.String(300), nullable=True))
    op.add_column("tenants", sa.Column("municipio_code", sa.String(10), nullable=True))
    op.add_column(
        "tenants",
        sa.Column(
            "tipo_persona",
            sa.Enum("natural", "juridica", name="tipo_persona_enum"),
            nullable=True,
        ),
    )
    op.add_column(
        "tenants",
        sa.Column(
            "regime_tributario",
            sa.Enum("ordinario", "simplificado", name="regime_tributario_enum"),
            nullable=True,
        ),
    )
    op.add_column("tenants", sa.Column("dian_resolution_number", sa.String(20), nullable=True))
    op.add_column("tenants", sa.Column("dian_resolution_prefix", sa.String(10), nullable=True))
    op.add_column("tenants", sa.Column("dian_resolution_from", sa.Integer(), nullable=True))
    op.add_column("tenants", sa.Column("dian_resolution_to", sa.Integer(), nullable=True))
    op.add_column("tenants", sa.Column("dian_resolution_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("tenants", "dian_resolution_date")
    op.drop_column("tenants", "dian_resolution_to")
    op.drop_column("tenants", "dian_resolution_from")
    op.drop_column("tenants", "dian_resolution_prefix")
    op.drop_column("tenants", "dian_resolution_number")
    op.drop_column("tenants", "regime_tributario")
    op.drop_column("tenants", "tipo_persona")
    op.drop_column("tenants", "municipio_code")
    op.drop_column("tenants", "address")
    op.drop_column("tenants", "email")

    op.execute("DROP TYPE regime_tributario_enum")
    op.execute("DROP TYPE tipo_persona_enum")
