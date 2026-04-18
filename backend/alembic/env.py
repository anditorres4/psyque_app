"""Alembic environment configuration for psyque app."""
import os
from logging.config import fileConfig

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import create_engine, pool

# Load .env so SUPABASE_DATABASE_URL is available when running alembic CLI
load_dotenv()

# Import all models so Alembic can detect schema changes
from app.models.base import Base  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Read DB URL directly from env — avoids configparser interpolation issues with % chars
DB_URL = os.environ.get("SUPABASE_DATABASE_URL", "")
if not DB_URL:
    raise RuntimeError("SUPABASE_DATABASE_URL environment variable is not set")


def run_migrations_offline() -> None:
    """Run migrations in offline mode (generates SQL without DB connection)."""
    context.configure(
        url=DB_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations with active DB connection."""
    connectable = create_engine(DB_URL, poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
