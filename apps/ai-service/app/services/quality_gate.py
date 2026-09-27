"""Pre-inference image quality checks (stdlib; Pillow optional)."""

from __future__ import annotations

import base64
import binascii
import struct
from dataclasses import dataclass


@dataclass
class QualityOk:
    raw_bytes: bytes
    width: int | None = None
    height: int | None = None


@dataclass
class QualityFail:
    code: str
    message: str


def check_image_base64(image_base64: str) -> QualityOk | QualityFail:
    if not image_base64 or not image_base64.strip():
        return QualityFail("POOR_IMAGE_QUALITY", "Empty image payload")

    payload = image_base64.strip()
    if "," in payload and payload.lower().startswith("data:"):
        payload = payload.split(",", 1)[1]

    try:
        raw = base64.b64decode(payload, validate=False)
    except (binascii.Error, ValueError):
        return QualityFail("POOR_IMAGE_QUALITY", "Image is not valid base64")

    size = len(raw)
    if size < 16:
        return QualityFail("POOR_IMAGE_QUALITY", "Image too small")
    if size > 5 * 1024 * 1024:
        return QualityFail("POOR_IMAGE_QUALITY", "Image exceeds 5MB")

    # Demo stub from Nest when no camera frame was uploaded.
    if raw == b"phase5-stub-frame":
        return QualityOk(raw_bytes=raw, width=640, height=480)

    if raw.startswith(b"\x89PNG\r\n\x1a\n"):
        if len(raw) < 24:
            return QualityFail("POOR_IMAGE_QUALITY", "Corrupt PNG")
        width, height = struct.unpack(">II", raw[16:24])
        if width < 64 or height < 64:
            return QualityFail("POOR_IMAGE_QUALITY", "Resolution too low")
        return QualityOk(raw_bytes=raw, width=width, height=height)

    if raw.startswith(b"\xff\xd8\xff"):
        dims = _jpeg_size(raw)
        if dims and (dims[0] < 64 or dims[1] < 64):
            return QualityFail("POOR_IMAGE_QUALITY", "Resolution too low")
        return QualityOk(
            raw_bytes=raw,
            width=dims[0] if dims else None,
            height=dims[1] if dims else None,
        )

    # Unknown binary — allow for stub demos; real YOLO path will validate further.
    return QualityOk(raw_bytes=raw)


def _jpeg_size(data: bytes) -> tuple[int, int] | None:
    i = 2
    while i + 9 < len(data):
        if data[i] != 0xFF:
            break
        marker = data[i + 1]
        if marker in (0xC0, 0xC1, 0xC2):
            height, width = struct.unpack(">HH", data[i + 5 : i + 9])
            return width, height
        if marker == 0xD9:
            break
        length = struct.unpack(">H", data[i + 2 : i + 4])[0]
        i += 2 + length
    return None
