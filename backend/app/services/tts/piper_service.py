import os
import wave
import subprocess
import logging
from pathlib import Path
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.core.config import settings, BASE_DIR
from app.models.project import Project, ProjectActivity
from app.models.generation import ScriptRevision, Scene, AudioAsset
from app.services.tts.adapter import BaseTTSService

logger = logging.getLogger(__name__)

MODELS_DIR = BASE_DIR / "backend" / "models_tts"
PIPER_EXE = BASE_DIR / "backend" / "venv" / "Scripts" / "piper.exe"

VOICE_MODEL_MAP = {
    "deep_male_cinematic": MODELS_DIR / "en_US-bryce-medium.onnx",
    "natural_male": MODELS_DIR / "en_US-ryan-medium.onnx",
}

def is_urdu_or_arabic(text: str) -> bool:
    """Checks if text contains Arabic/Urdu Unicode characters."""
    for char in text:
        code = ord(char)
        if (0x0600 <= code <= 0x06FF) or (0x0750 <= code <= 0x077F) or (0xFB50 <= code <= 0xFDFF) or (0xFE70 <= code <= 0xFEFF):
            return True
    return False

def is_hindi(text: str) -> bool:
    """Checks if text contains Devanagari/Hindi Unicode characters."""
    for char in text:
        if 0x0900 <= ord(char) <= 0x097F:
            return True
    return False

class PiperTTSService(BaseTTSService):
    """
    Multilingual Neural Text-to-Speech Engine:
    - English: Offline local Piper ONNX neural models with automatic fallback.
    - Urdu / Hindi / Multilingual: High-fidelity native neural speech synthesis via gTTS & FFmpeg.
    Outputs broadcast-grade 22050Hz mono WAV audio with accurate duration measurement.
    """

    def __init__(self):
        self.piper_exe = PIPER_EXE
        self.models_dir = MODELS_DIR

    def is_available(self) -> bool:
        return self.piper_exe.exists()

    def get_model_path(self, preset: str) -> Path:
        model_path = VOICE_MODEL_MAP.get(preset)
        if not model_path or not model_path.exists():
            # Fallback to bryce if available
            default_path = MODELS_DIR / "en_US-bryce-medium.onnx"
            if default_path.exists():
                return default_path
            raise FileNotFoundError(f"Voice model for preset '{preset}' not found in {MODELS_DIR}")
        return model_path

    @classmethod
    def synthesize_multilingual_wav(cls, text: str, lang_code: str, output_path: Path) -> Dict[str, Any]:
        """
        Synthesizes multilingual speech (Urdu, Hindi, Spanish, etc.)
        and encodes directly to standard 22050Hz mono WAV via FFmpeg.
        """
        output_path.parent.mkdir(parents=True, exist_ok=True)
        temp_mp3 = output_path.with_suffix(".temp.mp3")

        try:
            from gtts import gTTS
            tts = gTTS(text=text, lang=lang_code)
            tts.save(str(temp_mp3))

            ffmpeg_bin = settings.get_ffmpeg_path()
            cmd = [
                ffmpeg_bin, "-y",
                "-i", str(temp_mp3),
                "-ar", "22050",
                "-ac", "1",
                str(output_path)
            ]
            res = subprocess.run(cmd, capture_output=True, text=True)
            if res.returncode != 0:
                raise RuntimeError(f"FFmpeg audio conversion failed: {res.stderr[-200:]}")

            with wave.open(str(output_path), "rb") as wf:
                frames = wf.getnframes()
                rate = wf.getframerate()
                duration_seconds = round(frames / float(rate), 2)

            return {
                "file_path": str(output_path.relative_to(BASE_DIR)),
                "duration_seconds": duration_seconds,
                "sample_rate": rate
            }
        finally:
            if temp_mp3.exists():
                try:
                    temp_mp3.unlink()
                except Exception:
                    pass

    async def synthesize_scene(
        self,
        scene_id: str,
        text: str,
        voice_preset: str,
        output_path: Path,
        language: str = "English"
    ) -> Dict[str, Any]:
        """
        Synthesizes speech for a single scene with intelligent language routing:
        - Urdu / Arabic script -> Native Urdu neural voice
        - Hindi / Devanagari script -> Native Hindi neural voice
        - Spanish -> Native Spanish neural voice
        - English -> Piper offline cinematic neural voice with seamless fallback
        """
        output_path.parent.mkdir(parents=True, exist_ok=True)
        lang_lower = (language or "English").lower()

        # Check for non-English language or Unicode script
        if lang_lower == "urdu" or is_urdu_or_arabic(text):
            logger.info(f"Synthesizing scene {scene_id} with native Urdu speech synthesis...")
            meta = self.synthesize_multilingual_wav(text=text, lang_code="ur", output_path=output_path)
            meta["scene_id"] = scene_id
            meta["voice_preset"] = f"urdu_neural_{voice_preset}"
            return meta

        if lang_lower == "hindi" or is_hindi(text):
            logger.info(f"Synthesizing scene {scene_id} with native Hindi speech synthesis...")
            meta = self.synthesize_multilingual_wav(text=text, lang_code="hi", output_path=output_path)
            meta["scene_id"] = scene_id
            meta["voice_preset"] = f"hindi_neural_{voice_preset}"
            return meta

        if lang_lower == "spanish":
            logger.info(f"Synthesizing scene {scene_id} with native Spanish speech synthesis...")
            meta = self.synthesize_multilingual_wav(text=text, lang_code="es", output_path=output_path)
            meta["scene_id"] = scene_id
            meta["voice_preset"] = f"spanish_neural_{voice_preset}"
            return meta

        # English: Attempt Piper offline model first
        try:
            model_path = self.get_model_path(voice_preset)
            cmd = [
                str(self.piper_exe),
                "--model", str(model_path),
                "--output_file", str(output_path),
            ]

            process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8"
            )
            stdout, stderr = process.communicate(input=text)

            if process.returncode != 0:
                raise RuntimeError(f"Piper returned non-zero code: {stderr}")

            with wave.open(str(output_path), "rb") as wf:
                frames = wf.getnframes()
                rate = wf.getframerate()
                duration_seconds = round(frames / float(rate), 2)

            return {
                "scene_id": scene_id,
                "file_path": str(output_path.relative_to(BASE_DIR)),
                "duration_seconds": duration_seconds,
                "sample_rate": rate,
                "voice_preset": voice_preset
            }

        except Exception as e:
            logger.warning(f"Piper TTS failed for scene {scene_id} ({e}). Falling back to multilingual neural TTS...")
            meta = self.synthesize_multilingual_wav(text=text, lang_code="en", output_path=output_path)
            meta["scene_id"] = scene_id
            meta["voice_preset"] = f"fallback_en_{voice_preset}"
            return meta

    @staticmethod
    async def synthesize_project_narration(db: Session, project_id: str) -> List[Dict[str, Any]]:
        """
        Synthesizes voiceover narration for all scenes in the project's latest script revision.
        Saves AudioAsset records to Supabase and updates exact durations.
        """
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError(f"Project '{project_id}' not found.")

        # Find latest script revision
        latest_rev = (
            db.query(ScriptRevision)
            .filter(ScriptRevision.project_id == project_id)
            .order_by(ScriptRevision.revision_number.desc())
            .first()
        )
        if not latest_rev or not latest_rev.scenes:
            raise ValueError(f"No scenes found to synthesize for project '{project_id}'.")

        preset = project.settings.narration_preset if project.settings else "deep_male_cinematic"
        tts = PiperTTSService()

        results = []
        audio_dir = settings.WORKSPACE_DATA_DIR / "projects" / project_id / "audio"

        lang = project.settings.language if project.settings else "English"

        for scene in sorted(latest_rev.scenes, key=lambda s: s.scene_order):
            out_file = audio_dir / f"{scene.scene_id_str}.wav"
            meta = await tts.synthesize_scene(
                scene_id=scene.id,
                text=scene.narration_text,
                voice_preset=preset,
                output_path=out_file,
                language=lang
            )

            # Update scene record with actual audio duration
            scene.actual_audio_duration_seconds = meta["duration_seconds"]

            # Upsert audio_assets record
            audio_record = db.query(AudioAsset).filter(AudioAsset.scene_id == scene.id).first()
            if not audio_record:
                audio_record = AudioAsset(
                    scene_id=scene.id,
                    voice_preset=preset,
                    file_path=meta["file_path"],
                    duration_seconds=meta["duration_seconds"]
                )
                db.add(audio_record)
            else:
                audio_record.file_path = meta["file_path"]
                audio_record.duration_seconds = meta["duration_seconds"]
                audio_record.voice_preset = preset

            results.append(meta)

        # Update Project Status to voice_generated
        project.status = "assets_preparing"
        
        # Log Activity
        activity = ProjectActivity(
            project_id=project_id,
            action_type="voice_generated",
            actor="ai_agent",
            details={
                "scenes_synthesized": len(results),
                "total_audio_duration_seconds": sum(r["duration_seconds"] for r in results),
                "voice_preset": preset
            }
        )
        db.add(activity)

        db.commit()
        return results

