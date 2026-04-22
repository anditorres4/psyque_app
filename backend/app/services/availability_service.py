"""Availability service — manage psychologist weekly availability."""
import uuid
from datetime import time

from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.models.availability import AvailabilityBlock


class AvailabilityNotFoundError(Exception):
    pass


def _parse_time(value: str) -> time:
    parts = value.split(":")
    hour = int(parts[0])
    minute = int(parts[1]) if len(parts) > 1 else 0
    second = int(parts[2]) if len(parts) > 2 else 0
    return time(hour, minute, second)


class AvailabilityService:
    def __init__(self, db: DBSession, tenant_id: str) -> None:
        self.db = db
        self._tenant_id = uuid.UUID(tenant_id)

    def list(self) -> list[AvailabilityBlock]:
        return list(
            self.db.execute(
                select(AvailabilityBlock)
                .where(AvailabilityBlock.tenant_id == self._tenant_id)
                .order_by(AvailabilityBlock.day_of_week, AvailabilityBlock.start_time)
            ).scalars()
        )

    def create(self, data: dict) -> AvailabilityBlock:
        start = _parse_time(data["start_time"])
        end = _parse_time(data["end_time"])
        if end <= start:
            raise ValueError("end_time debe ser posterior a start_time")
        block = AvailabilityBlock(
            tenant_id=self._tenant_id,
            day_of_week=data["day_of_week"],
            start_time=start,
            end_time=end,
        )
        self.db.add(block)
        self.db.commit()
        self.db.refresh(block)
        return block

    def delete(self, block_id: str) -> None:
        block = self.db.get(AvailabilityBlock, uuid.UUID(block_id))
        if not block or block.tenant_id != self._tenant_id:
            raise AvailabilityNotFoundError(block_id)
        self.db.delete(block)
        self.db.commit()