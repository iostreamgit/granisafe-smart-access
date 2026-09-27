from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.detector import run_detect
from app.services.quality_gate import QualityFail, check_image_base64

router = APIRouter(prefix="/v1", tags=["detect"])


class DetectRequest(BaseModel):
    request_id: str = Field(alias="requestId")
    image_base64: str = Field(alias="imageBase64")
    classes: list[str] = Field(default_factory=lambda: ["helmet", "safety_vest", "uniform"])
    session_id: str | None = Field(default=None, alias="sessionId")

    model_config = {"populate_by_name": True}


class Detection(BaseModel):
    class_name: str = Field(alias="class")
    confidence: float
    bbox: list[float] | None = None

    model_config = {"populate_by_name": True}


class DetectResponse(BaseModel):
    request_id: str = Field(alias="requestId")
    inference_ms: int = Field(alias="inferenceMs")
    detections: list[Detection]
    stub: bool = True

    model_config = {"populate_by_name": True}


@router.post("/detect", response_model=DetectResponse)
def detect(
    body: DetectRequest,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    x_mock_scenario: str | None = Header(default=None, alias="X-Mock-Scenario"),
) -> DetectResponse:
    if x_api_key != settings.ai_api_key:
        raise HTTPException(status_code=401, detail="Invalid AI API key")

    quality = check_image_base64(body.image_base64)
    if isinstance(quality, QualityFail):
        raise HTTPException(
            status_code=422,
            detail={"code": quality.code, "message": quality.message},
        )

    try:
        detections, inference_ms, stub = run_detect(
            quality=quality,
            classes=body.classes,
            scenario=x_mock_scenario,
            session_id=body.session_id or body.request_id,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=500,
            detail={"code": "AI_ERROR", "message": str(exc)},
        ) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500,
            detail={"code": "AI_ERROR", "message": f"Inference failed: {exc}"},
        ) from exc

    return DetectResponse(
        request_id=body.request_id,
        inference_ms=inference_ms,
        detections=[
            Detection(
                class_name=item["class"],
                confidence=float(item["confidence"]),
                bbox=item.get("bbox"),
            )
            for item in detections
        ],
        stub=stub,
    )
