import os
import uuid
import hashlib
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.core.config import settings, BASE_DIR
from app.models.project import Project, ProjectActivity
from app.models.video import VideoVersion, VideoApproval, YouTubeUpload, QualityCheck

logger = logging.getLogger(__name__)

class ApprovalService:
    """
    Mandatory Human Approval Gate Service (Section 14 of Master Plan).
    Enforces that:
    1. AI and background workers can never publish without explicit user button confirmation.
    2. Approval is tied immutably to the exact VideoVersion and its SHA-256 checksum.
    3. Any file modification or new version automatically revokes previous approvals.
    4. Duplicate and in-progress uploads are strictly blocked.
    5. Direct API calls lacking a valid approval record are rejected with 403 Forbidden.
    """

    @classmethod
    def calculate_file_sha256(cls, filepath: Path) -> str:
        """Calculates real-time SHA-256 of video file on disk."""
        if not filepath.exists() or not filepath.is_file():
            raise FileNotFoundError(f"Video file not found at: {filepath}")
        sha256 = hashlib.sha256()
        with open(filepath, "rb") as f:
            while chunk := f.read(65536):
                sha256.update(chunk)
        return sha256.hexdigest()

    @classmethod
    def create_approval(
        cls,
        db: Session,
        project_id: str,
        video_version_id: str,
        confirmed_checksum: str,
        upload_settings: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> VideoApproval:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError(f"Project '{project_id}' not found.")

        video_version = (
            db.query(VideoVersion)
            .filter(VideoVersion.id == video_version_id, VideoVersion.project_id == project_id)
            .first()
        )
        if not video_version:
            raise ValueError(f"Video version '{video_version_id}' not found for project '{project_id}'.")

        # Verify physical file existence and SHA-256 integrity
        physical_path = BASE_DIR / video_version.file_path
        real_checksum = cls.calculate_file_sha256(physical_path)

        if real_checksum != video_version.file_checksum:
            raise ValueError(
                f"File integrity violation: Physical video SHA-256 ({real_checksum}) does not "
                f"match registered version checksum ({video_version.file_checksum})."
            )

        if confirmed_checksum.lower() != video_version.file_checksum.lower():
            raise ValueError(
                f"Confirmation mismatch: User confirmed checksum '{confirmed_checksum}' does not "
                f"match video checksum '{video_version.file_checksum}'."
            )

        # Invalidate / revoke any prior active approvals for this project (Rule 14)
        db.query(VideoApproval).filter(
            VideoApproval.project_id == project_id,
            VideoApproval.is_revoked == False
        ).update({
            "is_revoked": True,
            "revoked_at": datetime.now(timezone.utc),
            "revocation_reason": f"Superseded by approval for video version v{video_version.version_number}"
        })

        # Create durable approval record
        approval = VideoApproval(
            id=str(uuid.uuid4()),
            project_id=project_id,
            video_version_id=video_version_id,
            file_checksum=video_version.file_checksum,
            user_id=user_id,
            upload_settings=upload_settings,
            approved_at=datetime.now(timezone.utc),
            is_revoked=False
        )
        db.add(approval)

        # Update Project Status to approved_for_upload
        project.status = "approved_for_upload"

        # Record durable audit trail in ProjectActivity
        activity = ProjectActivity(
            id=str(uuid.uuid4()),
            project_id=project_id,
            action_type="video_approved",
            actor="user",
            details={
                "video_version_id": video_version_id,
                "version_number": video_version.version_number,
                "file_checksum": video_version.file_checksum,
                "upload_title": upload_settings.get("title"),
                "privacy_status": upload_settings.get("privacy_status")
            }
        )
        db.add(activity)

        db.commit()
        db.refresh(approval)
        logger.info(f"Video approval granted for project {project_id}, version v{video_version.version_number}")
        return approval

    @classmethod
    def revoke_approval(
        cls,
        db: Session,
        project_id: str,
        video_version_id: str,
        reason: str = "User revoked approval"
    ) -> VideoApproval:
        approval = (
            db.query(VideoApproval)
            .filter(
                VideoApproval.project_id == project_id,
                VideoApproval.video_version_id == video_version_id,
                VideoApproval.is_revoked == False
            )
            .first()
        )
        if not approval:
            raise ValueError(f"No active, unrevoked approval found for version '{video_version_id}'.")

        approval.is_revoked = True
        approval.revoked_at = datetime.now(timezone.utc)
        approval.revocation_reason = reason

        project = db.query(Project).filter(Project.id == project_id).first()
        if project and project.status == "approved_for_upload":
            project.status = "awaiting_review"

        activity = ProjectActivity(
            id=str(uuid.uuid4()),
            project_id=project_id,
            action_type="approval_revoked",
            actor="user",
            details={
                "video_version_id": video_version_id,
                "reason": reason
            }
        )
        db.add(activity)

        db.commit()
        db.refresh(approval)
        logger.info(f"Video approval revoked for project {project_id}, version {video_version_id}: {reason}")
        return approval

    @classmethod
    def get_active_approval(
        cls,
        db: Session,
        project_id: str,
        video_version_id: Optional[str] = None
    ) -> Optional[VideoApproval]:
        query = db.query(VideoApproval).filter(
            VideoApproval.project_id == project_id,
            VideoApproval.is_revoked == False
        )
        if video_version_id:
            query = query.filter(VideoApproval.video_version_id == video_version_id)
        return query.order_by(VideoApproval.approved_at.desc()).first()

    @classmethod
    def verify_approval_for_upload(
        cls,
        db: Session,
        project_id: str,
        video_version_id: str,
        approval_id: Optional[str] = None,
        expected_checksum: Optional[str] = None
    ) -> VideoApproval:
        """
        MANDATORY SECURITY GATE:
        Validates all constraints of Section 14 before any YouTube upload job is permitted.
        Raises PermissionError on ANY failure.
        """
        video_version = (
            db.query(VideoVersion)
            .filter(VideoVersion.id == video_version_id, VideoVersion.project_id == project_id)
            .first()
        )
        if not video_version:
            raise PermissionError(f"Video version '{video_version_id}' does not exist for project '{project_id}'.")

        # 1. Fetch approval record
        if approval_id:
            approval = (
                db.query(VideoApproval)
                .filter(VideoApproval.id == approval_id, VideoApproval.project_id == project_id)
                .first()
            )
        else:
            approval = cls.get_active_approval(db=db, project_id=project_id, video_version_id=video_version_id)

        if not approval:
            raise PermissionError("Human approval required before upload. No active approval record found.")

        if approval.is_revoked:
            raise PermissionError(f"Approval has been revoked: {approval.revocation_reason or 'No reason specified'}")

        # 2. Verify version match (Test D & E)
        if approval.video_version_id != video_version_id:
            raise PermissionError(
                f"Approval version mismatch: Approval is for version '{approval.video_version_id}', "
                f"attempting upload for '{video_version_id}'."
            )

        # 3. Verify checksum match (Test C & I)
        if expected_checksum and expected_checksum.lower() != approval.file_checksum.lower():
            raise PermissionError(
                f"Checksum mismatch: Client supplied '{expected_checksum}', approved checksum is '{approval.file_checksum}'."
            )

        if approval.file_checksum.lower() != video_version.file_checksum.lower():
            raise PermissionError("Integrity violation: Approved checksum does not match video version checksum.")

        # 4. Verify physical video file on disk
        physical_path = BASE_DIR / video_version.file_path
        if not physical_path.exists():
            raise PermissionError(f"Target video file not found on disk: {physical_path}")

        disk_checksum = cls.calculate_file_sha256(physical_path)
        if disk_checksum.lower() != approval.file_checksum.lower():
            raise PermissionError(
                f"Physical file tampered: Disk checksum '{disk_checksum}' differs from approved checksum '{approval.file_checksum}'."
            )

        # 5. Duplicate Upload Protection (Rule 14 Test H)
        existing_upload = (
            db.query(YouTubeUpload)
            .filter(
                YouTubeUpload.project_id == project_id,
                YouTubeUpload.video_version_id == video_version_id,
                YouTubeUpload.status.in_(["uploading", "published"])
            )
            .first()
        )
        if existing_upload:
            raise PermissionError(
                f"Duplicate upload prevented: Video version is already {existing_upload.status} "
                f"(YouTube Video ID: {existing_upload.youtube_video_id or 'In progress'})."
            )

        return approval

