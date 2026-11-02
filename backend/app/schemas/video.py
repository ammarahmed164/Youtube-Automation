from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class VideoVersionResponse(BaseModel):
    id: str
    project_id: str
    version_number: int
    file_path: str
    file_checksum: str = Field(description="SHA-256 Checksum for immutable approval verification")
    duration_seconds: float
    resolution: str = "1080p"
    render_settings: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}

class RenderJobStatusResponse(BaseModel):
    job_id: str
    project_id: str
    status: str = Field(description="'queued', 'running', 'completed', or 'failed'")
    progress_percent: int = Field(ge=0, le=100)
    log_messages: Optional[List[str]] = None
    error_details: Optional[str] = None
    video_version: Optional[VideoVersionResponse] = None

    model_config = {"from_attributes": True}

