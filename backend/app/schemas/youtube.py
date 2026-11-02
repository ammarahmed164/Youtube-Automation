from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.approval import UploadMetadataSettings

class YouTubeAccountResponse(BaseModel):
    id: str
    channel_id: str
    channel_title: str
    connected: bool
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

class YouTubePublishRequest(BaseModel):
    video_version_id: str = Field(description="Exact video version ID to publish")
    approval_id: str = Field(description="Active, unrevoked VideoApproval ID")
    expected_checksum: str = Field(description="SHA-256 Checksum for double verification")

class YouTubePublishResponse(BaseModel):
    id: str
    project_id: str
    video_version_id: str
    approval_id: str
    youtube_video_id: Optional[str] = None
    youtube_url: Optional[str] = None
    status: str = Field(description="'uploading', 'published', or 'failed'")
    upload_metadata: Dict[str, Any]
    error_message: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}

class YouTubeAuthUrlResponse(BaseModel):
    authorization_url: str
    redirect_uri: str
    configured: bool
    message: str
