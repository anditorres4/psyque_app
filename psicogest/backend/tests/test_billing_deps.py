"""Unit tests for require_active_subscription and require_plan."""
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.core.deps import require_active_subscription, require_plan


def _mock_ctx(plan: str, expires_at: datetime) -> MagicMock:
    ctx = MagicMock()
    ctx.tenant.tenant_id = "test-tenant-id"
    row = MagicMock()
    row.plan = plan
    row.plan_expires_at = expires_at
    ctx.db.execute.return_value.fetchone.return_value = row
    return ctx


# --- require_active_subscription ---

def test_active_subscription_passes_when_valid():
    ctx = _mock_ctx("estandar", datetime.now(timezone.utc) + timedelta(days=5))
    require_active_subscription(ctx)  # must not raise


def test_active_subscription_passes_within_grace_period():
    ctx = _mock_ctx("estandar", datetime.now(timezone.utc) - timedelta(hours=12))
    require_active_subscription(ctx)  # expired but within 3-day grace — must not raise


def test_active_subscription_blocks_after_grace_period():
    ctx = _mock_ctx("estandar", datetime.now(timezone.utc) - timedelta(days=5))
    with pytest.raises(HTTPException) as exc_info:
        require_active_subscription(ctx)
    assert exc_info.value.status_code == 402


def test_active_subscription_blocks_at_exactly_grace_boundary():
    ctx = _mock_ctx("estandar", datetime.now(timezone.utc) - timedelta(days=3, seconds=1))
    with pytest.raises(HTTPException) as exc_info:
        require_active_subscription(ctx)
    assert exc_info.value.status_code == 402


# --- require_plan ---

def test_require_plan_allows_premium():
    ctx = _mock_ctx("premium", datetime.now(timezone.utc) + timedelta(days=5))
    require_plan("premium")(ctx)  # must not raise


def test_require_plan_allows_free_trial():
    ctx = _mock_ctx("free_trial", datetime.now(timezone.utc) + timedelta(days=5))
    require_plan("premium")(ctx)  # free_trial always passes — must not raise


def test_require_plan_blocks_estandar():
    ctx = _mock_ctx("estandar", datetime.now(timezone.utc) + timedelta(days=5))
    with pytest.raises(HTTPException) as exc_info:
        require_plan("premium")(ctx)
    assert exc_info.value.status_code == 403


def test_require_plan_returns_403_message():
    ctx = _mock_ctx("estandar", datetime.now(timezone.utc) + timedelta(days=5))
    with pytest.raises(HTTPException) as exc_info:
        require_plan("premium")(ctx)
    assert "Premium" in str(exc_info.value.detail)
