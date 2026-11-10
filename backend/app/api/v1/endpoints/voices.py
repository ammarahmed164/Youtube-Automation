import uuid
import wave
import shutil
import subprocess
from typing import List, Dict, Any, Optional
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings, BASE_DIR
from app.models.generation import Scene, AudioAsset, VoiceClone
from app.services.tts.piper_service import PiperTTSService, VOICE_CATALOG

router = APIRouter()

@router.get("/voices", response_model=List[Dict[str, Any]])
def list_voices(
    language: Optional[str] = Query(None, description="Optional language filter"),
    db: Session = Depends(get_db)
):
    """
    List studio-grade documentary voices across all supported languages,
    including user-created Cloned Voices. Cloned voices appear highlighted at the top.
    """
    clones = db.query(VoiceClone).order_by(VoiceClone.created_at.desc()).all()
    cloned_entries = [
        {
            "id": f"clone_{c.id}",
            "name": f"🎙️ [Cloned] {c.name}",
            "language": c.language or "All Languages",
            "locale": "custom",
            "gender": c.gender or "neutral",
            "tone": "User Cloned Voice (Gemini Neural Replication)",
            "preview_text": "Hello, this is my custom cloned voice.",
            "is_cloned": True
        }
        for c in clones
    ]

    base_voices = VOICE_CATALOG
    if language:
        lang_clean = language.strip().lower()
        base_voices = [v for v in base_voices if v["language"].lower() == lang_clean]
        matching_clones = [
            c for c in cloned_entries 
            if c["language"].lower() in [lang_clean, "all", "all languages"]
        ]
        return matching_clones + base_voices

    return cloned_entries + base_voices

@router.get("/voices/clones")
def list_cloned_voices(db: Session = Depends(get_db)):
    """List all custom cloned voices created by the user."""
    clones = db.query(VoiceClone).order_by(VoiceClone.created_at.desc()).all()
    return [
        {
            "id": f"clone_{c.id}",
            "raw_id": c.id,
            "name": c.name,
            "language": c.language,
            "gender": c.gender,
            "duration_seconds": c.duration_seconds,
            "provider": c.provider,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "is_cloned": True
        }
        for c in clones
    ]

@router.post("/voices/clone", status_code=status.HTTP_201_CREATED)
async def create_voice_clone(
    name: str = Form(...),
    file: UploadFile = File(...),
    language: Optional[str] = Form("All Languages"),
    gender: Optional[str] = Form("neutral"),
    db: Session = Depends(get_db)
):
    """
    Upload or record an audio sample (5s - 30s) to clone a user's voice for documentary narration.
    Converts and normalizes audio to 24kHz 16-bit mono WAV for Gemini Neural Voice Replication.
    """
    clean_name = name.strip()
    if not clean_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Voice name is required.")

    clone_id = str(uuid.uuid4())
    clone_dir = settings.WORKSPACE_DATA_DIR / "cloned_voices" / clone_id
    clone_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename or "recording.webm").suffix.lower()
    if not ext or ext == ".":
        ext = ".webm"
    raw_path = clone_dir / f"raw_sample{ext}"
    normalized_wav = clone_dir / "sample_24k.wav"

    try:
        content = await file.read()
        if len(content) < 5000:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Audio sample is too short. Please speak or upload at least 5-10 seconds of clear speech."
            )
        with open(raw_path, "wb") as f:
            f.write(content)

        # Convert to broadcast 24000Hz 16-bit mono WAV via FFmpeg
        ffmpeg_bin = settings.get_ffmpeg_path()
        cmd = [
            ffmpeg_bin, "-y",
            "-i", str(raw_path),
            "-ar", "24000",
            "-ac", "1",
            "-c:a", "pcm_s16le",
            str(normalized_wav)
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError(f"FFmpeg audio normalization failed: {res.stderr[-200:]}")

        with wave.open(str(normalized_wav), "rb") as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            duration_seconds = round(frames / float(rate), 2)

        if duration_seconds < 2.0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Audio duration ({duration_seconds}s) is too short. Please record at least 5 seconds."
            )

        rel_path = str(normalized_wav.relative_to(BASE_DIR)).replace("\\", "/")
        clone = VoiceClone(
            id=clone_id,
            name=clean_name,
            language=language or "All Languages",
            gender=gender or "neutral",
            sample_path=rel_path,
            duration_seconds=duration_seconds,
            base_voice_id="gemini-tts-base",
            provider="gemini_replicated"
        )
        db.add(clone)
        db.commit()
        db.refresh(clone)

        return {
            "status": "success",
            "message": f"Voice '{clean_name}' cloned successfully!",
            "voice": {
                "id": f"clone_{clone.id}",
                "raw_id": clone.id,
                "name": f"🎙️ [Cloned] {clone.name}",
                "language": clone.language,
                "gender": clone.gender,
                "duration_seconds": clone.duration_seconds,
                "provider": clone.provider,
                "is_cloned": True
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        shutil.rmtree(clone_dir, ignore_errors=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to clone voice: {str(e)}")

@router.delete("/voices/clones/{clone_id}")
def delete_voice_clone(clone_id: str, db: Session = Depends(get_db)):
    """Delete a custom cloned voice and remove its files."""
    clean_id = clone_id.replace("clone_", "").strip()
    clone = db.query(VoiceClone).filter(VoiceClone.id == clean_id).first()
    if not clone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Voice clone '{clean_id}' not found.")

    clone_dir = settings.WORKSPACE_DATA_DIR / "cloned_voices" / clean_id
    if clone_dir.exists():
        shutil.rmtree(clone_dir, ignore_errors=True)

    db.delete(clone)
    db.commit()
    return {"status": "success", "message": f"Cloned voice '{clone.name}' deleted successfully."}

@router.get("/voices/preview/{voice_id}")
async def get_voice_preview(voice_id: str, db: Session = Depends(get_db)):
    """
    Stream or generate a live audio preview of any selected voice.
    For cloned voices, streams the user's reference sample audio directly with inline content disposition.
    """
    clean_id = voice_id.replace("clone_", "").strip()
    clone = db.query(VoiceClone).filter((VoiceClone.id == clean_id) | (VoiceClone.id == voice_id)).first()
    if clone:
        sample_path = BASE_DIR / clone.sample_path
        if not sample_path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cloned voice audio sample missing.")
        return FileResponse(
            path=str(sample_path),
            media_type="audio/wav",
            content_disposition_type="inline",
            headers={
                "Cache-Control": "no-cache",
                "Accept-Ranges": "bytes"
            }
        )

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
        content_disposition_type="inline",
        headers={
            "Cache-Control": "public, max-age=604800",
            "Accept-Ranges": "bytes"
        }
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
