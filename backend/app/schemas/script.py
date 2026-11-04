from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

class ResearchCitation(BaseModel):
    claim: str = Field(description="The specific factual claim or statement")
    source_note: str = Field(description="Evidence note or historical/scientific citation reference")
    verification_status: str = Field(default="verified", description="'verified', 'uncertain', or 'storytelling'")

class ScenePlanItem(BaseModel):
    scene_order: int = Field(description="Sequential order of the scene starting from 1")
    scene_id_str: str = Field(description="Stable scene ID, e.g. 'scene_01'")
    scene_title: str = Field(description="Short title summarizing the scene focus")
    purpose: str = Field(description="Narrative objective of the scene, e.g. 'Hook viewer with shocking fact'")
    narration_text: str = Field(description="Exact voiceover narration script for this scene")
    estimated_duration_seconds: float = Field(description="Estimated duration in seconds based on narration word count (~2.5 words/sec)")
    visual_description: str = Field(description="Detailed visual direction for footage selection or generation")
    preferred_visual_type: str = Field(default="stock_footage", description="'stock_footage', 'ai_image', 'diagram', or 'user_upload'")
    stock_keywords: List[str] = Field(default_factory=list, description="2-4 search keywords for finding relevant stock footage")
    image_prompt: Optional[str] = Field(None, description="Detailed prompt if AI image generation is needed")
    on_screen_text: Optional[str] = Field(None, description="Short on-screen text, title card, or key statistic")
    transition_preference: str = Field(default="fade", description="'fade', 'crossfade', 'cut', or 'zoom'")

class DocumentaryScriptPlan(BaseModel):
    title_hook: str = Field(description="Compelling, click-worthy but truthful documentary title and opening hook")
    narrative_outline: List[str] = Field(description="3-5 bullet point structural arc of the documentary")
    full_script: str = Field(description="Complete continuous narration text")
    conclusion: str = Field(description="Concluding takeaway or call-to-action")
    research_sources: List[ResearchCitation] = Field(default_factory=list, description="Verified facts and source citations")
    scenes: List[ScenePlanItem] = Field(description="Complete scene-by-scene structured plan")

class SceneAssetResponse(BaseModel):
    id: str
    asset_type: str
    source_provider: Optional[str] = None
    source_url: Optional[str] = None
    file_path: str
    attribution: Optional[str] = None
    license_notes: Optional[str] = None
    duration_seconds: Optional[float] = None

    model_config = {"from_attributes": True}

class SceneResponse(BaseModel):
    id: str
    scene_order: int
    scene_id_str: str
    scene_title: Optional[str]
    purpose: Optional[str]
    narration_text: str
    estimated_duration_seconds: Optional[float]
    actual_audio_duration_seconds: Optional[float]
    visual_description: Optional[str]
    preferred_visual_type: str
    stock_keywords: Optional[List[str]]
    image_prompt: Optional[str]
    on_screen_text: Optional[str]
    transition_preference: str
    assets: List[SceneAssetResponse] = []

    model_config = {"from_attributes": True}

class ScriptResponse(BaseModel):
    id: str
    project_id: str
    revision_number: int
    title_hook: Optional[str]
    full_script: str
    conclusion: Optional[str]
    research_sources: Optional[List[dict]]
    created_at: datetime
    scenes: List[SceneResponse] = []

    model_config = {"from_attributes": True}

class ScriptUpdateInput(BaseModel):
    title_hook: Optional[str] = None
    full_script: Optional[str] = None
    conclusion: Optional[str] = None

class SceneUpdateInput(BaseModel):
    scene_title: Optional[str] = None
    purpose: Optional[str] = None
    narration_text: Optional[str] = None
    visual_description: Optional[str] = None
    preferred_visual_type: Optional[str] = None
    stock_keywords: Optional[List[str]] = None
    on_screen_text: Optional[str] = None
    transition_preference: Optional[str] = None

