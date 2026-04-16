"""SQLAlchemy engine and session factory for Supabase PostgreSQL."""
from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.supabase_database_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    echo=settings.is_development,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that provides a database session.

    The caller must invoke set_tenant_context() after acquiring the session
    so that PostgreSQL RLS policies can filter rows by tenant.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def set_tenant_context(db: Session, tenant_id: str) -> None:
    """Inject tenant_id into the PostgreSQL session for RLS evaluation.

    RLS policies read current_setting('app.tenant_id', true). This function
    sets that variable for the lifetime of the current transaction.

    Args:
        db: Active SQLAlchemy session.
        tenant_id: UUID string of the authenticated tenant (psychologist).
    """
    db.execute(
        text("SET LOCAL app.tenant_id = :tid"),
        {"tid": tenant_id},
    )
