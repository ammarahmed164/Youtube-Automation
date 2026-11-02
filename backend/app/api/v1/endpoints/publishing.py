import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.project import Project
from app.models.video import VideoVersion, VideoApproval, YouTubeUpload
from app.schemas.approval import (
    VideoApprovalRequest,
    RevokeApprovalRequest,
    VideoApprovalResponse
)
from app.schemas.youtube import (
    YouTubePublishRequest,
    YouTubePublishResponse,
    YouTubeAuthUrlResponse,
    YouTubeAccountResponse
)
from app.services.youtube.approval_service import ApprovalService
from app.services.youtube.publish_service import YouTubePublishService

logger = logging.getLogger(__name__)
router = APIRouter()

# --- HUMAN APPROVAL GATE ENDPOINTS ---

@router.post("/{project_id}/approve", response_model=VideoApprovalResponse, status_code=status.HTTP_200_OK)
def approve_video_version(
    project_id: str,
    request: VideoApprovalRequest,
    db: Session = Depends(get_db)
):
    """
    Explicit Human Approval Action (Mandatory Rule 14).
    Ties durable approval to the exact video_version_id and verified SHA-256 file checksum.
    Upload is impossible without calling this first.
    """
    try:
        approval = ApprovalService.create_approval(
            db=db,
            project_id=project_id,
            video_version_id=request.video_version_id,
            confirmed_checksum=request.confirmed_checksum,
            upload_settings=request.upload_settings.model_dump(),
            user_id=None # Single-user local first
        )
        return approval
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating video approval: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/{project_id}/revoke-approval", response_model=VideoApprovalResponse, status_code=status.HTTP_200_OK)
def revoke_video_approval(
    project_id: str,
    request: RevokeApprovalRequest,
    db: Session = Depends(get_db)
):
    """Explicitly revokes an active video approval, preventing any upload until re-approved."""
    try:
        approval = ApprovalService.revoke_approval(
            db=db,
            project_id=project_id,
            video_version_id=request.video_version_id,
            reason=request.reason
        )
        return approval
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error revoking video approval: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/{project_id}/approval", response_model=Optional[VideoApprovalResponse])
def get_video_approval_status(
    project_id: str,
    video_version_id: Optional[str] = Query(None, description="Check approval for specific version"),
    db: Session = Depends(get_db)
):
    """Checks whether an active, valid approval exists for the project or specific version."""
    approval = ApprovalService.get_active_approval(db=db, project_id=project_id, video_version_id=video_version_id)
    return approval


# --- YOUTUBE OAUTH & CHANNEL MANAGEMENT ---

@router.get("/youtube/auth-url", response_model=YouTubeAuthUrlResponse)
def get_youtube_oauth_url(redirect_uri: Optional[str] = Query(None)):
    """Returns Google OAuth 2.0 authorization URL or configuration guidance."""
    return YouTubePublishService.get_oauth_authorization_url(redirect_uri=redirect_uri)

@router.get("/youtube/callback")
def handle_youtube_oauth_callback(
    code: str = Query(...),
    redirect_uri: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Handles OAuth 2.0 callback from Google, saving credentials."""
    try:
        account = YouTubePublishService.handle_oauth_callback(
            code=code,
            redirect_uri=redirect_uri or "http://localhost:8000/api/v1/publishing/youtube/callback",
            db=db
        )
        return RedirectResponse(url="http://localhost:3000/settings?youtube_connected=true")
    except Exception as e:
        logger.error(f"OAuth callback failed: {e}")
        return RedirectResponse(url=f"http://localhost:3000/settings?error={str(e)}")

@router.get("/youtube/status")
def get_youtube_connection_status(db: Session = Depends(get_db)):
    """Checks the status of connected YouTube account and environment configuration."""
    return YouTubePublishService.get_account_status(db=db)


# --- YOUTUBE PUBLISHING ENGINE ---

@router.post("/{project_id}/publish", response_model=YouTubePublishResponse, status_code=status.HTTP_200_OK)
def publish_documentary_to_youtube(
    project_id: str,
    request: YouTubePublishRequest,
    force_sandbox: bool = Query(False, description="Explicit sandbox simulation flag for offline testing"),
    db: Session = Depends(get_db)
):
    """
    Publish Approved Documentary to YouTube.
    MANDATORY GATE:
    Will fail with 403 Forbidden if approval is missing, revoked, altered, or mismatched.
    """
    try:
        upload = YouTubePublishService.publish_video(
            db=db,
            project_id=project_id,
            video_version_id=request.video_version_id,
            approval_id=request.approval_id,
            expected_checksum=request.expected_checksum,
            force_sandbox=force_sandbox
        )
        return upload
    except PermissionError as e:
        # Strict Rule 14 Gate rejection: 403 Forbidden
        logger.warning(f"Publishing rejected by Approval Gate for project {project_id}: {e}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"YouTube publishing failed for project {project_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/{project_id}/publish-status", response_model=Optional[YouTubePublishResponse])
def get_publish_status(
    project_id: str,
    video_version_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Retrieves the latest YouTube upload record and live YouTube URL."""
    query = db.query(YouTubeUpload).filter(YouTubeUpload.project_id == project_id)
    if video_version_id:
        query = query.filter(YouTubeUpload.video_version_id == video_version_id)
    latest_upload = query.order_by(YouTubeUpload.created_at.desc()).first()
    return latest_upload
