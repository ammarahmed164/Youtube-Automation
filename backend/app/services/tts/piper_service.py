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

class PiperTTSService(BaseTTSService):
    """
    Offline local Neural Text-to-Speech service using Piper.
    Synthesizes narration per scene and measures exact millisecond audio duration.
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

    async def synthesize_scene(
        self,
        scene_id: str,
        text: str,
        voice_preset: str,
        output_path: Path
    ) -> Dict[str, Any]:
        """
        Synthesizes speech for a single scene and returns duration metadata.
        """
        output_path.parent.mkdir(parents=True, exist_ok=True)
        model_path = self.get_model_path(voice_preset)

        cmd = [
            str(self.piper_exe),
            "--model", str(model_path),
            "--output_file", str(output_path),
        ]

        # Execute Piper
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
            logger.error(f"Piper TTS error for scene {scene_id}: {stderr}")
            raise RuntimeError(f"Piper TTS synthesis failed: {stderr}")

        # Measure exact duration
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

        for scene in sorted(latest_rev.scenes, key=lambda s: s.scene_order):
            out_file = audio_dir / f"{scene.scene_id_str}.wav"
            meta = await tts.synthesize_scene(
                scene_id=scene.id,
                text=scene.narration_text,
                voice_preset=preset,
                output_path=out_file
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

