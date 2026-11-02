import uuid
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings, BASE_DIR
from app.models.project import Project
from app.models.generation import GenerationJob
from app.models.video import VideoVersion
from app.schemas.video import VideoVersionResponse, RenderJobStatusResponse
from app.services.rendering.service import RenderingService

router = APIRouter()

@router.post("/{project_id}/render", status_code=status.HTTP_202_ACCEPTED)
async def start_video_render(
    project_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Trigger full 1080p MP4 documentary video rendering in the background.
    Stitches scenes, applies Ken Burns pan/zoom, syncs audio and subtitles.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project '{project_id}' not found.")

    # Check if a rendering job is already actively running
    active_job = (
        db.query(GenerationJob)
        .filter(GenerationJob.project_id == project_id, GenerationJob.job_type == "rendering", GenerationJob.status == "running")
        .first()
    )
    if active_job:
        return {
            "job_id": active_job.id,
            "status": "running",
            "message": "A rendering job is already currently in progress.",
            "progress_percent": active_job.progress_percent
        }

    job_id = str(uuid.uuid4())
    job = GenerationJob(
        id=job_id,
        project_id=project_id,
        job_type="rendering",
        status="queued",
        progress_percent=0,
        log_messages=["Render request accepted and queued."]
    )
    db.add(job)
    db.commit()

    # Launch in background worker task
    background_tasks.add_task(RenderingService.render_project, project_id=project_id, job_id=job_id)

    return {
        "job_id": job_id,
        "project_id": project_id,
        "status": "queued",
        "message": "Documentary rendering started in background."
    }

@router.get("/{project_id}/render-status", response_model=RenderJobStatusResponse)
def get_render_status(project_id: str, db: Session = Depends(get_db)):
    """Check the real-time progress of the latest video rendering job."""
    job = (
        db.query(GenerationJob)
        .filter(GenerationJob.project_id == project_id, GenerationJob.job_type == "rendering")
        .order_by(GenerationJob.created_at.desc())
        .first()
    )
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No rendering job found for this project.")

    latest_video = None
    if job.status == "completed":
        latest_video = (
            db.query(VideoVersion)
            .filter(VideoVersion.project_id == project_id)
            .order_by(VideoVersion.version_number.desc())
            .first()
        )

    return RenderJobStatusResponse(
        job_id=job.id,
        project_id=job.project_id,
        status=job.status,
        progress_percent=job.progress_percent,
        log_messages=job.log_messages or [],
        error_details=job.error_details,
        video_version=VideoVersionResponse.model_validate(latest_video) if latest_video else None
    )

@router.get("/{project_id}/video")
def stream_project_video(
    project_id: str,
    version: Optional[int] = Query(None, description="Specific version number, defaults to latest"),
    db: Session = Depends(get_db)
):
    """Stream or download the rendered 1080p documentary MP4."""
    query = db.query(VideoVersion).filter(VideoVersion.project_id == project_id)
    if version:
        video_rec = query.filter(VideoVersion.version_number == version).first()
    else:
        video_rec = query.order_by(VideoVersion.version_number.desc()).first()

    if not video_rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No rendered video found for this project.")

    video_file = BASE_DIR / video_rec.file_path
    if not video_file.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rendered video file is missing from disk.")

    return FileResponse(
        path=str(video_file),
        media_type="video/mp4",
        filename=Path(video_rec.file_path).name
    )

@router.get("/{project_id}/subtitles")
def get_project_subtitles(
    project_id: str,
    format: str = Query("vtt", description="'vtt' for HTML5 player or 'srt' for export"),
    version: Optional[int] = Query(None, description="Specific version number, defaults to latest"),
    db: Session = Depends(get_db)
):
    """Retrieve synchronized subtitle track (.vtt or .srt) for the rendered video."""
    query = db.query(VideoVersion).filter(VideoVersion.project_id == project_id)
    if version:
        video_rec = query.filter(VideoVersion.version_number == version).first()
    else:
        video_rec = query.order_by(VideoVersion.version_number.desc()).first()

    if not video_rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No rendered video found.")

    v_num = video_rec.version_number
    sub_filename = f"subtitles.{format}"
    sub_path = BASE_DIR / "workspace_data" / "projects" / project_id / "renders" / f"v{v_num}" / sub_filename

    if not sub_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Subtitle file '{sub_filename}' not found.")

    media_type = "text/vtt" if format == "vtt" else "text/plain"
    return FileResponse(
        path=str(sub_path),
        media_type=media_type,
        filename=sub_filename
    )

@router.get("/{project_id}/versions", response_model=List[VideoVersionResponse])
def list_video_versions(project_id: str, db: Session = Depends(get_db)):
    """List all immutable video versions and SHA-256 checksums for this project."""
    versions = (
        db.query(VideoVersion)
        .filter(VideoVersion.project_id == project_id)
        .order_by(VideoVersion.version_number.desc())
        .all()
    )
    return versions

