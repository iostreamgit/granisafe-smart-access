"""Save false vest detections for later retraining."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING

from app.core.config import settings
from app.services.vest_classifier_loader import NO_VEST, VEST_WORN

if TYPE_CHECKING:
    from PIL import Image

logger = logging.getLogger(__name__)


def save_mistake(
    *,
    torso_crop: Image.Image,
    predicted_label: str,
    yolo_vest_detected: bool,
    session_id: str | None = None,
    reason: str = "yolo_vest_but_classifier_no_vest",
) -> Path | None:
    """
    Persist a torso crop when stage-1 and stage-2 disagree.

    Saves to mistakes/no_vest/ when YOLO saw a vest but classifier says no_vest.
    Saves to mistakes/vest_worn/ when classifier says worn but YOLO had no vest box
    (less common — useful for missed detections).
    """
    if not settings.vest_feedback_enabled:
        return None

    out_root = _mistakes_dir()
    if predicted_label == NO_VEST and yolo_vest_detected:
        subdir = NO_VEST
    elif predicted_label == VEST_WORN and not yolo_vest_detected:
        subdir = VEST_WORN
    else:
        return None

    dest_dir = out_root / subdir
    dest_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.now(UTC).strftime("%Y%m%dT%H%M%S_%f")
    sid = (session_id or "nosession")[:32]
    filename = f"{ts}_{sid}_{reason}.jpg"
    dest = dest_dir / filename

    try:
        torso_crop.save(dest, format="JPEG", quality=92)
        logger.info("Saved vest feedback sample: %s", dest)
        return dest
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to save vest feedback: %s", exc)
        return None


def _mistakes_dir() -> Path:
    path = Path(settings.vest_mistakes_dir)
    if not path.is_absolute():
        path = (Path(__file__).resolve().parents[2] / path).resolve()
    return path
