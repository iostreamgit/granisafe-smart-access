"""Optional YOLO classification model for vest_worn vs no_vest."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

_classifier: Any | None = None
_classifier_loaded = False
_load_error: str | None = None

VEST_WORN = "vest_worn"
NO_VEST = "no_vest"
CLASS_NAMES = (VEST_WORN, NO_VEST)


def is_classifier_loaded() -> bool:
    return _classifier_loaded


def load_error() -> str | None:
    return _load_error


def get_classifier() -> Any | None:
    return _classifier


def try_load_classifier() -> None:
    global _classifier, _classifier_loaded, _load_error

    if not settings.vest_classifier_enabled:
        _classifier = None
        _classifier_loaded = False
        _load_error = "Vest classifier disabled (VEST_CLASSIFIER_ENABLED=false)"
        logger.info("Vest classifier: disabled")
        return

    path = Path(settings.vest_classifier_path)
    if not path.is_absolute():
        path = (Path(__file__).resolve().parents[2] / path).resolve()
    if not path.is_file():
        _classifier = None
        _classifier_loaded = False
        _load_error = f"Vest classifier weights not found at {path}"
        logger.warning("Vest classifier not loaded: %s", _load_error)
        return

    try:
        from ultralytics import YOLO  # type: ignore

        _classifier = YOLO(str(path))
        _classifier_loaded = True
        _load_error = None
        logger.info("Loaded vest classifier from %s on %s", path, settings.device)
    except Exception as exc:  # noqa: BLE001
        _classifier = None
        _classifier_loaded = False
        _load_error = str(exc)
        logger.warning("Failed to load vest classifier: %s", exc)
