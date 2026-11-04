from typing import List, Dict, Any, Optional
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings, BASE_DIR
from app.models.generation import Scene, AudioAsset
from app.services.tts.piper_service import PiperTTSService, VOICE_CATALOG

router = APIRouter()

@router.get("/voices", response_model=List[Dict[str, Any]])
def list_voices(language: Optional[str] = Query(None, description="Optional language filter")):
    """List studio-grade documentary voices across all supported languages."""
    if language:
        lang_clean = language.strip().lower()
        return [v for v in VOICE_CATALOG if v["language"].lower() == lang_clean]
    return VOICE_CATALOG

@router.get("/voices/preview/{voice_id}")
async def get_voice_preview(voice_id: str):
    """
    Stream or generate a live 2-second audio preview of any selected voice.
    Cached in workspace_data/voice_previews for instant response.
    """
    voice_match = next((v for v in VOICE_CATALOG if v["id"] == voice_id), None)
    if not voice_match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Voice '{voice_id}' not found.")

    previews_dir = settings.WORKSPACE_DATA_DIR / "voice_previews"
    previews_dir.mkdir(parents=True, exist_ok=True)
    cache_path = previews_dir / f"{voice_id}.wav"

    if not cache_path.exists():
        tts = PiperTTSService()
        preview_text = voice_match.get("preview_text", "This is an example documentary narration.")
        await tts.synthesize_scene(
            scene_id="preview",
            text=preview_text,
            voice_preset=voice_id,
            output_path=cache_path,
            language=voice_match["language"]
        )

    return FileResponse(
        path=str(cache_path),
        media_type="audio/wav",
        filename=f"{voice_id}_preview.wav",
        headers={"Cache-Control": "public, max-age=604800"}
    )

@router.post("/{project_id}/generate-voice", status_code=status.HTTP_200_OK)
async def generate_project_voice(
    project_id: str,
    voice_preset: Optional[str] = Query(None, description="Optional voice ID override"),
    db: Session = Depends(get_db)
):
    """
    Synthesize natural documentary narration for all scenes in the project.
    Supports user-chosen voice preset in any language.
    Calculates exact durations and updates database records.
    """
    try:
        results = await PiperTTSService.synthesize_project_narration(
            db=db,
            project_id=project_id,
            voice_preset=voice_preset
        )
        total_duration = sum(r["duration_seconds"] for r in results)
        return {
            "status": "success",
            "project_id": project_id,
            "scenes_synthesized": len(results),
            "total_audio_duration_seconds": total_duration,
            "total_audio_duration_minutes": round(total_duration / 60.0, 2),
            "voice_preset": voice_preset,
            "audio_assets": results
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/scenes/{scene_id}/generate-voice", status_code=status.HTTP_200_OK)
async def generate_scene_voice(
    scene_id: str,
    voice_preset: Optional[str] = Query(None, description="Optional voice ID override"),
    db: Session = Depends(get_db)
):
    """
    Synthesize or regenerate narration for an individual scene.
    Enables single-scene updates without re-generating the entire documentary.
    """
    try:
        result = await PiperTTSService.synthesize_single_scene_audio(
            db=db,
            scene_id=scene_id,
            voice_preset=voice_preset
        )
        return {
            "status": "success",
            "scene_id": scene_id,
            "audio_asset": result
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/scenes/{scene_id}/audio")
def get_scene_audio(scene_id: str, db: Session = Depends(get_db)):
    """Stream or download the generated WAV narration file for a specific scene."""
    audio_record = db.query(AudioAsset).filter(AudioAsset.scene_id == scene_id).first()
    if not audio_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audio not found for this scene.")
    
    file_path = BASE_DIR / audio_record.file_path
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audio file missing from workspace.")

    return FileResponse(
        path=str(file_path),
        media_type="audio/wav",
        filename=f"{scene_id}.wav",
        headers={"Cache-Control": "public, max-age=86400"}
    )
