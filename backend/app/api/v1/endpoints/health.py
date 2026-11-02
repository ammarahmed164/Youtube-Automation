import shutil
import sys
from fastapi import APIRouter
from app.core.config import settings
from app.schemas.health import HealthResponse

router = APIRouter()

@router.get("/health", response_model=HealthResponse)
async def check_health() -> HealthResponse:
    """
    Health check endpoint returning system status and service readiness.
    """
    ffmpeg_installed = shutil.which(settings.FFMPEG_BIN_PATH) is not None
    workspace_accessible = settings.WORKSPACE_DATA_DIR.exists() and settings.WORKSPACE_DATA_DIR.is_dir()

    return HealthResponse(
        status="ok",
        app=settings.PROJECT_NAME,
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
        max_video_duration_minutes=settings.MAX_VIDEO_DURATION_MINUTES,
        system_checks={
            "python_version": sys.version.split()[0],
            "workspace_data_dir": str(settings.WORKSPACE_DATA_DIR),
            "workspace_accessible": workspace_accessible,
            "ffmpeg_available": ffmpeg_installed,
            "database_configured": bool(settings.DATABASE_URL),
            "gemini_configured": bool(settings.GEMINI_API_KEY),
            "youtube_configured": bool(settings.YOUTUBE_CLIENT_ID),
        }
    )

