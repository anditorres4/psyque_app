"""Health check endpoint."""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db

router = APIRouter()


@router.get("/health", tags=["health"])
def health_check(db: Session = Depends(get_db)) -> dict:
    """Return service health and database connectivity.

    Returns:
        dict with status, database, version, and service name.
    """
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "error"

    return {
        "status": "ok",
        "database": db_status,
        "version": "1.0.0",
        "service": "psyque-backend",
    }
