"""Referrals router."""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.core.deps import get_tenant_db, TenantDB
from app.schemas.referral import ReferralCreate, ReferralDetail
from app.services.referral_service import ReferralNotFoundError, ReferralService

router = APIRouter(tags=["referrals"])


def _svc(ctx: TenantDB) -> ReferralService:
    return ReferralService(ctx.db, ctx.tenant.tenant_id)


@router.post(
    "/patients/{patient_id}/referrals",
    response_model=ReferralDetail,
    status_code=status.HTTP_201_CREATED,
)
def create_referral(
    patient_id: uuid.UUID,
    body: ReferralCreate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
):
    return _svc(ctx).create(patient_id, body)


@router.get(
    "/patients/{patient_id}/referrals",
    response_model=list[ReferralDetail],
)
def list_referrals(
    patient_id: uuid.UUID,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
):
    return _svc(ctx).list_by_patient(patient_id)


@router.get("/referrals/{referral_id}/pdf")
def download_referral_pdf(
    referral_id: uuid.UUID,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
):
    try:
        pdf_bytes = _svc(ctx).generate_pdf(referral_id)
    except ReferralNotFoundError:
        raise HTTPException(status_code=404, detail="Referral not found")

    filename = f"remision_{referral_id}.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
