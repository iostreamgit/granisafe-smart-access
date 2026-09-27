"""Tests for vest temporal smoothing."""

from app.services.vest_classifier import VestClassification
from app.services.vest_temporal import clear_session, record_prediction


def _cls(*, worn: bool, conf: float = 0.9) -> VestClassification:
    return VestClassification(
        label="vest_worn" if worn else "no_vest",
        confidence=conf,
        vest_worn=worn,
        probs={"vest_worn": conf if worn else 0.1, "no_vest": 0.1 if worn else conf},
    )


def test_temporal_majority_no_vest():
    sid = "test-session-no-vest"
    clear_session(sid)
    for _ in range(4):
        record_prediction(sid, _cls(worn=False, conf=0.88))
    result = record_prediction(sid, _cls(worn=True, conf=0.95))
    assert result.vest_worn is False


def test_temporal_majority_vest_worn():
    sid = "test-session-worn"
    clear_session(sid)
    for _ in range(4):
        record_prediction(sid, _cls(worn=True, conf=0.92))
    result = record_prediction(sid, _cls(worn=False, conf=0.85))
    assert result.vest_worn is True


def test_temporal_tie_fail_closed():
    sid = "test-session-tie"
    clear_session(sid)
    record_prediction(sid, _cls(worn=True, conf=0.9))
    result = record_prediction(sid, _cls(worn=False, conf=0.9))
    assert result.vest_worn is False
