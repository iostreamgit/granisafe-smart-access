"""Tests for torso crop geometry."""

import pytest

pytest.importorskip("PIL")
from PIL import Image

from app.services.torso_crop import crop_torso, crop_torso_from_pixels


def test_crop_torso_from_normalized_bbox():
    image = Image.new("RGB", (200, 400), color=(128, 128, 128))
    # Person centered, full height
    bbox = [0.5, 0.5, 0.4, 0.8]
    crop = crop_torso(image, bbox)
    assert crop is not None
    assert crop.width > 0
    assert crop.height > 0
    assert crop.height < image.height


def test_crop_torso_rejects_invalid_bbox():
    image = Image.new("RGB", (100, 100), color=(0, 0, 0))
    assert crop_torso(image, [0.5, 0.5, 0, 0.5]) is None
    assert crop_torso(image, []) is None


def test_crop_torso_from_pixels():
    image = Image.new("RGB", (300, 600), color=(64, 64, 64))
    crop = crop_torso_from_pixels(image, (60, 40, 240, 560))
    assert crop is not None
    assert crop.width >= 8
    assert crop.height >= 8
