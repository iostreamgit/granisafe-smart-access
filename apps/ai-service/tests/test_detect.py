import base64
import struct
import zlib

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
API_KEY = "dev-ai-key-change-me"


def _minimal_png(width: int = 64, height: int = 64, shade: int = 120) -> str:
    """Build a tiny valid grayscale PNG without Pillow."""

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + bytes([shade]) * width for _ in range(height))
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")
    return base64.b64encode(png).decode("ascii")


def test_detect_requires_api_key():
    response = client.post(
        "/v1/detect",
        json={"requestId": "r1", "imageBase64": _minimal_png()},
    )
    assert response.status_code == 401


def test_detect_all_ok_scenario():
    response = client.post(
        "/v1/detect",
        headers={"X-API-Key": API_KEY, "X-Mock-Scenario": "ALL_OK"},
        json={"requestId": "r2", "imageBase64": _minimal_png()},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["stub"] is True
    assert len(body["detections"]) == 3
    assert all(d["confidence"] >= 0.9 for d in body["detections"])


def test_detect_camera_mode_fail_closed_without_scenario():
    response = client.post(
        "/v1/detect",
        headers={"X-API-Key": API_KEY},
        json={"requestId": "r2b", "imageBase64": _minimal_png()},
    )
    assert response.status_code == 200
    body = response.json()
    assert all(d["confidence"] < 0.5 for d in body["detections"])


def test_detect_missing_helmet():
    response = client.post(
        "/v1/detect",
        headers={"X-API-Key": API_KEY, "X-Mock-Scenario": "MISSING_HELMET"},
        json={"requestId": "r3", "imageBase64": _minimal_png()},
    )
    assert response.status_code == 200
    helmet = next(d for d in response.json()["detections"] if d["class"] == "helmet")
    assert helmet["confidence"] < 0.5


def test_detect_ai_error_scenario():
    response = client.post(
        "/v1/detect",
        headers={"X-API-Key": API_KEY, "X-Mock-Scenario": "AI_ERROR"},
        json={"requestId": "r4", "imageBase64": _minimal_png()},
    )
    assert response.status_code == 500
    assert response.json()["detail"]["code"] == "AI_ERROR"


def test_detect_accepts_api_stub_frame():
    stub = base64.b64encode(b"phase5-stub-frame").decode("ascii")
    response = client.post(
        "/v1/detect",
        headers={"X-API-Key": API_KEY, "X-Mock-Scenario": "ALL_OK"},
        json={"requestId": "r5", "imageBase64": stub},
    )
    assert response.status_code == 200
