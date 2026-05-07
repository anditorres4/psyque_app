"""Pydantic schemas for notifications."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: UUID
    type: str
    title: str
    body: str | None
    read_at: datetime | None
    created_at: datetime
    extra_data: dict

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    items: list[NotificationOut]
    unread_count: int
