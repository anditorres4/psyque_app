"""Tenant SQLAlchemy model — psychologist/clinic subscription.

Table exists from migration 0001.
"""
import uuid
from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import DateTime, func

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class Tenant(Base, UUIDPrimaryKey):
    """Psychologist/clinic subscription — one per authenticated user."""

    __tablename__ = "tenants"

    auth_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, unique=True
    )
    full_name: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    colpsic_number: Mapped[str] = mapped_column(sa.String(20), nullable=False)
    reps_code: Mapped[str | None] = mapped_column(sa.String(30), nullable=True)
    nit: Mapped[str | None] = mapped_column(sa.String(15), nullable=True)
    plan: Mapped[str] = mapped_column(
        sa.Enum("starter", "pro", "clinic", name="saas_plan"),
        nullable=False,
        default="starter",
    )
    plan_expires_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False
    )
    city: Mapped[str] = mapped_column(sa.String(100), nullable=False)
    session_duration_min: Mapped[int] = mapped_column(sa.Integer(), nullable=False, default=50)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # --- Datos fiscales para FEV (Factura Electrónica de Venta) ---
    email: Mapped[str | None] = mapped_column(sa.String(200), nullable=True)
    address: Mapped[str | None] = mapped_column(sa.String(300), nullable=True)
    municipio_code: Mapped[str | None] = mapped_column(sa.String(10), nullable=True)
    tipo_persona: Mapped[str | None] = mapped_column(
        sa.Enum("natural", "juridica", name="tipo_persona_enum"),
        nullable=True,
    )
    regime_tributario: Mapped[str | None] = mapped_column(
        sa.Enum("ordinario", "simplificado", name="regime_tributario_enum"),
        nullable=True,
    )

    # --- Resolución DIAN para numeración FEV ---
    dian_resolution_number: Mapped[str | None] = mapped_column(sa.String(20), nullable=True)
    dian_resolution_prefix: Mapped[str | None] = mapped_column(sa.String(10), nullable=True)
    dian_resolution_from: Mapped[int | None] = mapped_column(sa.Integer(), nullable=True)
    dian_resolution_to: Mapped[int | None] = mapped_column(sa.Integer(), nullable=True)
    dian_resolution_date: Mapped[date | None] = mapped_column(sa.Date(), nullable=True)

    # --- Agendamiento público ---
    booking_slug: Mapped[str | None] = mapped_column(sa.String(50), nullable=True, unique=True)
    booking_enabled: Mapped[bool] = mapped_column(
        sa.Boolean(), nullable=False, server_default=sa.text("false")
    )
    booking_welcome_message: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)

    # --- IA / Diagnóstico asistido ---
    ai_provider: Mapped[str | None] = mapped_column(sa.String(20), nullable=True)
    ai_model: Mapped[str | None] = mapped_column(sa.String(100), nullable=True)
    ai_api_key: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)

    # --- Feature flags (JSONB) ---
    features: Mapped[dict] = mapped_column(
        JSONB(),
        nullable=False,
        server_default=sa.text('\'{"ai_diagnosis": true, "ai_summaries": true, "ai_documents": true}\''),
    )
