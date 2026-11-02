from typing import List, Dict, Any
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings, BASE_DIR
from app.models.generation import Scene, AudioAsset
from app.services.tts.piper_service import PiperTTSService

router = APIRouter()

@router.post("/{project_id}/generate-voice", status_code=status.HTTP_200_OK)
async def generate_project_voice(project_id: str, db: Session = Depends(get_db)):
    """
    Synthesize offline neural narration for all scenes using Piper TTS.
    Calculates exact durations and updates Supabase scene records.
    """
    try:
        results = await PiperTTSService.synthesize_project_narration(db=db, project_id=project_id)
        total_duration = sum(r["duration_seconds"] for r in results)
        return {
            "status": "success",
            "project_id": project_id,
            "scenes_synthesized": len(results),
            "total_audio_duration_seconds": total_duration,
            "total_audio_duration_minutes": round(total_duration / 60.0, 2),
            "audio_assets": results
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
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
        filename=f"{scene_id}.wav"
    )

