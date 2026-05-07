"""NotificationService — create and manage in-app notifications for psychologists."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.notification import Notification


class NotificationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        *,
        psychologist_auth_id: uuid.UUID,
        type: str,
        title: str,
        body: str | None = None,
        metadata: dict | None = None,
    ) -> Notification:
        notification = Notification(
            psychologist_id=psychologist_auth_id,
            type=type,
            title=title,
            body=body,
            metadata=metadata or {},
        )
        self.db.add(notification)
        self.db.flush()
        return notification

    def list_recent(
        self,
        psychologist_auth_id: uuid.UUID,
        limit: int = 30,
    ) -> list[Notification]:
        return (
            self.db.query(Notification)
            .filter(Notification.psychologist_id == psychologist_auth_id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
            .all()
        )

    def unread_count(self, psychologist_auth_id: uuid.UUID) -> int:
        return (
            self.db.query(Notification)
            .filter(
                Notification.psychologist_id == psychologist_auth_id,
                Notification.read_at.is_(None),
            )
            .count()
        )

    def mark_read(self, notification_id: uuid.UUID, psychologist_auth_id: uuid.UUID) -> Notification | None:
        n = (
            self.db.query(Notification)
            .filter(
                Notification.id == notification_id,
                Notification.psychologist_id == psychologist_auth_id,
            )
            .first()
        )
        if n and n.read_at is None:
            n.read_at = datetime.now(tz=timezone.utc)
            self.db.flush()
        return n

    def mark_all_read(self, psychologist_auth_id: uuid.UUID) -> int:
        now = datetime.now(tz=timezone.utc)
        updated = (
            self.db.query(Notification)
            .filter(
                Notification.psychologist_id == psychologist_auth_id,
                Notification.read_at.is_(None),
            )
            .all()
        )
        for n in updated:
            n.read_at = now
        self.db.flush()
        return len(updated)
