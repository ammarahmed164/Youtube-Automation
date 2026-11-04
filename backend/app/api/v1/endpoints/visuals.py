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
def get_scene_visual(
    scene_id: str,
    slot: int = Query(0, description="0 for main cut, 1 for b-roll 1, 2 for b-roll 2"),
    db: Session = Depends(get_db)
):
    """
    Serve the 1920x1080 visual image or video file for a specific scene or B-roll cut slot.
    """
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found.")

    visuals_dir = BASE_DIR / "workspace_data" / "projects" / scene.project_id / "visuals"

    if slot == 0:
        # Check custom video upload first
        custom_vid = visuals_dir / f"{scene.scene_id_str}_upload.mp4"
        if custom_vid.exists():
            return FileResponse(path=str(custom_vid), media_type="video/mp4", filename=custom_vid.name)

        # Check standard jpg
        main_jpg = visuals_dir / f"{scene.scene_id_str}.jpg"
        if main_jpg.exists():
            return FileResponse(
                path=str(main_jpg),
                media_type="image/jpeg",
                filename=main_jpg.name,
                headers={"Cache-Control": "public, max-age=86400"}
            )
    else:
        # B-Roll slot
        b_suffix = f"b{slot:02d}"
        b_vid = visuals_dir / f"{scene.scene_id_str}_{b_suffix}.mp4"
        if b_vid.exists():
            return FileResponse(path=str(b_vid), media_type="video/mp4", filename=b_vid.name)

        b_jpg = visuals_dir / f"{scene.scene_id_str}_{b_suffix}.jpg"
        if b_jpg.exists():
            return FileResponse(
                path=str(b_jpg),
                media_type="image/jpeg",
                filename=b_jpg.name,
                headers={"Cache-Control": "public, max-age=86400"}
            )

    # Fallback to SceneAsset database record
    asset = db.query(SceneAsset).filter(SceneAsset.scene_id == scene_id).first()
    if asset:
        fp = BASE_DIR / asset.file_path
        if fp.exists():
            media_type = "video/mp4" if asset.file_path.endswith(".mp4") else "image/jpeg"
            return FileResponse(
                path=str(fp),
                media_type=media_type,
                filename=fp.name,
                headers={"Cache-Control": "public, max-age=86400"}
            )

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visual file missing from workspace.")

@router.get("/scenes/{scene_id}/cuts")
def get_scene_visuals_gallery(scene_id: str, db: Session = Depends(get_db)):
    """Retrieve all visual cuts and B-rolls with AI vs User-uploaded indicators."""
    try:
        return VisualService.get_scene_visuals_gallery(db=db, scene_id=scene_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.post("/scenes/{scene_id}/upload-asset", status_code=status.HTTP_200_OK)
async def upload_scene_asset(
    scene_id: str,
    cut_slot: int = Query(0, description="0 for main cut, 1 for B-roll 1, 2 for B-roll 2"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload a custom visual asset (Photos: JPG, PNG, WebP; Videos & Animations: MP4, MOV, WEBM, GIF)
    for a specific scene or cut slot. Auto-normalizes to 1920x1080 (16:9 Full HD).
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")

        result = VisualService.save_uploaded_asset(
            db=db,
            scene_id=scene_id,
            file_bytes=content,
            original_filename=file.filename or "upload.jpg",
            cut_slot=cut_slot
        )
        return {
            "status": "success",
            "message": "Custom visual uploaded and formatted to 1920x1080 Full HD successfully.",
            "asset": result
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/scenes/{scene_id}/reset-visual", status_code=status.HTTP_200_OK)
def reset_scene_visual(scene_id: str, db: Session = Depends(get_db)):
    """Reset a scene's visual back to pristine AI/archival generation."""
    try:
        result = VisualService.reset_scene_visual(db=db, scene_id=scene_id)
        return {
            "status": "success",
            "message": "Scene visual reset back to AI archival visual.",
            "visual": result
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

