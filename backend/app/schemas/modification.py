from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.video import VideoVersionResponse
from app.schemas.qc import QualityCheckResponse

class SceneModificationDelta(BaseModel):
    scene_order: int = Field(description="The 1-based order number of the scene to modify")
    scene_id_str: str = Field(description="Scene identifier e.g. 'scene_03'")
    updated_scene_title: Optional[str] = Field(None, description="Updated title or null if unchanged")
    updated_narration_text: Optional[str] = Field(None, description="Updated voiceover text or null if unchanged")
    updated_visual_description: Optional[str] = Field(None, description="Updated visual direction or null if unchanged")
    updated_stock_keywords: Optional[List[str]] = Field(None, description="Updated search keywords or null if unchanged")
    updated_on_screen_text: Optional[str] = Field(None, description="Updated on-screen text/title card or null if unchanged")
    change_summary: str = Field(description="Brief explanation of changes made to this scene")

class DocumentaryModificationPlan(BaseModel):
    affected_scene_orders: List[int] = Field(description="List of scene orders being changed, e.g. [3]")
    plan_summary: str = Field(description="Short human-readable summary of the modification plan")
    scene_modifications: List[SceneModificationDelta] = Field(description="Targeted modifications for affected scenes")

class ModificationRequest(BaseModel):
    prompt: str = Field(min_length=3, description="Natural language modification instruction from creator")
    auto_rerender: bool = Field(default=True, description="Whether to immediately compile revised video as new version")

class ModificationResponse(BaseModel):
    status: str
    project_id: str
    plan_summary: str
    affected_scenes: List[int]
    re_rendered: bool
    new_video_version: Optional[VideoVersionResponse] = None
    quality_check: Optional[QualityCheckResponse] = None
    message: str

