"""FastAPI application factory for PsyCent backend."""
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.caja import router as caja_router
from app.api.v1.cartera import router as cartera_router
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
from app.api.v1.indicators import router as indicators_router
from app.api.v1.referrals import router as referrals_router
from app.api.v1.booking import router as booking_public_router
from app.api.v1.booking_requests import router as booking_requests_router
from app.api.v1.google_calendar import router as gcal_router
from app.api.v1.ai import router as ai_router
from app.api.v1.video import router as video_router
from app.api.v1.nps import router as nps_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.webhooks import router as webhooks_router
from app.api.v1.patient_auth import router as patient_auth_router
from app.api.v1.portal_api import router as portal_api_router
from app.api.v1.portal_onboarding import router as portal_onboarding_router
from app.api.v1.patient_portal import router as patient_portal_router
from app.api.v1.therapeutic_goals import router as therapeutic_goals_router
from app.api.v1.patient_tasks import router as patient_tasks_router, portal_router as patient_tasks_portal_router
from app.api.v1.billing import router as billing_router
from app.core.config import settings
from app.core.deps import require_active_subscription, require_plan
from app.core.database import SessionLocal
from app.jobs.reminders import run_reminder_check
from app.jobs.gcal_sync import run_gcal_sync


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
    scheduler.add_job(
        run_gcal_sync,
        "interval",
        minutes=15,
        kwargs={"session_factory": SessionLocal},
        id="gcal_sync",
    )
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(
    title="PsyCent API",
    description="Sistema de gestión clínica para psicólogos independientes en Colombia",
    version="1.0.0",
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
    lifespan=lifespan,
)

_cors_origins = settings.allowed_cors_origins
if settings.is_development:
    _cors_origins += [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5175",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    expose_headers=["Content-Disposition"],
)

# Public / auth routes — no subscription guard
app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(billing_router, prefix="/api/v1")
app.include_router(booking_public_router, prefix="/api/v1")
app.include_router(booking_requests_router, prefix="/api/v1")
app.include_router(webhooks_router, prefix="/api/v1")
app.include_router(patient_auth_router, prefix="/api/v1")
app.include_router(portal_api_router, prefix="/api/v1")
app.include_router(portal_onboarding_router, prefix="/api/v1")
app.include_router(patient_portal_router, prefix="/api/v1")
app.include_router(patient_tasks_portal_router, prefix="/api/v1")

# Therapist routes — require active subscription
_sub = [Depends(require_active_subscription)]

app.include_router(patients_router, prefix="/api/v1", dependencies=_sub)
app.include_router(appointments_router, prefix="/api/v1", dependencies=_sub)
app.include_router(sessions_router, prefix="/api/v1", dependencies=_sub)
app.include_router(dashboard_router, prefix="/api/v1", dependencies=_sub)
app.include_router(profile_router, prefix="/api/v1", dependencies=_sub)
app.include_router(availability_router, prefix="/api/v1", dependencies=_sub)
app.include_router(documents_router, prefix="/api/v1", dependencies=_sub)
app.include_router(reports_router, prefix="/api/v1", dependencies=_sub)
app.include_router(caja_router, prefix="/api/v1", dependencies=_sub)
app.include_router(cartera_router, prefix="/api/v1", dependencies=_sub)
app.include_router(indicators_router, prefix="/api/v1", dependencies=_sub)
app.include_router(referrals_router, prefix="/api/v1", dependencies=_sub)
app.include_router(gcal_router, prefix="/api/v1", dependencies=_sub)
app.include_router(ai_router, prefix="/api/v1", dependencies=_sub)
app.include_router(video_router, prefix="/api/v1", dependencies=_sub)
app.include_router(nps_router, prefix="/api/v1", dependencies=_sub)
app.include_router(notifications_router, prefix="/api/v1", dependencies=_sub)
app.include_router(therapeutic_goals_router, prefix="/api/v1", dependencies=_sub)
app.include_router(patient_tasks_router, prefix="/api/v1", dependencies=_sub)

# Premium-only routers
_premium = [Depends(require_active_subscription), Depends(require_plan("premium"))]
app.include_router(rips_router, prefix="/api/v1", dependencies=_premium)
app.include_router(invoices_router, prefix="/api/v1", dependencies=_premium)
