"""Stage-2 vest classifier inference on torso crops."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from app.core.config import settings
from app.services.vest_classifier_loader import (
    NO_VEST,
    VEST_WORN,
    get_classifier,
    is_classifier_loaded,
)

if TYPE_CHECKING:
    from PIL import Image


@dataclass(frozen=True)
class VestClassification:
    label: str
    confidence: float
    vest_worn: bool
    probs: dict[str, float]


def classify_torso(image: Image.Image) -> VestClassification | None:
    """
    Run YOLO classify on a torso crop.

    Returns None if classifier is not loaded or inference fails.
    """
    if not is_classifier_loaded():
        return None

    model = get_classifier()
    assert model is not None

    try:
        results = model.predict(
            image,
            device=settings.device,
            verbose=False,
        )
    except Exception:
        return None

    return _parse_results(results)


def _parse_results(results: Any) -> VestClassification | None:
    if not results:
        return None

    result = results[0]
    probs_obj = getattr(result, "probs", None)
    if probs_obj is None:
        return None

    names: dict[int, str] = {}
    if hasattr(result, "names") and result.names:
        names = {int(k): str(v) for k, v in result.names.items()}

    top1 = int(probs_obj.top1)
    top1_conf = float(probs_obj.top1conf.item()) if hasattr(probs_obj.top1conf, "item") else float(probs_obj.top1conf)
    raw_label = names.get(top1, str(top1)).strip().lower().replace("-", "_").replace(" ", "_")

    label = _normalize_label(raw_label)
    probs: dict[str, float] = {}
    data = probs_obj.data
    if hasattr(data, "tolist"):
        data_list = data.tolist()
    else:
        data_list = list(data)

    for idx, score in enumerate(data_list):
        class_name = _normalize_label(names.get(idx, str(idx)))
        probs[class_name] = float(score)

    return VestClassification(
        label=label,
        confidence=top1_conf,
        vest_worn=label == VEST_WORN,
        probs=probs,
    )


def _normalize_label(raw: str) -> str:
    key = raw.strip().lower().replace("-", "_").replace(" ", "_")
    if key in (VEST_WORN, "worn", "vest_on", "wearing_vest"):
        return VEST_WORN
    if key in (NO_VEST, "no_vest", "not_worn", "without_vest", "none"):
        return NO_VEST
    return key


def vest_confidence_for_detection(classification: VestClassification) -> float:
    """Map classifier output to safety_vest wire confidence."""
    if classification.vest_worn:
        return classification.confidence
    # no_vest — use inverse confidence so policy gate fails
    return max(0.0, 1.0 - classification.confidence)
