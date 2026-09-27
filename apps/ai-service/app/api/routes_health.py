from fastapi import APIRouter

from app.core.config import settings
from app.services.model_loader import is_model_loaded, load_error
from app.services.vest_classifier_loader import is_classifier_loaded, load_error as vest_load_error

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": settings.app_name,
    }


@router.get("/ready")
def ready() -> dict[str, object]:
    loaded = is_model_loaded()
    vest_loaded = is_classifier_loaded()
    return {
        "status": "ready",
        "service": settings.app_name,
        "modelLoaded": loaded,
        "modelVersion": settings.model_version,
        "device": settings.device,
        "mode": "model" if loaded else "stub",
        "note": None if loaded else (load_error() or "Stub detections (no weights)"),
        "vestClassifierEnabled": settings.vest_classifier_enabled,
        "vestClassifierLoaded": vest_loaded,
        "vestClassifierNote": None if vest_loaded or not settings.vest_classifier_enabled else vest_load_error(),
    }


@router.get("/v1/health")
def health_v1() -> dict[str, object]:
    """Alias expected by API design docs."""
    return {
        **health(),
        "modelLoaded": is_model_loaded(),
        "modelVersion": settings.model_version,
    }
