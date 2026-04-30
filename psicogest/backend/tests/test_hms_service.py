"""Tests for 100ms token generation."""
from jose import jwt as jose_jwt

from app.services.hms_service import HmsService


def test_create_app_token_includes_required_100ms_claims():
    svc = HmsService()

    token = svc.create_app_token("room-123", "user-456", "psychologist")
    payload = jose_jwt.get_unverified_claims(token)

    assert payload["access_key"]
    assert payload["room_id"] == "room-123"
    assert payload["user_id"] == "user-456"
    assert payload["role"] == "psychologist"
    assert payload["type"] == "app"
    assert payload["version"] == 2
    assert isinstance(payload["jti"], str)
    assert payload["jti"]
    assert isinstance(payload["iat"], int)
    assert isinstance(payload["exp"], int)
    assert payload["exp"] > payload["iat"]
