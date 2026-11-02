import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class VideoVersion(Base):
    __tablename__ = "video_versions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    version_number = Column(Integer, default=1, nullable=False)
    
    file_path = Column(String(500), nullable=False) # relative path to MP4
    file_checksum = Column(String(64), nullable=False, index=True) # SHA-256 Checksum
    duration_seconds = Column(Float, nullable=False)
    resolution = Column(String(20), default="1080p", nullable=False)
    render_settings = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=utc_now)

    project = relationship("Project", back_populates="video_versions")
    quality_check = relationship("QualityCheck", back_populates="video_version", uselist=False, cascade="all, delete-orphan")
    approvals = relationship("VideoApproval", back_populates="video_version", cascade="all, delete-orphan")

class QualityCheck(Base):
    __tablename__ = "quality_checks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    video_version_id = Column(String(36), ForeignKey("video_versions.id"), nullable=False, unique=True)
    
    passed = Column(Boolean, default=False, nullable=False)
    check_results = Column(JSON, nullable=False) # audio_detected, black_gap_free, duration_tolerance, etc.
    warnings = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    video_version = relationship("VideoVersion", back_populates="quality_check")

class VideoApproval(Base):
    """
    Mandatory Approval Record.
    Must tie to the EXACT video_version_id and SHA-256 file_checksum.
    If video is re-rendered or modified, previous approval record becomes invalid/revoked.
    """
    __tablename__ = "video_approvals"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    video_version_id = Column(String(36), ForeignKey("video_versions.id"), nullable=False, index=True)
    file_checksum = Column(String(64), nullable=False)
    
    user_id = Column(String(36), nullable=True) # approving user
    upload_settings = Column(JSON, nullable=False) # snapshot of title, description, tags, privacy
    approved_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    
    is_revoked = Column(Boolean, default=False, nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    revocation_reason = Column(String(255), nullable=True)

    video_version = relationship("VideoVersion", back_populates="approvals")

class YouTubeAccount(Base):
    __tablename__ = "youtube_accounts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), nullable=True, index=True)
    channel_id = Column(String(100), nullable=False)
    channel_title = Column(String(255), nullable=False)
    
    # Stored encrypted / secured
    encrypted_token = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

class YouTubeUpload(Base):
    __tablename__ = "youtube_uploads"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    video_version_id = Column(String(36), ForeignKey("video_versions.id"), nullable=False)
    approval_id = Column(String(36), ForeignKey("video_approvals.id"), nullable=False)
    
    youtube_video_id = Column(String(100), nullable=True)
    youtube_url = Column(String(255), nullable=True)
    status = Column(String(50), default="uploading", nullable=False) # uploading, published, failed
    upload_metadata = Column(JSON, nullable=False)
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=utc_now)

