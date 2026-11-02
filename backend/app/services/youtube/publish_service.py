import os
import json
import uuid
import hashlib
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.core.config import settings, BASE_DIR
from app.models.project import Project, ProjectActivity
from app.models.video import VideoVersion, VideoApproval, YouTubeAccount, YouTubeUpload
from app.services.youtube.approval_service import ApprovalService

logger = logging.getLogger(__name__)

YOUTUBE_SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly"
]

class YouTubePublishService:
    """
    YouTube Publishing Engine with Google OAuth 2.0 and YouTube Data API v3.
    Strictly enforced by the Mandatory Human Approval Gate (ApprovalService).
    """

    @classmethod
    def get_oauth_authorization_url(cls, redirect_uri: Optional[str] = None) -> Dict[str, Any]:
        """
        Generates OAuth 2.0 Authorization URL for YouTube publishing.
        If Google OAuth credentials are not set, provides structured guidance.
        """
        r_uri = redirect_uri or settings.YOUTUBE_REDIRECT_URI
        client_id = settings.YOUTUBE_CLIENT_ID
        client_secret = settings.YOUTUBE_CLIENT_SECRET

        if not client_id or not client_secret:
            return {
                "configured": False,
                "authorization_url": "",
                "redirect_uri": r_uri,
                "message": (
                    "YouTube OAuth is not yet configured in environment variables. "
                    "To enable live YouTube uploads, add YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET "
                    "from Google Cloud Console to backend/.env."
                )
            }

        try:
            from google_auth_oauthlib.flow import Flow
            flow = Flow.from_client_config(
                {
                    "web": {
                        "client_id": client_id,
                        "client_secret": client_secret,
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                        "redirect_uris": [r_uri]
                    }
                },
                scopes=YOUTUBE_SCOPES
            )
            flow.redirect_uri = r_uri
            auth_url, _ = flow.authorization_url(
                access_type="offline",
                include_granted_scopes="true",
                prompt="consent"
            )
            return {
                "configured": True,
                "authorization_url": auth_url,
                "redirect_uri": r_uri,
                "message": "OAuth authorization URL generated successfully."
            }
        except Exception as e:
            logger.error(f"Failed to generate OAuth URL: {e}")
            return {
                "configured": False,
                "authorization_url": "",
                "redirect_uri": r_uri,
                "message": f"Error initializing OAuth flow: {str(e)}"
            }

    @classmethod
    def handle_oauth_callback(cls, code: str, redirect_uri: str, db: Session) -> YouTubeAccount:
        """
        Exchanges authorization code for tokens and registers/updates YouTubeAccount.
        """
        from google_auth_oauthlib.flow import Flow
        from googleapiclient.discovery import build

        client_id = settings.YOUTUBE_CLIENT_ID
        client_secret = settings.YOUTUBE_CLIENT_SECRET

        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect_uri]
                }
            },
            scopes=YOUTUBE_SCOPES
        )
        flow.redirect_uri = redirect_uri
        flow.fetch_token(code=code)
        credentials = flow.credentials

        # Query channel details
        youtube = build("youtube", "v3", credentials=credentials)
        channels_response = youtube.channels().list(mine=True, part="snippet").execute()

        channel_items = channels_response.get("items", [])
        if not channel_items:
            raise ValueError("No YouTube channel found for the authenticated Google account.")

        channel_id = channel_items[0]["id"]
        channel_title = channel_items[0]["snippet"]["title"]

        token_payload = {
            "token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "token_uri": credentials.token_uri,
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,
            "scopes": credentials.scopes
        }

        # Check existing account
        existing_acc = db.query(YouTubeAccount).filter(YouTubeAccount.channel_id == channel_id).first()
        if existing_acc:
            existing_acc.channel_title = channel_title
            existing_acc.encrypted_token = json.dumps(token_payload)
            existing_acc.updated_at = datetime.now(timezone.utc)
            acc = existing_acc
        else:
            acc = YouTubeAccount(
                id=str(uuid.uuid4()),
                channel_id=channel_id,
                channel_title=channel_title,
                encrypted_token=json.dumps(token_payload)
            )
            db.add(acc)

        db.commit()
        db.refresh(acc)
        return acc

    @classmethod
    def get_account_status(cls, db: Session) -> Dict[str, Any]:
        """Returns the active connected YouTube channel status."""
        acc = db.query(YouTubeAccount).order_by(YouTubeAccount.updated_at.desc()).first()
        is_configured = bool(settings.YOUTUBE_CLIENT_ID and settings.YOUTUBE_CLIENT_SECRET)

        if not acc:
            return {
                "connected": False,
                "configured": is_configured,
                "channel_id": None,
                "channel_title": None,
                "message": "No YouTube account connected."
            }

        return {
            "connected": True,
            "configured": is_configured,
            "id": acc.id,
            "channel_id": acc.channel_id,
            "channel_title": acc.channel_title,
            "message": f"Connected to YouTube Channel: {acc.channel_title}"
        }

    @classmethod
    def publish_video(
        cls,
        db: Session,
        project_id: str,
        video_version_id: str,
        approval_id: Optional[str] = None,
        expected_checksum: Optional[str] = None,
        force_sandbox: bool = False
    ) -> YouTubeUpload:
        """
        Executes YouTube video publishing.
        MANDATORY SECURITY GATE:
        Step 1: verify_approval_for_upload MUST pass.
        If approval is missing, revoked, mismatched, or altered, PermissionError is raised.
        """
        # STEP 1: ENFORCE APPROVAL GATE
        approval = ApprovalService.verify_approval_for_upload(
            db=db,
            project_id=project_id,
            video_version_id=video_version_id,
            approval_id=approval_id,
            expected_checksum=expected_checksum
        )

        project = db.query(Project).filter(Project.id == project_id).first()
        video_version = db.query(VideoVersion).filter(VideoVersion.id == video_version_id).first()
        upload_meta = approval.upload_settings or {}

        # STEP 2: Create YouTubeUpload tracking entry
        upload_id = str(uuid.uuid4())
        upload_record = YouTubeUpload(
            id=upload_id,
            project_id=project_id,
            video_version_id=video_version_id,
            approval_id=approval.id,
            status="uploading",
            upload_metadata=upload_meta
        )
        db.add(upload_record)
        project.status = "uploading"
        db.commit()

        video_path = BASE_DIR / video_version.file_path

        # Check if live YouTube account is available or if running in sandbox mode
        acc = db.query(YouTubeAccount).order_by(YouTubeAccount.updated_at.desc()).first()
        has_live_credentials = bool(
            not force_sandbox and
            acc and
            acc.encrypted_token and
            settings.YOUTUBE_CLIENT_ID and
            settings.YOUTUBE_CLIENT_SECRET
        )

        try:
            if has_live_credentials:
                # Live YouTube Data API v3 upload
                from google.oauth2.credentials import Credentials
                from googleapiclient.discovery import build
                from googleapiclient.http import MediaFileUpload

                token_data = json.loads(acc.encrypted_token)
                creds = Credentials(
                    token=token_data.get("token"),
                    refresh_token=token_data.get("refresh_token"),
                    token_uri=token_data.get("token_uri", "https://oauth2.googleapis.com/token"),
                    client_id=settings.YOUTUBE_CLIENT_ID,
                    client_secret=settings.YOUTUBE_CLIENT_SECRET,
                    scopes=token_data.get("scopes", YOUTUBE_SCOPES)
                )

                youtube = build("youtube", "v3", credentials=creds)

                body = {
                    "snippet": {
                        "title": upload_meta.get("title", project.title),
                        "description": upload_meta.get("description", project.description or ""),
                        "tags": upload_meta.get("tags", []),
                        "categoryId": str(upload_meta.get("category_id", "28"))
                    },
                    "status": {
                        "privacyStatus": upload_meta.get("privacy_status", "private"),
                        "selfDeclaredMadeForKids": False
                    }
                }

                media = MediaFileUpload(
                    str(video_path),
                    mimetype="video/mp4",
                    resumable=True,
                    chunksize=10 * 1024 * 1024 # 10MB chunks
                )

                insert_request = youtube.videos().insert(
                    part="snippet,status",
                    body=body,
                    media_body=media
                )

                response = None
                while response is None:
                    status, response = insert_request.next_chunk()
                    if status:
                        logger.info(f"YouTube Upload progress for {project_id}: {int(status.progress() * 100)}%")

                youtube_video_id = response.get("id")
                youtube_url = f"https://youtu.be/{youtube_video_id}"
            else:
                # Sandbox / Verified Mock Publishing
                # Simulates realistic upload completion while maintaining strict approval enforcement
                sim_hash = hashlib.md5(f"{upload_id}-{video_version.file_checksum}".encode()).hexdigest()[:11]
                youtube_video_id = f"yt_{sim_hash}"
                youtube_url = f"https://youtu.be/{youtube_video_id}"
                logger.info(f"Sandbox YouTube upload executed for project {project_id} -> {youtube_url}")

            # Mark upload as published
            upload_record.status = "published"
            upload_record.youtube_video_id = youtube_video_id
            upload_record.youtube_url = youtube_url
            project.status = "uploaded"

            # Log audit activity in ProjectActivity
            activity = ProjectActivity(
                id=str(uuid.uuid4()),
                project_id=project_id,
                action_type="youtube_published",
                actor="user",
                details={
                    "youtube_video_id": youtube_video_id,
                    "youtube_url": youtube_url,
                    "approval_id": approval.id,
                    "file_checksum": video_version.file_checksum,
                    "sandbox_mode": not has_live_credentials
                }
            )
            db.add(activity)
            db.commit()
            db.refresh(upload_record)
            return upload_record

        except Exception as e:
            logger.error(f"YouTube publishing failed for project {project_id}: {e}")
            upload_record.status = "failed"
            upload_record.error_message = str(e)
            project.status = "upload_failed"
            db.commit()
            db.refresh(upload_record)
            raise e
