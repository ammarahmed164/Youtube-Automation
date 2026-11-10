from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base Directory: root of the project
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI YouTube Documentary Studio"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Environment
    ENVIRONMENT: str = "development"
    APP_DEBUG: bool = True
    
    # CORS Origins (allow local Next.js frontend by default)
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    
    # Media Storage Workspace Directory
    WORKSPACE_DATA_DIR: Path = BASE_DIR / "workspace_data"
    
    # Database Settings (Supabase / PostgreSQL)
    DATABASE_URL: str = ""
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    
    # AI Providers (Multi-key pool support)
    GEMINI_API_KEY: str = ""
    GEMINI_API_KEYS: str = ""

    def get_gemini_keys(self) -> List[str]:
        keys = []
        if self.GEMINI_API_KEYS:
            keys.extend([k.strip() for k in self.GEMINI_API_KEYS.split(",") if k.strip()])
        elif self.GEMINI_API_KEY:
            keys.append(self.GEMINI_API_KEY.strip())
        return keys
    
    # Visual Assets
    PEXELS_API_KEY: str = ""
    
    # Audio & Rendering
    PIPER_BIN_PATH: str = "piper"
    FFMPEG_BIN_PATH: str = "ffmpeg"

    def get_ffmpeg_path(self) -> str:
        """Returns the resolved path to FFmpeg executable (system or bundled imageio_ffmpeg binary)."""
        if self.FFMPEG_BIN_PATH and self.FFMPEG_BIN_PATH != "ffmpeg":
            if Path(self.FFMPEG_BIN_PATH).exists():
                return self.FFMPEG_BIN_PATH
        try:
            import imageio_ffmpeg
            return imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            return self.FFMPEG_BIN_PATH or "ffmpeg"
    
    # YouTube OAuth
    YOUTUBE_CLIENT_ID: str = ""
    YOUTUBE_CLIENT_SECRET: str = ""
    YOUTUBE_REDIRECT_URI: str = "http://localhost:8000/api/v1/youtube/callback"

    # Strict Product Constraints
    MAX_VIDEO_DURATION_MINUTES: int = 20

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / "backend" / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Ensure workspace data directory exists
settings.WORKSPACE_DATA_DIR.mkdir(parents=True, exist_ok=True)
