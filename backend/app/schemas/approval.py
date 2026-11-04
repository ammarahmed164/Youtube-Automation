from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class UploadMetadataSettings(BaseModel):
    title: str = Field(min_length=3, max_length=100, description="YouTube Video Title")
    description: str = Field(default="", max_length=5000, description="Video Description with chapters & citations")
    tags: List[str] = Field(default_factory=list, description="Search and discovery tags")
    category_id: str = Field(default="28", description="YouTube Category ID (e.g. 28 = Science & Technology)")
    privacy_status: str = Field(default="private", description="'private', 'unlisted', or 'public'")
    notify_subscribers: bool = Field(default=False)

class VideoApprovalRequest(BaseModel):
    video_version_id: str = Field(description="Exact ID of the video version being approved")
    confirmed_checksum: str = Field(description="Confirmed SHA-256 Checksum matching the video file")
    upload_settings: UploadMetadataSettings = Field(description="Snapshot of YouTube metadata locked with this approval")
    user_confirmation_statement: str = Field(
        default="I have watched the complete video preview and explicitly authorize publishing this version to YouTube.",
        description="Explicit human confirmation statement"
    )

class RevokeApprovalRequest(BaseModel):
    video_version_id: str
    reason: str = Field(default="User requested changes or cancellation", description="Reason for revoking approval")

class VideoApprovalResponse(BaseModel):
    id: str
    project_id: str
    video_version_id: str
    file_checksum: str
    upload_settings: Dict[str, Any]
    approved_at: datetime
    is_revoked: bool
    revoked_at: Optional[datetime] = None
    revocation_reason: Optional[str] = None

    model_config = {"from_attributes": True}

