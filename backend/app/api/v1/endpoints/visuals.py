from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings, BASE_DIR
from app.models.generation import Scene, SceneAsset
from app.services.visual.visual_service import VisualService

router = APIRouter()

@router.post("/{project_id}/generate-visuals", status_code=status.HTTP_200_OK)
def generate_project_visuals(
    project_id: str,
    force_regenerate: bool = Query(False, description="Whether to re-download/re-generate existing visuals"),
    db: Session = Depends(get_db)
):
    """
    Search and download 1080p high-res visuals for all scenes using NASA Image Archive
    and Procedural Cinematic Canvas engine.
    """
    try:
        results = VisualService.generate_project_visuals(
            db=db,
            project_id=project_id,
            force_regenerate=force_regenerate
        )
        return {
            "status": "success",
            "project_id": project_id,
            "visuals_count": len(results),
            "visual_assets": results
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/scenes/{scene_id}/visual")
def get_scene_visual(scene_id: str, db: Session = Depends(get_db)):
    """Serve the 1920x1080 visual image or video file for a specific scene."""
    asset = db.query(SceneAsset).filter(SceneAsset.scene_id == scene_id).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visual asset not found for this scene.")

    file_path = BASE_DIR / asset.file_path
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visual file missing from workspace.")

    media_type = "video/mp4" if asset.file_path.endswith(".mp4") else "image/jpeg"
    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=Path(asset.file_path).name,
        headers={"Cache-Control": "public, max-age=86400"}
    )

@router.post("/scenes/{scene_id}/upload-asset", status_code=status.HTTP_200_OK)
async def upload_scene_asset(
    scene_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload a custom visual asset (JPG, PNG, WebP, MP4) for a specific scene.
    Auto-formats images to 1920x1080 (16:9).
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")

        result = VisualService.save_uploaded_asset(
            db=db,
            scene_id=scene_id,
            file_bytes=content,
            original_filename=file.filename or "upload.jpg"
        )
        return {
            "status": "success",
            "message": "Custom asset uploaded and attached successfully.",
            "asset": result
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

