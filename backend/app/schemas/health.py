from pydantic import BaseModel
from typing import Dict, Any

class HealthResponse(BaseModel):
    status: str
    app: str
    version: str
    environment: str
    max_video_duration_minutes: int
    system_checks: Dict[str, Any]

