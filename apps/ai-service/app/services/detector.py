"""Detection orchestration: real model when loaded, otherwise scenario stub."""

from __future__ import annotations

import time
from typing import Any

from app.core.config import settings
from app.services.label_adapter import CANONICAL, to_canonical
from app.services.model_loader import get_model, is_model_loaded
from app.services.quality_gate import QualityOk
from app.services.torso_crop import crop_torso
from app.services.vest_classifier import classify_torso, vest_confidence_for_detection
from app.services.vest_classifier_loader import NO_VEST, is_classifier_loaded
from app.services.vest_feedback import save_mistake
from app.services.vest_temporal import record_prediction


def run_detect(
    *,
    quality: QualityOk,
    classes: list[str],
    scenario: str | None,
    session_id: str | None = None,
) -> tuple[list[dict[str, Any]], int, bool]:
    """Returns (detections, inference_ms, stub)."""
    if scenario and scenario.upper() == "AI_ERROR":
        raise RuntimeError("Forced AI_ERROR scenario")

    if is_model_loaded():
        return _infer_model(raw_bytes=quality.raw_bytes, classes=classes, session_id=session_id)

    start = time.perf_counter()
    detections = _stub_detections(scenario=scenario)
    ms = int((time.perf_counter() - start) * 1000)
    return detections, ms, True


def _infer_model(
    *,
    raw_bytes: bytes,
    classes: list[str],
    session_id: str | None = None,
) -> tuple[list[dict[str, Any]], int, bool]:
    model = get_model()
    assert model is not None
    try:
        from io import BytesIO

        from PIL import Image
    except ImportError as exc:
        raise RuntimeError("Pillow required for YOLO inference") from exc

    image = Image.open(BytesIO(raw_bytes)).convert("RGB")
    start = time.perf_counter()
    results = model.predict(image, device=settings.device, verbose=False)
    ms = int((time.perf_counter() - start) * 1000)

    wanted = {c.lower() for c in classes} or set(CANONICAL)
    detections: list[dict[str, Any]] = []
    best_person_bbox: list[float] | None = None
    best_person_conf = 0.0
    yolo_vest_conf = 0.0
    yolo_vest_bbox: list[float] | None = None

    for result in results:
        names = result.names or {}
        boxes = result.boxes
        if boxes is None:
            continue
        for box in boxes:
            cls_id = int(box.cls.item()) if hasattr(box.cls, "item") else int(box.cls)
            raw_name = str(names.get(cls_id, cls_id))
            canonical = to_canonical(raw_name)
            conf = float(box.conf.item()) if hasattr(box.conf, "item") else float(box.conf)
            xywhn = box.xywhn[0].tolist() if hasattr(box, "xywhn") else [0, 0, 0, 0]
            bbox = [float(x) for x in xywhn[:4]]

            # Track person proxy (uniform) for stage-2 torso crop.
            raw_key = raw_name.strip().lower().replace("-", "_").replace(" ", "_")
            if raw_key == "person" and conf > best_person_conf:
                best_person_conf = conf
                best_person_bbox = bbox

            if canonical == "safety_vest" and conf > yolo_vest_conf:
                yolo_vest_conf = conf
                yolo_vest_bbox = bbox

            if not canonical or canonical not in wanted:
                continue
            detections.append(
                {
                    "class": canonical,
                    "confidence": conf,
                    "bbox": bbox,
                }
            )

    if "safety_vest" in wanted and is_classifier_loaded():
        detections = _apply_vest_classifier(
            image=image,
            detections=detections,
            person_bbox=best_person_bbox,
            yolo_vest_conf=yolo_vest_conf,
            yolo_vest_bbox=yolo_vest_bbox,
            session_id=session_id,
        )

    return detections, ms, False


def _apply_vest_classifier(
    *,
    image: Any,
    detections: list[dict[str, Any]],
    person_bbox: list[float] | None,
    yolo_vest_conf: float,
    yolo_vest_bbox: list[float] | None,
    session_id: str | None,
) -> list[dict[str, Any]]:
    """Replace YOLO vest detection with stage-2 torso classifier when available."""
    if person_bbox is None:
        return detections

    torso = crop_torso(image, person_bbox)
    if torso is None:
        return detections

    classification = classify_torso(torso)
    if classification is None:
        return detections

    if session_id:
        classification = record_prediction(session_id, classification)

    vest_conf = vest_confidence_for_detection(classification)
    yolo_vest_detected = yolo_vest_conf >= 0.5

    # Feedback: YOLO false positive (vest nearby but not worn)
    if classification.label == NO_VEST and yolo_vest_detected:
        save_mistake(
            torso_crop=torso,
            predicted_label=classification.label,
            yolo_vest_detected=True,
            session_id=session_id,
        )

    # Remove raw YOLO safety_vest entries — stage-2 is authoritative
    filtered = [d for d in detections if d["class"] != "safety_vest"]

    if classification.vest_worn and vest_conf >= settings.vest_classifier_min_confidence:
        filtered.append(
            {
                "class": "safety_vest",
                "confidence": vest_conf,
                "bbox": person_bbox,
            }
        )
    else:
        # Fail-closed: report low confidence so policy denies
        filtered.append(
            {
                "class": "safety_vest",
                "confidence": min(vest_conf, 0.35),
                "bbox": yolo_vest_bbox,
            }
        )

    return filtered


def _stub_detections(*, scenario: str | None) -> list[dict[str, Any]]:
    """
    Explicit X-Mock-Scenario drives demos.
    No scenario (camera mode without YOLO) → fail-closed: report no PPE.
    """
    key = (scenario or "NONE").upper().strip()
    missing: set[str] = set()
    if key in ("", "NONE", "CAMERA", "FAIL_CLOSED"):
        missing.update(CANONICAL)
    elif key == "ALL_OK":
        missing.clear()
    elif key == "MISSING_HELMET":
        missing.add("helmet")
    elif key == "MISSING_VEST":
        missing.add("safety_vest")
    elif key == "MISSING_UNIFORM":
        missing.add("uniform")
    else:
        # Unknown scenario → fail closed
        missing.update(CANONICAL)

    detections: list[dict[str, Any]] = []
    for class_name in CANONICAL:
        is_missing = class_name in missing
        detections.append(
            {
                "class": class_name,
                "confidence": 0.22 if is_missing else 0.91,
                "bbox": None if is_missing else [0.1, 0.1, 0.3, 0.3],
            }
        )
    return detections
