"""Optional YOLO model loader. Falls back to stub mode when weights missing."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

_model: Any | None = None
_model_loaded = False
_load_error: str | None = None


def is_model_loaded() -> bool:
    return _model_loaded


def load_error() -> str | None:
    return _load_error


def get_model() -> Any | None:
    return _model


def try_load_model() -> None:
    global _model, _model_loaded, _load_error

    path = Path(settings.model_path)
    if not path.is_absolute():
        # Resolve relative to ai-service root (stable regardless of shell cwd).
        path = (Path(__file__).resolve().parents[2] / path).resolve()
    if not path.is_file():
        _model = None
        _model_loaded = False
        _load_error = f"Weights not found at {path}"
        logger.info("AI stub mode: %s", _load_error)
        return

    try:
        from ultralytics import YOLO  # type: ignore

        _model = YOLO(str(path))
        _model_loaded = True
        _load_error = None
        logger.info("Loaded YOLO weights from %s on %s", path, settings.device)
    except Exception as exc:  # noqa: BLE001 — keep service up in stub mode
        _model = None
        _model_loaded = False
        _load_error = str(exc)
        logger.warning("Failed to load YOLO model, using stub: %s", exc)
