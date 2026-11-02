import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class ScriptRevision(Base):
    __tablename__ = "script_revisions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    revision_number = Column(Integer, default=1, nullable=False)
    
    title_hook = Column(String(255), nullable=True)
    full_script = Column(Text, nullable=False)
    conclusion = Column(Text, nullable=True)
    research_sources = Column(JSON, nullable=True) # URLs, evidence notes, fact-check tags
    created_at = Column(DateTime(timezone=True), default=utc_now)

    project = relationship("Project", back_populates="script_revisions")
    scenes = relationship("Scene", back_populates="script_revision", cascade="all, delete-orphan")

class Scene(Base):
    __tablename__ = "scenes"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    script_revision_id = Column(String(36), ForeignKey("script_revisions.id"), nullable=False, index=True)
    
    scene_order = Column(Integer, nullable=False)
    scene_id_str = Column(String(50), nullable=False) # e.g. "scene_01"
    scene_title = Column(String(255), nullable=True)
    purpose = Column(Text, nullable=True)
    narration_text = Column(Text, nullable=False)
    estimated_duration_seconds = Column(Float, nullable=True)
    actual_audio_duration_seconds = Column(Float, nullable=True)
    
    visual_description = Column(Text, nullable=True)
    preferred_visual_type = Column(String(50), default="stock_footage") # stock, ai_image, diagram, user_upload
    stock_keywords = Column(JSON, nullable=True) # list of search terms
    image_prompt = Column(Text, nullable=True)
    on_screen_text = Column(String(255), nullable=True)
    transition_preference = Column(String(50), default="fade")

    script_revision = relationship("ScriptRevision", back_populates="scenes")
    assets = relationship("SceneAsset", back_populates="scene", cascade="all, delete-orphan")
    audio = relationship("AudioAsset", back_populates="scene", uselist=False, cascade="all, delete-orphan")

class SceneAsset(Base):
    __tablename__ = "scene_assets"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    scene_id = Column(String(36), ForeignKey("scenes.id"), nullable=False, index=True)
    
    asset_type = Column(String(50), nullable=False) # stock_video, ai_image, template, user_upload
    source_provider = Column(String(50), nullable=True) # pexels, dalle, etc.
    source_url = Column(Text, nullable=True)
    file_path = Column(String(500), nullable=False) # relative path in workspace_data
    attribution = Column(String(255), nullable=True)
    license_notes = Column(String(255), nullable=True)
    duration_seconds = Column(Float, nullable=True)

    scene = relationship("Scene", back_populates="assets")

class AudioAsset(Base):
    __tablename__ = "audio_assets"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    scene_id = Column(String(36), ForeignKey("scenes.id"), nullable=False, unique=True)
    
    voice_preset = Column(String(50), nullable=False) # deep_male_cinematic, natural_male
    file_path = Column(String(500), nullable=False) # relative path
    duration_seconds = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    scene = relationship("Scene", back_populates="audio")

class GenerationJob(Base):
    __tablename__ = "generation_jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    
    job_type = Column(String(50), nullable=False) # script_generation, voice_generation, rendering, modification
    status = Column(String(50), default="queued", nullable=False) # queued, running, completed, failed, cancelled
    progress_percent = Column(Integer, default=0, nullable=False)
    log_messages = Column(JSON, nullable=True)
    error_details = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    project = relationship("Project", back_populates="generation_jobs")
