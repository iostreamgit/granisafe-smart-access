"""Shared YOLO person detection + torso crop helpers for offline scripts."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from app.services.torso_crop import crop_torso_from_pixels

if TYPE_CHECKING:
    from PIL import Image


def is_person_label(name: str) -> bool:
    key = name.strip().lower().replace("-", "_").replace(" ", "_")
    return key in ("person", "worker", "human")


def extract_torso_crops(
    image: Image.Image,
    model: Any,
    *,
    device: str = "cpu",
    conf_threshold: float = 0.4,
) -> list[Image.Image]:
    """Run person detection and return torso crops (one per person box)."""
    results = model.predict(image, device=device, verbose=False)
    crops: list[Image.Image] = []

    for result in results:
        names = result.names or {}
        boxes = result.boxes
        if boxes is None:
            continue

        for box in boxes:
            cls_id = int(box.cls.item()) if hasattr(box.cls, "item") else int(box.cls)
            raw_name = str(names.get(cls_id, cls_id))
            if not is_person_label(raw_name):
                continue

            conf = float(box.conf.item()) if hasattr(box.conf, "item") else float(box.conf)
            if conf < conf_threshold:
                continue

            xyxy = box.xyxy[0].tolist()
            x1, y1, x2, y2 = (int(v) for v in xyxy)
            crop = crop_torso_from_pixels(image, (x1, y1, x2, y2))
            if crop is not None:
                crops.append(crop)

    return crops
