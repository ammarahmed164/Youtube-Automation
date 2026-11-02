import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")

class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    topic = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    
    # State Machine: draft, script_generating, script_review, assets_preparing,
    # voice_generating, rendering, quality_check, awaiting_review, modification_requested,
    # modifying, rendering_revision, approved_for_upload, uploading, uploaded, generation_failed, upload_failed, cancelled
    status = Column(String(50), default="draft", nullable=False, index=True)
    
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    owner = relationship("User", back_populates="projects")
    settings = relationship("ProjectSetting", back_populates="project", uselist=False, cascade="all, delete-orphan")
    script_revisions = relationship("ScriptRevision", back_populates="project", cascade="all, delete-orphan")
    generation_jobs = relationship("GenerationJob", back_populates="project", cascade="all, delete-orphan")
    video_versions = relationship("VideoVersion", back_populates="project", cascade="all, delete-orphan")
    activities = relationship("ProjectActivity", back_populates="project", cascade="all, delete-orphan")

class ProjectSetting(Base):
    __tablename__ = "project_settings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id"), unique=True, nullable=False)
    
    target_duration_minutes = Column(Integer, default=10, nullable=False)
    language = Column(String(50), default="English", nullable=False)
    tone = Column(String(50), default="documentary", nullable=False)
    audience_level = Column(String(50), default="general", nullable=False)
    narration_preset = Column(String(50), default="deep_male_cinematic", nullable=False)
    scene_planning_mode = Column(String(50), default="automatic", nullable=False) # automatic or manual
    desired_scene_count = Column(Integer, nullable=True)
    aspect_ratio = Column(String(20), default="16:9", nullable=False)
    resolution = Column(String(20), default="1080p", nullable=False)
    visual_strategy = Column(String(50), default="hybrid", nullable=False)

    project = relationship("Project", back_populates="settings")

class ProjectActivity(Base):
    __tablename__ = "project_activity"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    action_type = Column(String(100), nullable=False)
    actor = Column(String(50), default="user", nullable=False) # user or ai_agent
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    project = relationship("Project", back_populates="activities")

