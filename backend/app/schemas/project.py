from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, field_validator

class ProjectSettingCreate(BaseModel):
    target_duration_minutes: int = Field(default=10, ge=1, le=20, description="Target duration in minutes (max 20)")
    language: str = Field(default="English")
    tone: str = Field(default="documentary")
    audience_level: str = Field(default="general")
    narration_preset: str = Field(default="deep_male_cinematic")
    scene_planning_mode: str = Field(default="automatic") # automatic | manual
    desired_scene_count: Optional[int] = None
    aspect_ratio: str = Field(default="16:9")
    resolution: str = Field(default="1080p")
    visual_strategy: str = Field(default="hybrid")

    @field_validator("target_duration_minutes")
    @classmethod
    def validate_duration(cls, v: int) -> int:
        if v > 20:
            raise ValueError("Maximum video duration allowed is 20 minutes.")
        if v < 1:
            raise ValueError("Video duration must be at least 1 minute.")
        return v

class ProjectCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Documentary title")
    topic: str = Field(..., min_length=3, description="Topic or subject of the documentary")
    description: Optional[str] = None
    settings: ProjectSettingCreate = Field(default_factory=ProjectSettingCreate)

class ProjectSettingUpdate(BaseModel):
    target_duration_minutes: Optional[int] = Field(None, ge=1, le=20, description="Target duration in minutes (max 20)")
    language: Optional[str] = None
    tone: Optional[str] = None
    audience_level: Optional[str] = None
    narration_preset: Optional[str] = None
    scene_planning_mode: Optional[str] = None
    desired_scene_count: Optional[int] = None
    aspect_ratio: Optional[str] = None
    resolution: Optional[str] = None
    visual_strategy: Optional[str] = None

class ProjectUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    topic: Optional[str] = Field(None, min_length=3)
    description: Optional[str] = None
    status: Optional[str] = None
    settings: Optional[ProjectSettingUpdate] = None

class ProjectSettingResponse(BaseModel):
    id: str
    target_duration_minutes: int
    language: str
    tone: str
    audience_level: str
    narration_preset: str
    scene_planning_mode: str
    desired_scene_count: Optional[int]
    aspect_ratio: str
    resolution: str
    visual_strategy: str

    model_config = {"from_attributes": True}

class ProjectResponse(BaseModel):
    id: str
    user_id: Optional[str]
    title: str
    topic: str
    description: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime
    settings: Optional[ProjectSettingResponse] = None

    model_config = {"from_attributes": True}

