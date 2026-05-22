"""fevrips new fields

Revision ID: 0042
Revises: 0041
Create Date: 2026-05-22

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0042"
down_revision = "0041"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # patients — geographic fields for RIPS v4.3
    op.add_column("patients", sa.Column("cod_pais_residencia", sa.String(3), nullable=True, server_default="170"))
    op.add_column("patients", sa.Column("cod_pais_origen", sa.String(3), nullable=True, server_default="170"))
    op.add_column("patients", sa.Column("incapacidad", sa.String(10), nullable=True, server_default="NO"))

    # sessions — clinical/billing fields for RIPS v4.3
    op.add_column("sessions", sa.Column("modalidad_grupo_servicio", sa.String(2), nullable=True, server_default="01"))
    op.add_column("sessions", sa.Column("grupo_servicios", sa.String(2), nullable=True, server_default="02"))
    op.add_column("sessions", sa.Column("cod_servicio", sa.Integer(), nullable=True, server_default="706"))
    op.add_column("sessions", sa.Column("finalidad_tecnologia_salud", sa.String(2), nullable=True, server_default="44"))
    op.add_column("sessions", sa.Column("causa_motivo_atencion", sa.String(2), nullable=True, server_default="27"))
    op.add_column("sessions", sa.Column("concepto_recaudo", sa.String(2), nullable=True, server_default="05"))
    op.add_column("sessions", sa.Column("valor_pago_moderador", sa.Integer(), nullable=True, server_default="0"))

    # rips_exports — MinSalud API response fields
    op.add_column("rips_exports", sa.Column("cuv", sa.String(128), nullable=True))
    op.add_column("rips_exports", sa.Column("fecha_radicacion", sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column("rips_exports", sa.Column("num_factura", sa.String(30), nullable=True))
    op.add_column("rips_exports", sa.Column("fevrips_api_response", JSONB(), nullable=True))

    # tenants — SISPRO credentials for premium automatic submission
    op.add_column("tenants", sa.Column("fevrips_sispro_password", sa.Text(), nullable=True))
    op.add_column("tenants", sa.Column("fevrips_tipo_usuario", sa.String(10), nullable=True))
    op.add_column("tenants", sa.Column("fevrips_doc_type", sa.String(5), nullable=True, server_default="CC"))
    op.add_column("tenants", sa.Column("fevrips_doc_number", sa.String(20), nullable=True))


def downgrade() -> None:
    for col in ["cuv", "fecha_radicacion", "num_factura", "fevrips_api_response"]:
        op.drop_column("rips_exports", col)
    for col in ["modalidad_grupo_servicio", "grupo_servicios", "cod_servicio",
                "finalidad_tecnologia_salud", "causa_motivo_atencion",
                "concepto_recaudo", "valor_pago_moderador"]:
        op.drop_column("sessions", col)
    for col in ["cod_pais_residencia", "cod_pais_origen", "incapacidad"]:
        op.drop_column("patients", col)
    for col in ["fevrips_sispro_password", "fevrips_tipo_usuario", "fevrips_doc_type", "fevrips_doc_number"]:
        op.drop_column("tenants", col)
