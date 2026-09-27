"""Temporal smoothing for vest classifier predictions across consecutive frames."""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field

from app.core.config import settings
from app.services.vest_classifier import VestClassification


@dataclass
class _SessionState:
    predictions: deque[tuple[bool, float]] = field(default_factory=deque)
    last_seen: float = field(default_factory=time.monotonic)


_sessions: dict[str, _SessionState] = {}


def record_prediction(session_id: str, classification: VestClassification) -> VestClassification:
    """
    Append a frame prediction and return a temporally smoothed result.

    Uses majority vote on vest_worn across the last N frames, breaking ties
    by average confidence.
    """
    window = max(1, settings.vest_temporal_window)
    state = _sessions.setdefault(session_id, _SessionState())
    state.last_seen = time.monotonic()
    state.predictions.append((classification.vest_worn, classification.confidence))

    while len(state.predictions) > window:
        state.predictions.popleft()

    _evict_stale_sessions()

    worn_votes = sum(1 for worn, _ in state.predictions if worn)
    not_worn_votes = len(state.predictions) - worn_votes

    if worn_votes > not_worn_votes:
        worn_confs = [c for worn, c in state.predictions if worn]
        avg_conf = sum(worn_confs) / len(worn_confs) if worn_confs else classification.confidence
        return VestClassification(
            label="vest_worn",
            confidence=avg_conf,
            vest_worn=True,
            probs=classification.probs,
        )

    if not_worn_votes > worn_votes:
        no_confs = [c for worn, c in state.predictions if not worn]
        avg_conf = sum(no_confs) / len(no_confs) if no_confs else classification.confidence
        return VestClassification(
            label="no_vest",
            confidence=avg_conf,
            vest_worn=False,
            probs=classification.probs,
        )

    # Tie — prefer fail-closed (no vest)
    return VestClassification(
        label="no_vest",
        confidence=classification.confidence,
        vest_worn=False,
        probs=classification.probs,
    )


def clear_session(session_id: str) -> None:
    _sessions.pop(session_id, None)


def _evict_stale_sessions() -> None:
    ttl = settings.vest_temporal_session_ttl_sec
    now = time.monotonic()
    stale = [sid for sid, st in _sessions.items() if now - st.last_seen > ttl]
    for sid in stale:
        _sessions.pop(sid, None)
