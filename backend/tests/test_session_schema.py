"""Tests for session schema validation — CIE-11 and CUPS code format."""
from datetime import datetime, timezone, timedelta

import pytest
from pydantic import ValidationError

from app.schemas.session import SessionCreate, SessionUpdate


def _base_data(**overrides):
    now = datetime.now(tz=timezone.utc)
    start = now - timedelta(hours=1)
    end = start + timedelta(minutes=50)
    base = {
        "appointment_id": "00000000-0000-0000-0000-000000000001",
        "patient_id": "00000000-0000-0000-0000-000000000002",
        "actual_start": start,
        "actual_end": end,
        "diagnosis_cie11": "6A70",
        "diagnosis_description": "Trastorno depresivo recurrente leve",
        "cups_code": "890403",
        "consultation_reason": "Paciente refiere tristeza persistente hace tres meses",
        "intervention": "Terapia cognitivo-conductual, técnicas de activación conductual",
        "session_fee": 150000,
    }
    base.update(overrides)
    return base


class TestCie11Validation:
    @pytest.mark.parametrize(
        "code",
        [
            "670",        # short numeric-only (edge case, regex accepts)
            "6A70",       # base code
            "6A70.1",     # with extension
            "11A6/Z",     # with cluster
            "6A70.10",    # deeper extension
            "AA00",       # letter prefix
            "6B00.1",     # another category
        ],
    )
    def test_valid_cie11_accepts(self, code):
        data = _base_data(diagnosis_cie11=code)
        result = SessionCreate(**data)
        assert result.diagnosis_cie11 == code

    @pytest.mark.parametrize(
        "code",
        [
            "6A7",        # too short
            "6A7000",     # too many digits before dot
            "A670",       # letters first, wrong order
            "6A70-1",     # hyphen not allowed
            "6A70 1",     # space not allowed
            "",           # empty
        ],
    )
    def test_invalid_cie11_rejects(self, code):
        data = _base_data(diagnosis_cie11=code)
        with pytest.raises(ValidationError) as exc_info:
            SessionCreate(**data)
        assert "CIE-11" in str(exc_info.value)


class TestCupsValidation:
    @pytest.mark.parametrize(
        "code",
        [
            "890101",
            "890102",
            "890403",
            "890601",
            "000000",
            "999999",
        ],
    )
    def test_valid_cups_accepts(self, code):
        data = _base_data(cups_code=code)
        result = SessionCreate(**data)
        assert result.cups_code == code

    @pytest.mark.parametrize(
        "code",
        [
            "89040",      # too short
            "8904031",    # too long
            "89040A",     # non-numeric
            "89040.",     # dot not allowed
            "",           # empty
            "0890403",    # leading zero
        ],
    )
    def test_invalid_cups_rejects(self, code):
        data = _base_data(cups_code=code)
        with pytest.raises(ValidationError) as exc_info:
            SessionCreate(**data)
        assert "CUPS" in str(exc_info.value) or "6-digit" in str(exc_info.value)


class TestSessionUpdateValidation:
    def test_update_valid_cie11_passes(self):
        update = SessionUpdate(diagnosis_cie11="6A70.1")
        assert update.diagnosis_cie11 == "6A70.1"

    def test_update_invalid_cie11_rejects(self):
        with pytest.raises(ValidationError):
            SessionUpdate(diagnosis_cie11="invalid")

    def test_update_valid_cups_passes(self):
        update = SessionUpdate(cups_code="890601")
        assert update.cups_code == "890601"

    def test_update_invalid_cups_rejects(self):
        with pytest.raises(ValidationError):
            SessionUpdate(cups_code="89060")

    def test_update_optional_fields_allows_none(self):
        update = SessionUpdate()
        assert update.diagnosis_cie11 is None
        assert update.cups_code is None


class TestEndAfterStartValidation:
    def test_end_before_start_rejects(self):
        now = datetime.now(tz=timezone.utc)
        data = _base_data(
            actual_start=now,
            actual_end=now - timedelta(minutes=10),
        )
        with pytest.raises(ValidationError) as exc_info:
            SessionCreate(**data)
        assert "after" in str(exc_info.value).lower()