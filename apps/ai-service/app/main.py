from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes_detect import router as detect_router
from app.api.routes_health import router as health_router
from app.core.config import settings
from app.services.model_loader import try_load_model
from app.services.vest_classifier_loader import try_load_classifier


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try_load_model()
    try_load_classifier()
    yield


app = FastAPI(
    title="Granisafe AI PPE Service",
    version="0.6.0",
    description="Phase 6 PPE detection — YOLO when weights present, stub scenarios otherwise.",
    lifespan=lifespan,
)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": settings.app_name,
        "docs": "/docs",
        "phase": "6",
    }


app.include_router(health_router)
app.include_router(detect_router)
