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
    version: Optional[str] = Query(None, description="Specific version number, defaults to latest"),
    download: bool = Query(False, description="Set true to force browser download instead of inline streaming"),
    db: Session = Depends(get_db)
):
    """Stream or download the rendered 1080p documentary MP4 with smooth HTTP range support."""
    query = db.query(VideoVersion).filter(VideoVersion.project_id == project_id)

    v_int = None
    if version is not None:
        try:
            clean_v = str(version).split("?")[0].split("&")[0].strip()
            if clean_v.isdigit():
                v_int = int(clean_v)
        except Exception:
            v_int = None

    if v_int is not None:
        video_rec = query.filter(VideoVersion.version_number == v_int).first()
    else:
        video_rec = query.order_by(VideoVersion.version_number.desc()).first()

    if not video_rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No rendered video found for this project.")

    video_file = BASE_DIR / video_rec.file_path
    if not video_file.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rendered video file is missing from disk.")

    disp = "attachment" if download else "inline"
    filename_param = Path(video_rec.file_path).name if download else None

    return FileResponse(
        path=str(video_file),
        media_type="video/mp4",
        filename=filename_param,
        content_disposition_type=disp,
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=3600"
        }
    )

@router.get("/{project_id}/subtitles")
def get_project_subtitles(
    project_id: str,
    format: str = Query("vtt", description="'vtt' for HTML5 player or 'srt' for export"),
    version: Optional[str] = Query(None, description="Specific version number, defaults to latest"),
    download: bool = Query(False, description="Set true to force browser download"),
    db: Session = Depends(get_db)
):
    """Retrieve synchronized subtitle track (.vtt or .srt) for the rendered video."""
    query = db.query(VideoVersion).filter(VideoVersion.project_id == project_id)

    v_int = None
    if version is not None:
        try:
            clean_v = str(version).split("?")[0].split("&")[0].strip()
            if clean_v.isdigit():
                v_int = int(clean_v)
        except Exception:
            v_int = None

    if v_int is not None:
        video_rec = query.filter(VideoVersion.version_number == v_int).first()
    else:
        video_rec = query.order_by(VideoVersion.version_number.desc()).first()

    if not video_rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No rendered video found.")

    v_num = video_rec.version_number
    sub_filename = f"subtitles.{format}"
    sub_path = BASE_DIR / "workspace_data" / "projects" / project_id / "renders" / f"v{v_num}" / sub_filename

    if not sub_path.exists():
        # Auto-generate synchronized subtitles if missing
        from app.models.generation import Scene, ScriptRevision
        from app.services.rendering.service import RenderingService
        script = db.query(ScriptRevision).filter(ScriptRevision.project_id == project_id).order_by(ScriptRevision.revision_number.desc()).first()
        if script:
            scenes = db.query(Scene).filter(Scene.script_revision_id == script.id).order_by(Scene.scene_order.asc()).all()
            if scenes:
                sub_path.parent.mkdir(parents=True, exist_ok=True)
                srt_path = sub_path.parent / "subtitles.srt"
                vtt_path = sub_path.parent / "subtitles.vtt"
                RenderingService.generate_subtitles(scenes, srt_path, vtt_path)

    if not sub_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Subtitle file '{sub_filename}' not found.")

    media_type = "text/vtt; charset=utf-8" if format == "vtt" else "text/plain; charset=utf-8"
    disp = "attachment" if download else "inline"
    filename_param = sub_filename if download else None

    return FileResponse(
        path=str(sub_path),
        media_type=media_type,
        filename=filename_param,
        content_disposition_type=disp
    )

@router.post("/{project_id}/subtitles/regenerate")
def regenerate_project_subtitles(
    project_id: str,
    version: Optional[int] = Query(None, description="Video version number to re-sync subtitles for"),
    db: Session = Depends(get_db)
):
    """Regenerates line-by-line synchronized subtitles (.srt and .vtt) for the given video version without re-rendering."""
    from app.models.generation import Scene, ScriptRevision
    from app.services.rendering.service import RenderingService

    query = db.query(VideoVersion).filter(VideoVersion.project_id == project_id)
    if version is not None:
        video_rec = query.filter(VideoVersion.version_number == version).first()
    else:
        video_rec = query.order_by(VideoVersion.version_number.desc()).first()

    if not video_rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No rendered video found.")

    script = db.query(ScriptRevision).filter(ScriptRevision.project_id == project_id).order_by(ScriptRevision.revision_number.desc()).first()
    if not script:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No script found for project.")

    scenes = db.query(Scene).filter(Scene.script_revision_id == script.id).order_by(Scene.scene_order.asc()).all()
    if not scenes:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No scenes found.")

    v_dir = BASE_DIR / "workspace_data" / "projects" / project_id / "renders" / f"v{video_rec.version_number}"
    v_dir.mkdir(parents=True, exist_ok=True)
    srt_path = v_dir / "subtitles.srt"
    vtt_path = v_dir / "subtitles.vtt"

    RenderingService.generate_subtitles(scenes, srt_path, vtt_path)

    total_cues = sum(
        len(RenderingService.split_narration_into_cues(
            s.narration_text or "",
            s.actual_audio_duration_seconds or s.estimated_duration_seconds or 5.0
        )) for s in scenes
    )

    return {
        "status": "success",
        "message": f"Synchronized line-by-line subtitles successfully updated for v{video_rec.version_number}",
        "version": video_rec.version_number,
        "cues_count": total_cues
    }


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

