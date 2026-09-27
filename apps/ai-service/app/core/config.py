from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_AI_DIR = Path(__file__).resolve().parents[2]
_REPO_DIR = _AI_DIR.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(_REPO_DIR / ".env"), str(_AI_DIR / ".env")),
        extra="ignore",
    )

    app_name: str = "granisafe-ai-service"
    ai_api_key: str = "dev-ai-key-change-me"
    model_path: str = "./models/ppe-yolo.pt"
    model_version: str = "phase6-stub"
    device: str = "cpu"

    # Stage-2 vest classifier (torso crop → vest_worn / no_vest)
    vest_classifier_enabled: bool = False
    vest_classifier_path: str = "./models/vest-classifier.pt"
    vest_classifier_min_confidence: float = 0.75
    vest_temporal_window: int = 5
    vest_temporal_session_ttl_sec: float = 120.0
    vest_feedback_enabled: bool = True
    vest_mistakes_dir: str = "./datasets/vest-classifier/mistakes"


settings = Settings()
