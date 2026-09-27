"""Crop upper-body / torso region from a person bounding box."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from PIL import Image

# Normalized bbox is [x_center, y_center, width, height] in 0..1.
# Torso = upper portion of person box — shoulders to waist, not legs/hands.
TORSO_TOP_FRAC = 0.05
TORSO_BOTTOM_FRAC = 0.58
TORSO_HORIZONTAL_SHRINK = 0.08


def crop_torso(
    image: Image.Image,
    bbox_xywhn: list[float],
    *,
    top_frac: float = TORSO_TOP_FRAC,
    bottom_frac: float = TORSO_BOTTOM_FRAC,
    horizontal_shrink: float = TORSO_HORIZONTAL_SHRINK,
) -> Image.Image | None:
    """
    Extract torso crop from a normalized person bbox.

    Returns None if bbox is invalid or crop would be empty.
    """
    if len(bbox_xywhn) < 4:
        return None

    cx, cy, w, h = (float(v) for v in bbox_xywhn[:4])
    if w <= 0 or h <= 0:
        return None

    x1 = cx - w / 2
    y1 = cy - h / 2
    x2 = cx + w / 2
    y2 = cy + h / 2

    person_h = y2 - y1
    torso_y1 = y1 + person_h * top_frac
    torso_y2 = y1 + person_h * bottom_frac

    person_w = x2 - x1
    shrink = person_w * horizontal_shrink
    torso_x1 = x1 + shrink
    torso_x2 = x2 - shrink

    if torso_x2 <= torso_x1 or torso_y2 <= torso_y1:
        return None

    img_w, img_h = image.size
    px1 = max(0, int(torso_x1 * img_w))
    py1 = max(0, int(torso_y1 * img_h))
    px2 = min(img_w, int(torso_x2 * img_w))
    py2 = min(img_h, int(torso_y2 * img_h))

    if px2 - px1 < 8 or py2 - py1 < 8:
        return None

    return image.crop((px1, py1, px2, py2))


def crop_torso_from_pixels(
    image: Image.Image,
    bbox_xyxy: tuple[int, int, int, int],
    *,
    top_frac: float = TORSO_TOP_FRAC,
    bottom_frac: float = TORSO_BOTTOM_FRAC,
    horizontal_shrink: float = TORSO_HORIZONTAL_SHRINK,
) -> Image.Image | None:
    """Pixel-space variant used by offline crop scripts."""
    x1, y1, x2, y2 = bbox_xyxy
    w = x2 - x1
    h = y2 - y1
    if w <= 0 or h <= 0:
        return None

    torso_y1 = y1 + h * top_frac
    torso_y2 = y1 + h * bottom_frac
    shrink = w * horizontal_shrink
    torso_x1 = x1 + shrink
    torso_x2 = x2 - shrink

    img_w, img_h = image.size
    px1 = max(0, int(torso_x1))
    py1 = max(0, int(torso_y1))
    px2 = min(img_w, int(torso_x2))
    py2 = min(img_h, int(torso_y2))

    if px2 - px1 < 8 or py2 - py1 < 8:
        return None

    return image.crop((px1, py1, px2, py2))
