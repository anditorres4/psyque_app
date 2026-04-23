"""FastAPI application factory for psyque app backend."""
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.auth_routes import router as auth_router
from app.api.v1.health import router as health_router
from app.api.v1.appointments import router as appointments_router
from app.api.v1.sessions import router as sessions_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.patients import router as patients_router
from app.api.v1.rips import router as rips_router
from app.api.v1.invoices import router as invoices_router
from app.api.v1.profile import router as profile_router
from app.api.v1.availability import router as availability_router
from app.api.v1.documents import router as documents_router
from app.api.v1.reports import router as reports_router
from app.core.config import settings
from app.core.database import SessionLocal
from app.jobs.reminders import run_reminder_check


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        run_reminder_check,
        "interval",
        minutes=15,
        kwargs={"session_factory": SessionLocal},
        id="reminder_check",
    )
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(
    title="psyque app API",
    description="Sistema de gestión clínica para psicólogos independientes en Colombia",
    version="1.0.0",
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.app_url,
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(patients_router, prefix="/api/v1")
app.include_router(appointments_router, prefix="/api/v1")
app.include_router(sessions_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(rips_router, prefix="/api/v1")
app.include_router(invoices_router, prefix="/api/v1")
app.include_router(profile_router, prefix="/api/v1")
app.include_router(availability_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")