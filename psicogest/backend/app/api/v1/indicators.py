"""Therapy indicators router."""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import get_tenant_db, TenantDB
from app.schemas.therapy_indicator import (
    TherapyIndicatorCreate,
    TherapyIndicatorDetail,
    TherapyIndicatorUpdate,
    TherapyIndicatorWithMeasurements,
    TherapyMeasurementCreate,
    TherapyMeasurementDetail,
)
from app.services.therapy_indicator_service import IndicatorNotFoundError, TherapyIndicatorService

router = APIRouter(tags=["indicators"])


def _svc(ctx: TenantDB) -> TherapyIndicatorService:
    return TherapyIndicatorService(ctx.db, ctx.tenant.tenant_id)


@router.get("/patients/{patient_id}/indicators", response_model=list[TherapyIndicatorDetail])
def list_indicators(
    patient_id: uuid.UUID,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
):
    indicators = _svc(ctx).list_by_patient(patient_id)
    return [TherapyIndicatorDetail.model_validate(indicator) for indicator in indicators]


@router.post(
    "/patients/{patient_id}/indicators",
    response_model=TherapyIndicatorDetail,
    status_code=status.HTTP_201_CREATED,
)
def create_indicator(
    patient_id: uuid.UUID,
    body: TherapyIndicatorCreate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
):
    indicator = _svc(ctx).create(patient_id, body)
    return TherapyIndicatorDetail.model_validate(indicator)


@router.get("/indicators/{indicator_id}", response_model=TherapyIndicatorWithMeasurements)
def get_indicator(
    indicator_id: uuid.UUID,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
):
    try:
        indicator, measurements = _svc(ctx).get_with_measurements(indicator_id)
    except IndicatorNotFoundError:
        raise HTTPException(status_code=404, detail="Indicator not found")
    result = TherapyIndicatorWithMeasurements.model_validate(indicator)
    result.measurements = [TherapyMeasurementDetail.model_validate(m) for m in measurements]
    return result


@router.put("/indicators/{indicator_id}", response_model=TherapyIndicatorDetail)
def update_indicator(
    indicator_id: uuid.UUID,
    body: TherapyIndicatorUpdate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
):
    try:
        indicator = _svc(ctx).update(indicator_id, body)
        return TherapyIndicatorDetail.model_validate(indicator)
    except IndicatorNotFoundError:
        raise HTTPException(status_code=404, detail="Indicator not found")


@router.delete("/indicators/{indicator_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_indicator(
    indicator_id: uuid.UUID,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
):
    try:
        _svc(ctx).delete(indicator_id)
    except IndicatorNotFoundError:
        raise HTTPException(status_code=404, detail="Indicator not found")


@router.post(
    "/indicators/{indicator_id}/measurements",
    response_model=TherapyMeasurementDetail,
    status_code=status.HTTP_201_CREATED,
)
def add_measurement(
    indicator_id: uuid.UUID,
    body: TherapyMeasurementCreate,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
):
    try:
        measurement = _svc(ctx).add_measurement(indicator_id, body)
        return TherapyMeasurementDetail.model_validate(measurement)
    except IndicatorNotFoundError:
        raise HTTPException(status_code=404, detail="Indicator not found")


@router.get("/indicators/{indicator_id}/measurements", response_model=list[TherapyMeasurementDetail])
def list_measurements(
    indicator_id: uuid.UUID,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
):
    try:
        measurements = _svc(ctx).list_measurements(indicator_id)
        return [TherapyMeasurementDetail.model_validate(measurement) for measurement in measurements]
    except IndicatorNotFoundError:
        raise HTTPException(status_code=404, detail="Indicator not found")
