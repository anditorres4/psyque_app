"""100ms.live video room service."""
import time
import uuid
from typing import Any

import httpx
from jose import jwt as jose_jwt

from app.core.config import settings

HMS_API = "https://api.100ms.live/v2"


def _encode_hms_token(payload: dict[str, Any], *, expires_in_seconds: int) -> str:
    """Encode a 100ms JWT with the standard claims expected by the platform."""
    now = int(time.time())
    token_payload = {
        **payload,
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": now + expires_in_seconds,
    }
    return jose_jwt.encode(token_payload, settings.hms_app_secret, algorithm="HS256")


def _management_token() -> str:
    now = int(time.time())
    return _encode_hms_token(
        {
            "access_key": settings.hms_app_key,
            "type": "management",
            "version": 2,
        },
        expires_in_seconds=86400,
    )


class HmsService:
    def create_room(self, appointment_id: str) -> str:
        """Create a 100ms room for an appointment. Returns room_id."""
        mgmt_token = _management_token()
        resp = httpx.post(
            f"{HMS_API}/rooms",
            json={
                "name": f"psyque-{appointment_id}",
                "description": f"Virtual session for appointment {appointment_id}",
                "template_id": settings.hms_template_id,
            },
            headers={"Authorization": f"Bearer {mgmt_token}"},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()["id"]

    def create_app_token(self, room_id: str, user_id: str, role: str) -> str:
        """Generate an auth token for joining a room with a given role."""
        return _encode_hms_token(
            {
                "access_key": settings.hms_app_key,
                "room_id": room_id,
                "user_id": user_id,
                "role": role,
                "type": "app",
                "version": 2,
            },
            expires_in_seconds=7200,
        )
