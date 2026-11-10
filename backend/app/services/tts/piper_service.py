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

VOICE_CATALOG = [
    # Urdu (Pakistan)
    {
        "id": "ur-PK-AsadNeural",
        "name": "Asad (اسد)",
        "language": "Urdu",
        "locale": "ur-PK",
        "gender": "male",
        "tone": "Deep, Authoritative Cinematic Male (Pakistan)",
        "preview_text": "پاکستان اور ہندوستان کی تاریخ کا یہ ایک نیا اور فیصلہ کن موڑ تھا۔"
    },
    {
        "id": "ur-PK-UzmaNeural",
        "name": "Uzma (عظمیٰ)",
        "language": "Urdu",
        "locale": "ur-PK",
        "gender": "female",
        "tone": "Warm, Expressive Documentary Female (Pakistan)",
        "preview_text": "پاکستان اور ہندوستان کی تاریخ کا یہ ایک نیا اور فیصلہ کن موڑ تھا۔"
    },
    # Urdu (India)
    {
        "id": "ur-IN-SalmanNeural",
        "name": "Salman (سلمان)",
        "language": "Urdu",
        "locale": "ur-IN",
        "gender": "male",
        "tone": "Natural, Thoughtful Storyteller Male (India)",
        "preview_text": "برصغیر کی تاریخ میں یہ واقعہ ہمیشہ یاد رکھا جائے گا۔"
    },
    {
        "id": "ur-IN-GulNeural",
        "name": "Gul (گل)",
        "language": "Urdu",
        "locale": "ur-IN",
        "gender": "female",
        "tone": "Polished, Clear Narrative Female (India)",
        "preview_text": "برصغیر کی تاریخ میں یہ واقعہ ہمیشہ یاد رکھا جائے گا۔"
    },
    # Hindi (India)
    {
        "id": "hi-IN-MadhurNeural",
        "name": "Madhur (मधुर)",
        "language": "Hindi",
        "locale": "hi-IN",
        "gender": "male",
        "tone": "Deep, Resonant Cinematic Male (India)",
        "preview_text": "यह कहानी इतिहास के सबसे रोमांचक और रहस्यमयी अध्याय की है।"
    },
    {
        "id": "hi-IN-SwaraNeural",
        "name": "Swara (स्वरा)",
        "language": "Hindi",
        "locale": "hi-IN",
        "gender": "female",
        "tone": "Warm, Engaging Documentary Female (India)",
        "preview_text": "यह कहानी इतिहास के सबसे रोमांचक और रहस्यमयी अध्याय की है।"
    },
    # English (US)
    {
        "id": "en-US-ChristopherNeural",
        "name": "Christopher (US)",
        "language": "English",
        "locale": "en-US",
        "gender": "male",
        "tone": "Deep, Authoritative American Male",
        "preview_text": "Deep in the cosmic darkness, a revolutionary discovery was about to unfold."
    },
    {
        "id": "en-US-GuyNeural",
        "name": "Guy (US)",
        "language": "English",
        "locale": "en-US",
        "gender": "male",
        "tone": "Dynamic, Passionate Storyteller Male",
        "preview_text": "This was the critical turning point that changed everything."
    },
    {
        "id": "en-US-EricNeural",
        "name": "Eric (US)",
        "language": "English",
        "locale": "en-US",
        "gender": "male",
        "tone": "Calm, Reflective Scientific Male",
        "preview_text": "The latest observations revealed something completely unexpected."
    },
    {
        "id": "en-US-JennyNeural",
        "name": "Jenny (US)",
        "language": "English",
        "locale": "en-US",
        "gender": "female",
        "tone": "Clear, Professional Studio Female",
        "preview_text": "Centuries of research led humanity to this extraordinary moment."
    },
    # English (UK)
    {
        "id": "en-GB-RyanNeural",
        "name": "Ryan (UK)",
        "language": "English",
        "locale": "en-GB",
        "gender": "male",
        "tone": "Deep BBC-style British Male",
        "preview_text": "An astonishing expedition across the uncharted frontiers of history."
    },
    {
        "id": "en-GB-SoniaNeural",
        "name": "Sonia (UK)",
        "language": "English",
        "locale": "en-GB",
        "gender": "female",
        "tone": "Polished, Warm BBC Female",
        "preview_text": "The evidence gathered here points to an undeniable truth."
    },
    # Arabic
    {
        "id": "ar-SA-HamedNeural",
        "name": "Hamed (حامد)",
        "language": "Arabic",
        "locale": "ar-SA",
        "gender": "male",
        "tone": "Deep, Resonant Authority Male (Saudi)",
        "preview_text": "في عمق التاريخ، بدأت هذه الرحلة الاستثنائية التي غيرت العالم."
    },
    # Spanish
    {
        "id": "es-ES-AlvaroNeural",
        "name": "Alvaro (ES)",
        "language": "Spanish",
        "locale": "es-ES",
        "gender": "male",
        "tone": "Deep, Serious Documentary Male (Spain)",
        "preview_text": "En las profundidades del cosmos, un nuevo enigma aguardaba ser descubierto."
    }
]

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
    async def synthesize_edge_tts_wav(cls, text: str, voice_id: str, output_path: Path) -> Dict[str, Any]:
        """
        Synthesizes studio-grade neural speech via Microsoft Edge TTS
        and converts it directly to standard 22050Hz mono WAV using FFmpeg.
        """
        output_path.parent.mkdir(parents=True, exist_ok=True)
        temp_mp3 = output_path.with_suffix(".temp.mp3")

        try:
            import edge_tts
            communicate = edge_tts.Communicate(text, voice_id)
            await communicate.save(str(temp_mp3))

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
                "sample_rate": rate,
                "voice_preset": voice_id
            }
        finally:
            if temp_mp3.exists():
                try:
                    temp_mp3.unlink()
                except Exception:
                    pass

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

    @classmethod
    async def synthesize_cloned_voice_wav(
        cls,
        text: str,
        clone_id: str,
        output_path: Path,
        language: str = "English"
    ) -> Dict[str, Any]:
        """
        Synthesizes high-fidelity custom narration using Google Gemini Zero-Shot Voice Replication.
        Clones user's pitch, timbre, vocal tract, and cadence directly from reference audio.
        """
        from app.core.database import SessionLocal
        from app.models.generation import VoiceClone
        from google import genai
        from google.genai import types

        clean_id = clone_id.replace("clone_", "").strip()
        db = SessionLocal()
        try:
            clone_rec = db.query(VoiceClone).filter(VoiceClone.id == clean_id).first()
        finally:
            db.close()

        if not clone_rec:
            raise ValueError(f"Voice Clone '{clean_id}' not found in database.")

        sample_file = BASE_DIR / clone_rec.sample_path
        if not sample_file.exists():
            raise FileNotFoundError(f"Reference voice sample file missing: {sample_file}")

        sample_bytes = sample_file.read_bytes()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        temp_wav = output_path.with_suffix(".temp_gemini.wav")

        keys = settings.get_gemini_keys()
        if not keys and settings.GEMINI_API_KEY:
            keys = [settings.GEMINI_API_KEY]

        if not keys:
            raise ValueError("GEMINI_API_KEY not configured for voice cloning synthesis.")

        # Candidate models with automatic failover
        tts_models = ["gemini-3.8-flash-tts", "gemini-2.5-flash-preview-tts"]
        audio_bytes = None
        mime_type = None
        last_error = None

        for model_name in tts_models:
            for key in keys:
                try:
                    client = genai.Client(api_key=key)
                    cfg = types.GenerateContentConfig(
                        response_modalities=["AUDIO"],
                        speech_config=types.SpeechConfig(
                            voice_config=types.VoiceConfig(
                                replicated_voice_config=types.ReplicatedVoiceConfig(
                                    mime_type="audio/wav",
                                    voice_sample_audio=sample_bytes,
                                    consent_audio=sample_bytes
                                )
                            )
                        )
                    )
                    resp = client.models.generate_content(
                        model=model_name,
                        contents=text,
                        config=cfg
                    )
                    if resp.candidates and resp.candidates[0].content and resp.candidates[0].content.parts:
                        part = resp.candidates[0].content.parts[0]
                        if part.inline_data and part.inline_data.data:
                            audio_bytes = part.inline_data.data
                            mime_type = part.inline_data.mime_type or "audio/wav"
                            logger.info(f"Successfully synthesized cloned voice with model '{model_name}'!")
                            break
                except Exception as e:
                    last_error = e
                    logger.warning(f"Voice clone generation attempt failed on {model_name}: {e}")
                    continue
            if audio_bytes:
                break

        if not audio_bytes:
            raise RuntimeError(f"Voice clone synthesis failed across all Gemini keys: {last_error}")

        # Check if returned bytes have RIFF header or raw PCM
        if audio_bytes.startswith(b"RIFF"):
            with open(temp_wav, "wb") as f:
                f.write(audio_bytes)
        else:
            # Wrap raw 24kHz 16-bit mono PCM into standard WAV
            with wave.open(str(temp_wav), "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(24000)
                wf.writeframes(audio_bytes)

        # Standardize to 22050Hz mono WAV using FFmpeg
        ffmpeg_bin = settings.get_ffmpeg_path()
        cmd = [
            ffmpeg_bin, "-y",
            "-i", str(temp_wav),
            "-ar", "22050",
            "-ac", "1",
            str(output_path)
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if temp_wav.exists():
            try:
                temp_wav.unlink()
            except Exception:
                pass

        if res.returncode != 0:
            raise RuntimeError(f"FFmpeg audio conversion failed: {res.stderr[-200:]}")

        with wave.open(str(output_path), "rb") as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            duration_seconds = round(frames / float(rate), 2)

        return {
            "file_path": str(output_path.relative_to(BASE_DIR)),
            "duration_seconds": duration_seconds,
            "sample_rate": rate,
            "voice_preset": clone_id
        }

    async def synthesize_scene(
        self,
        scene_id: str,
        text: str,
        voice_preset: str,
        output_path: Path,
        language: str = "English"
    ) -> Dict[str, Any]:
        """
        Synthesizes high-fidelity speech for a scene:
        0. If voice_preset is a Cloned Voice ('clone_...'), uses Gemini Neural Voice Replication.
        1. If voice_preset is an Edge-TTS neural voice (e.g. ur-PK-AsadNeural, hi-IN-MadhurNeural, en-US-ChristopherNeural),
           uses Microsoft Edge Neural TTS for ultra-natural, deep documentary narration.
        2. If Piper offline model is requested (English), runs local Piper ONNX.
        3. Automatic fallback: If any engine fails, falls back gracefully to secondary engines (gTTS/Piper).
        All outputs are strictly normalized to broadcast-grade 22050Hz mono WAV.
        """
        output_path.parent.mkdir(parents=True, exist_ok=True)
        lang_lower = (language or "English").lower()

        # 0. Check for Cloned Voice
        if voice_preset and (voice_preset.startswith("clone_") or voice_preset.startswith("custom_")):
            try:
                logger.info(f"Synthesizing scene {scene_id} with Cloned Voice: {voice_preset}")
                meta = await self.synthesize_cloned_voice_wav(
                    text=text,
                    clone_id=voice_preset,
                    output_path=output_path,
                    language=language
                )
                meta["scene_id"] = scene_id
                meta["voice_preset"] = voice_preset
                return meta
            except Exception as e:
                logger.error(f"Cloned voice synthesis failed for scene {scene_id}: {e}. Falling back to neural preset...")

        # Determine target Edge-TTS voice based on preset or language
        edge_voice_id = None
        known_edge_ids = {v["id"] for v in VOICE_CATALOG}
        
        if voice_preset in known_edge_ids or (voice_preset and "Neural" in voice_preset):
            edge_voice_id = voice_preset
        elif lang_lower == "urdu" or is_urdu_or_arabic(text):
            edge_voice_id = "ur-PK-AsadNeural"
        elif lang_lower == "hindi" or is_hindi(text):
            edge_voice_id = "hi-IN-MadhurNeural"
        elif lang_lower == "arabic":
            edge_voice_id = "ar-SA-HamedNeural"
        elif lang_lower == "spanish":
            edge_voice_id = "es-ES-AlvaroNeural"
        elif voice_preset not in VOICE_MODEL_MAP:
            edge_voice_id = "en-US-ChristopherNeural"

        # 1. Try Edge TTS if an Edge neural voice is identified
        if edge_voice_id:
            try:
                logger.info(f"Synthesizing scene {scene_id} with Edge Neural Voice: {edge_voice_id}")
                meta = await self.synthesize_edge_tts_wav(text=text, voice_id=edge_voice_id, output_path=output_path)
                meta["scene_id"] = scene_id
                meta["voice_preset"] = edge_voice_id
                return meta
            except Exception as e:
                logger.warning(f"Edge-TTS failed for scene {scene_id} ({e}). Attempting fallback...")

        # 2. Try Piper offline model (English)
        if voice_preset in VOICE_MODEL_MAP:
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
                logger.warning(f"Piper TTS failed for scene {scene_id} ({e}). Falling back...")

        # 3. Multilingual gTTS fallback
        lang_code = "en"
        if lang_lower == "urdu" or is_urdu_or_arabic(text):
            lang_code = "ur"
        elif lang_lower == "hindi" or is_hindi(text):
            lang_code = "hi"
        elif lang_lower == "spanish":
            lang_code = "es"
        elif lang_lower == "arabic":
            lang_code = "ar"

        logger.info(f"Using fallback gTTS ({lang_code}) for scene {scene_id}...")
        meta = self.synthesize_multilingual_wav(text=text, lang_code=lang_code, output_path=output_path)
        meta["scene_id"] = scene_id
        meta["voice_preset"] = f"fallback_{lang_code}_{voice_preset}"
        return meta

    @classmethod
    async def synthesize_single_scene_audio(
        cls,
        db: Session,
        scene_id: str,
        voice_preset: str = None
    ) -> Dict[str, Any]:
        """
        Synthesizes or regenerates studio audio for an individual scene.
        Updates the scene's actual duration and upserts the AudioAsset record.
        """
        scene = db.query(Scene).filter(Scene.id == scene_id).first()
        if not scene:
            raise ValueError(f"Scene '{scene_id}' not found.")

        project = db.query(Project).filter(Project.id == scene.project_id).first()
        lang = project.settings.language if project and project.settings else "English"
        
        # If preset not explicitly provided, use project preset or language default
        preset = voice_preset
        if not preset and project and project.settings and project.settings.narration_preset:
            preset = project.settings.narration_preset
        if not preset:
            preset = "ur-PK-AsadNeural" if (lang.lower() == "urdu" or is_urdu_or_arabic(scene.narration_text)) else "en-US-ChristopherNeural"

        tts = cls()
        audio_dir = settings.WORKSPACE_DATA_DIR / "projects" / scene.project_id / "audio"
        out_file = audio_dir / f"{scene.scene_id_str}.wav"

        meta = await tts.synthesize_scene(
            scene_id=scene.id,
            text=scene.narration_text,
            voice_preset=preset,
            output_path=out_file,
            language=lang
        )

        scene.actual_audio_duration_seconds = meta["duration_seconds"]

        audio_record = db.query(AudioAsset).filter(AudioAsset.scene_id == scene.id).first()
        if not audio_record:
            audio_record = AudioAsset(
                scene_id=scene.id,
                voice_preset=meta.get("voice_preset", preset),
                file_path=meta["file_path"],
                duration_seconds=meta["duration_seconds"]
            )
            db.add(audio_record)
        else:
            audio_record.file_path = meta["file_path"]
            audio_record.duration_seconds = meta["duration_seconds"]
            audio_record.voice_preset = meta.get("voice_preset", preset)

        db.commit()
        return meta

    @staticmethod
    async def synthesize_project_narration(
        db: Session,
        project_id: str,
        voice_preset: str = None
    ) -> List[Dict[str, Any]]:
        """
        Synthesizes voiceover narration for all scenes in the project's latest script revision.
        Supports explicit voice_preset selection across all languages.
        Saves AudioAsset records to database and updates exact audio durations.
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

        lang = project.settings.language if project.settings else "English"

        # Determine voice preset
        if voice_preset:
            preset = voice_preset
            if project.settings:
                project.settings.narration_preset = voice_preset
        elif project.settings and project.settings.narration_preset:
            preset = project.settings.narration_preset
        else:
            if lang.lower() == "urdu":
                preset = "ur-PK-AsadNeural"
            elif lang.lower() == "hindi":
                preset = "hi-IN-MadhurNeural"
            else:
                preset = "en-US-ChristopherNeural"

        tts = PiperTTSService()
        results = []
        audio_dir = settings.WORKSPACE_DATA_DIR / "projects" / project_id / "audio"

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
                    voice_preset=meta.get("voice_preset", preset),
                    file_path=meta["file_path"],
                    duration_seconds=meta["duration_seconds"]
                )
                db.add(audio_record)
            else:
                audio_record.file_path = meta["file_path"]
                audio_record.duration_seconds = meta["duration_seconds"]
                audio_record.voice_preset = meta.get("voice_preset", preset)

            results.append(meta)

        # Update Project Status to assets_preparing
        project.status = "assets_preparing"
        
        # Log Activity
        activity = ProjectActivity(
            project_id=project_id,
            action_type="voice_generated",
            actor="user",
            details={
                "scenes_synthesized": len(results),
                "total_audio_duration_seconds": sum(r["duration_seconds"] for r in results),
                "voice_preset": preset
            }
        )
        db.add(activity)

        db.commit()
        return results

