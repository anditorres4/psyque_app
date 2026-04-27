"""Service for therapy indicators and measurements."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.therapy_indicator import TherapyIndicator, TherapyMeasurement
from app.schemas.therapy_indicator import (
    TherapyIndicatorCreate,
    TherapyIndicatorUpdate,
    TherapyMeasurementCreate,
)


class IndicatorNotFoundError(Exception):
    pass


class TherapyIndicatorService:
    def __init__(self, db: Session, tenant_id: uuid.UUID):
        self.db = db
        self.tenant_id = tenant_id

    def list_by_patient(self, patient_id: uuid.UUID) -> list[TherapyIndicator]:
        stmt = (
            select(TherapyIndicator)
            .where(TherapyIndicator.patient_id == patient_id)
            .order_by(TherapyIndicator.created_at)
        )
        return list(self.db.scalars(stmt))

    def create(self, patient_id: uuid.UUID, data: TherapyIndicatorCreate) -> TherapyIndicator:
        indicator = TherapyIndicator(
            tenant_id=self.tenant_id,
            patient_id=patient_id,
            **data.model_dump(),
        )
        self.db.add(indicator)
        self.db.commit()
        self.db.refresh(indicator)
        return indicator

    def update(self, indicator_id: uuid.UUID, data: TherapyIndicatorUpdate) -> TherapyIndicator:
        indicator = self._get_or_404(indicator_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(indicator, field, value)
        self.db.commit()
        self.db.refresh(indicator)
        return indicator

    def delete(self, indicator_id: uuid.UUID) -> None:
        indicator = self._get_or_404(indicator_id)
        self.db.delete(indicator)
        self.db.commit()

    def get_with_measurements(self, indicator_id: uuid.UUID) -> tuple[TherapyIndicator, list[TherapyMeasurement]]:
        indicator = self._get_or_404(indicator_id)
        stmt = (
            select(TherapyMeasurement)
            .where(TherapyMeasurement.indicator_id == indicator_id)
            .order_by(TherapyMeasurement.measured_at)
        )
        measurements = list(self.db.scalars(stmt))
        return indicator, measurements

    def add_measurement(self, indicator_id: uuid.UUID, data: TherapyMeasurementCreate) -> TherapyMeasurement:
        self._get_or_404(indicator_id)
        measurement = TherapyMeasurement(
            tenant_id=self.tenant_id,
            indicator_id=indicator_id,
            **data.model_dump(),
        )
        self.db.add(measurement)
        self.db.commit()
        self.db.refresh(measurement)
        return measurement

    def list_measurements(self, indicator_id: uuid.UUID) -> list[TherapyMeasurement]:
        self._get_or_404(indicator_id)
        stmt = (
            select(TherapyMeasurement)
            .where(TherapyMeasurement.indicator_id == indicator_id)
            .order_by(TherapyMeasurement.measured_at)
        )
        return list(self.db.scalars(stmt))

    def _get_or_404(self, indicator_id: uuid.UUID) -> TherapyIndicator:
        indicator = self.db.get(TherapyIndicator, indicator_id)
        if not indicator or indicator.tenant_id != self.tenant_id:
            raise IndicatorNotFoundError(indicator_id)
        return indicator
