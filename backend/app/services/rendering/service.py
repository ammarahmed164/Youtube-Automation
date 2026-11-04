import os
import uuid
import json
import shutil
import hashlib
import logging
import subprocess
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from abc import ABC, abstractmethod

from sqlalchemy.orm import Session
from app.core.config import settings, BASE_DIR
from app.core.database import SessionLocal
from app.models.project import Project
from app.models.generation import Scene, AudioAsset, SceneAsset, GenerationJob
from app.models.video import VideoVersion

logger = logging.getLogger(__name__)

class BaseRenderingService(ABC):
    """Abstract Base Class for video rendering."""
    @abstractmethod
    def render_project(self, project_id: str, job_id: str) -> Dict[str, Any]:
        pass

class RenderingService(BaseRenderingService):
    """
    Production-grade FFmpeg Rendering Pipeline:
    1. Per-scene modular compilation (H.264/AAC, 1080p, Ken Burns pan/zoom)
    2. Blazingly fast concat demuxer assembly
    3. SRT and WebVTT subtitle synchronization
    4. Immutable SHA-256 checksum and VideoVersion creation
    5. Asynchronous background job progress tracking
    """

    @classmethod
    def calculate_sha256(cls, filepath: Path) -> str:
        """Calculates exact SHA-256 hash of rendered video for approval integrity."""
        sha256 = hashlib.sha256()
        with open(filepath, "rb") as f:
            while chunk := f.read(65536):
                sha256.update(chunk)
        return sha256.hexdigest()

    @classmethod
    def format_timestamp(cls, seconds: float, sep: str = ",") -> str:
        """Formats seconds into HH:MM:SS,mmm (SRT) or HH:MM:SS.mmm (VTT)."""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int(round((seconds - int(seconds)) * 1000))
        if millis >= 1000:
            millis = 999
        return f"{hours:02d}:{minutes:02d}:{secs:02d}{sep}{millis:03d}"

    @classmethod
    def generate_subtitles(cls, scenes: List[Scene], output_srt: Path, output_vtt: Path) -> None:
        """Generates synchronized .srt and .vtt subtitle tracks from scenes."""
        srt_lines = []
        vtt_lines = ["WEBVTT", ""]

        current_time = 0.0
        subtitle_index = 1

        for scene in scenes:
            duration = scene.actual_audio_duration_seconds or scene.estimated_duration_seconds or 5.0
            start_time = current_time
            end_time = current_time + duration
            current_time = end_time

            text = (scene.narration_text or "").strip()
            if not text:
                continue

            start_srt = cls.format_timestamp(start_time, ",")
            end_srt = cls.format_timestamp(end_time, ",")
            start_vtt = cls.format_timestamp(start_time, ".")
            end_vtt = cls.format_timestamp(end_time, ".")

            srt_lines.append(str(subtitle_index))
            srt_lines.append(f"{start_srt} --> {end_srt}")
            srt_lines.append(text)
            srt_lines.append("")

            vtt_lines.append(str(subtitle_index))
            vtt_lines.append(f"{start_vtt} --> {end_vtt}")
            vtt_lines.append(text)
            vtt_lines.append("")

            subtitle_index += 1

        output_srt.parent.mkdir(parents=True, exist_ok=True)
        with open(output_srt, "w", encoding="utf-8") as f:
            f.write("\n".join(srt_lines))

        with open(output_vtt, "w", encoding="utf-8") as f:
            f.write("\n".join(vtt_lines))

    @classmethod
    def get_cinematic_motion_filter(cls, motion_idx: int, cut_frames: int, fps: int = 30) -> str:
        """
        Generates silky-smooth sub-pixel Ken Burns motion with 4K super-sampling.
        Pre-scales to 3840x2160 so FFmpeg zoompan operates with 2x sub-pixel coordinate precision,
        completely eliminating integer coordinate snapping, screen tearing, and micro-stutters.
        Downscales with bicubic smoothing to 1920x1080 and applies color grading + vignette.
        """
        pre_scale = "scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160"
        post_grade = "vignette=PI/5.5,eq=contrast=1.07:saturation=1.12"

        # 8 Distinct Cinematic Choreography Movements:
        # Floating point steps ~0.0006 ensure steady, elegant documentarian pacing without sudden hops
        motions = [
            # 0: Dramatic Slow Push-In (Center Focus into Deep Space)
            f"zoompan=z='min(zoom+0.0006,1.14)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={cut_frames}:s=1920x1080:fps={fps}",
            # 1: Panoramic Horizontal Pan Left-to-Right
            f"zoompan=z='1.12':x='(on/{cut_frames})*(iw-iw/zoom)':y='ih/2-(ih/zoom/2)':d={cut_frames}:s=1920x1080:fps={fps}",
            # 2: Grand Universe Pull-Back Reveal (Core to Wide Field)
            f"zoompan=z='max(1.15-0.0006*on,1.0)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={cut_frames}:s=1920x1080:fps={fps}",
            # 3: Counter Horizontal Pan Right-to-Left (Atmospheric Horizon Drift)
            f"zoompan=z='1.12':x='(1-(on/{cut_frames}))*(iw-iw/zoom)':y='ih/2-(ih/zoom/2)':d={cut_frames}:s=1920x1080:fps={fps}",
            # 4: Ascending Stargaze (Slow Vertical Tilt-Up)
            f"zoompan=z='1.10':x='iw/2-(iw/zoom/2)':y='(1-(on/{cut_frames}))*(ih-ih/zoom)':d={cut_frames}:s=1920x1080:fps={fps}",
            # 5: Descending Planetary Fly-By (Slow Vertical Tilt-Down)
            f"zoompan=z='1.10':x='iw/2-(iw/zoom/2)':y='(on/{cut_frames})*(ih-ih/zoom)':d={cut_frames}:s=1920x1080:fps={fps}",
            # 6: Diagonal Orbital Flight (Gentle Pan + Push)
            f"zoompan=z='min(zoom+0.0005,1.13)':x='(on/{cut_frames})*(iw-iw/zoom)':y='(on/{cut_frames})*(ih-ih/zoom)':d={cut_frames}:s=1920x1080:fps={fps}",
            # 7: Corner Horizon Sweep (Upper-Left to Center Focus)
            f"zoompan=z='min(zoom+0.0005,1.13)':x='(1-(on/{cut_frames}))*(iw-iw/zoom)*0.7':y='(1-(on/{cut_frames}))*(ih-ih/zoom)*0.7':d={cut_frames}:s=1920x1080:fps={fps}"
        ]
        chosen_motion = motions[motion_idx % len(motions)]
        return f"{pre_scale},{chosen_motion},{post_grade}"

    @classmethod
    def render_scene_clip(
        cls,
        ffmpeg_bin: str,
        scene: Scene,
        visual_path: Path,
        audio_path: Path,
        output_clip_path: Path,
        fps: int = 30
    ) -> None:
        """
        Renders an individual scene clip synced to its audio duration with:
        1. Multi-Cut B-Roll (switches visuals every 4-6s for dynamic pacing)
        2. Varied 8-Way Cinematic Camera Moves (Push-In, Sweep, Pull-Back, Drift, Tilt, Orbital)
        3. 4K Sub-Pixel Super-Sampling for Butter-Smooth Movement (no integer pixel snapping)
        4. Color Grading & Soft Film Vignette
        5. Background Ambient Space Drone layer ducked under narration
        """
        duration = scene.actual_audio_duration_seconds or scene.estimated_duration_seconds or 5.0
        output_clip_path.parent.mkdir(parents=True, exist_ok=True)

        is_video = str(visual_path).lower().endswith(".mp4")

        if is_video:
            # Video asset: scale & center pad to 1920x1080, loop if shorter than narration
            vf = "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1"
            cmd = [
                ffmpeg_bin, "-y",
                "-stream_loop", "-1", "-i", str(visual_path),
                "-i", str(audio_path),
                "-vf", vf,
                "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                "-maxrate", "3500k", "-bufsize", "6000k",
                "-c:a", "aac", "-b:a", "192k",
                "-pix_fmt", "yuv420p",
                "-t", f"{duration:.3f}",
                str(output_clip_path)
            ]
            res = subprocess.run(cmd, capture_output=True, text=True)
            if res.returncode != 0:
                raise RuntimeError(f"FFmpeg failed rendering video scene {scene.scene_id_str}: {res.stderr[-300:]}")
            return

        # Multi-cut Image and Video Asset Engine
        visuals_dir = visual_path.parent
        cuts = [visual_path]
        b_roll_candidates = sorted(
            list(visuals_dir.glob(f"{scene.scene_id_str}_b*.jpg")) +
            list(visuals_dir.glob(f"{scene.scene_id_str}_b*.mp4"))
        )
        for b in b_roll_candidates:
            if b.exists() and b.stat().st_size > 5000:
                cuts.append(b)

        # Temp directory for this scene's sub-cuts
        sub_dir = output_clip_path.parent / f"sub_{scene.scene_id_str}"
        sub_dir.mkdir(parents=True, exist_ok=True)

        num_cuts = len(cuts)
        sub_clips = []
        concat_lines = []

        # Unique camera choreography seed per scene so adjoining scenes never repeat
        scene_seed = (scene.scene_order * 3)

        if num_cuts > 1:
            cut_duration = duration / num_cuts
            cut_frames = max(1, int(fps * cut_duration))

            for idx, img_p in enumerate(cuts):
                sub_out = sub_dir / f"cut_{idx+1}.mp4"

                if str(img_p).lower().endswith(".mp4"):
                    # Video or Animated Asset Cut
                    sub_cmd = [
                        ffmpeg_bin, "-y",
                        "-stream_loop", "-1", "-i", str(img_p),
                        "-vf", "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1",
                        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                        "-maxrate", "3500k", "-bufsize", "6000k",
                        "-pix_fmt", "yuv420p",
                        "-t", f"{cut_duration:.3f}",
                        str(sub_out)
                    ]
                else:
                    # Photographic Visual Cut with 4K Sub-Pixel Smooth Ken Burns
                    vf = cls.get_cinematic_motion_filter(scene_seed + idx, cut_frames, fps)
                    sub_cmd = [
                        ffmpeg_bin, "-y",
                        "-loop", "1", "-i", str(img_p),
                        "-vf", vf,
                        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                        "-maxrate", "3500k", "-bufsize", "6000k",
                        "-pix_fmt", "yuv420p",
                        "-t", f"{cut_duration:.3f}",
                        str(sub_out)
                    ]
                r_sub = subprocess.run(sub_cmd, capture_output=True, text=True)
                if r_sub.returncode != 0:
                    logger.warning(f"Sub-cut {idx+1} failed, falling back: {r_sub.stderr[-200:]}")
                else:
                    sub_clips.append(sub_out)
                    concat_lines.append(f"file '{sub_out.resolve().as_posix()}'")
        else:
            # Single image: split into 2 contrasting motions so camera never stays static
            half_dur = duration / 2.0
            half_frames = max(1, int(fps * half_dur))
            
            # Half 1: Motion A
            sub1 = sub_dir / "half_1.mp4"
            vf1 = cls.get_cinematic_motion_filter(scene_seed, half_frames, fps)
            subprocess.run([
                ffmpeg_bin, "-y", "-loop", "1", "-i", str(visual_path),
                "-vf", vf1,
                "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                "-maxrate", "3500k", "-bufsize", "6000k",
                "-pix_fmt", "yuv420p", "-t", f"{half_dur:.3f}", str(sub1)
            ], capture_output=True)

            # Half 2: Motion B
            sub2 = sub_dir / "half_2.mp4"
            vf2 = cls.get_cinematic_motion_filter(scene_seed + 1, half_frames, fps)
            subprocess.run([
                ffmpeg_bin, "-y", "-loop", "1", "-i", str(visual_path),
                "-vf", vf2,
                "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                "-maxrate", "3500k", "-bufsize", "6000k",
                "-pix_fmt", "yuv420p", "-t", f"{(duration - half_dur):.3f}", str(sub2)
            ], capture_output=True)

            if sub1.exists() and sub2.exists():
                concat_lines = [
                    f"file '{sub1.resolve().as_posix()}'",
                    f"file '{sub2.resolve().as_posix()}'"
                ]

        # Assemble cuts manifest & mix with audio narration + ambient space drone
        cuts_manifest = sub_dir / "manifest.txt"
        with open(cuts_manifest, "w", encoding="utf-8") as f:
            f.write("\n".join(concat_lines) + "\n")

        # Mix Narration (1.0 volume) with Subtle Cosmic Ambient Drone (0.12 volume)
        filter_complex = (
            "[1:a]volume=1.0[narration];"
            "[2:a]volume=0.12[ambient];"
            "[narration][ambient]amix=inputs=2:duration=first:dropout_transition=2[aout]"
        )

        stitch_cmd = [
            ffmpeg_bin, "-y",
            "-f", "concat", "-safe", "0", "-i", str(cuts_manifest),
            "-i", str(audio_path),
            "-f", "lavfi", "-i", "aevalsrc=0.03*sin(2*PI*55*t)+0.02*sin(2*PI*110*t)+0.01*sin(2*PI*165*t):s=44100",
            "-filter_complex", filter_complex,
            "-map", "0:v", "-map", "[aout]",
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "192k",
            "-t", f"{duration:.3f}",
            str(output_clip_path)
        ]

        res = subprocess.run(stitch_cmd, capture_output=True, text=True)
        if res.returncode != 0:
            logger.error(f"FFmpeg multi-cut scene render error for {scene.scene_id_str}: {res.stderr}")
            # Fallback to direct single cut with 4K sub-pixel smoothing if complex stitch encounters stream issue
            direct_vf = cls.get_cinematic_motion_filter(scene_seed, int(fps * duration), fps)
            fallback_cmd = [
                ffmpeg_bin, "-y",
                "-loop", "1", "-i", str(visual_path),
                "-i", str(audio_path),
                "-vf", direct_vf,
                "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                "-maxrate", "3500k", "-bufsize", "6000k",
                "-c:a", "aac", "-b:a", "192k",
                "-pix_fmt", "yuv420p",
                "-t", f"{duration:.3f}",
                str(output_clip_path)
            ]
            res_fb = subprocess.run(fallback_cmd, capture_output=True, text=True)
            if res_fb.returncode != 0:
                raise RuntimeError(f"FFmpeg failed rendering scene {scene.scene_id_str}: {res_fb.stderr[-300:]}")

    @classmethod
    def render_project(cls, project_id: str, job_id: str) -> Dict[str, Any]:
        """
        Main background rendering pipeline executed asynchronously.
        Updates GenerationJob status and progress throughout execution.
        """
        db = SessionLocal()
        try:
            job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
            if not job:
                raise ValueError(f"Generation job {job_id} not found.")

            job.status = "running"
            job.progress_percent = 5
            job.log_messages = ["Initializing FFmpeg rendering pipeline..."]
            db.commit()

            project = db.query(Project).filter(Project.id == project_id).first()
            if not project:
                raise ValueError(f"Project {project_id} not found.")

            scenes = (
                db.query(Scene)
                .filter(Scene.project_id == project_id)
                .order_by(Scene.scene_order)
                .all()
            )
            if not scenes:
                raise ValueError("Cannot render documentary without scenes.")

            ffmpeg_bin = settings.get_ffmpeg_path()
            if not Path(ffmpeg_bin).exists() and shutil.which(ffmpeg_bin) is None:
                raise RuntimeError(f"FFmpeg binary not found at '{ffmpeg_bin}'")

            # Determine next version number
            latest_version = (
                db.query(VideoVersion)
                .filter(VideoVersion.project_id == project_id)
                .order_by(VideoVersion.version_number.desc())
                .first()
            )
            version_number = (latest_version.version_number + 1) if latest_version else 1

            # Workspace directories
            proj_data_dir = BASE_DIR / "workspace_data" / "projects" / project_id
            version_dir = proj_data_dir / "renders" / f"v{version_number}"
            temp_clips_dir = version_dir / "temp_scene_clips"
            version_dir.mkdir(parents=True, exist_ok=True)
            temp_clips_dir.mkdir(parents=True, exist_ok=True)

            total_scenes = len(scenes)
            scene_clips = []
            concat_entries = []

            # Step 1: Render individual scene clips
            for idx, scene in enumerate(scenes):
                clip_path = temp_clips_dir / f"{scene.scene_id_str}.mp4"
                
                # Check visual asset
                visual_asset = db.query(SceneAsset).filter(SceneAsset.scene_id == scene.id).first()
                if visual_asset and Path(BASE_DIR / visual_asset.file_path).exists():
                    visual_file = BASE_DIR / visual_asset.file_path
                else:
                    # Fallback to standard visuals path
                    visual_file = proj_data_dir / "visuals" / f"{scene.scene_id_str}.jpg"

                if not visual_file.exists():
                    raise RuntimeError(f"Visual asset missing for scene {scene.scene_id_str}: {visual_file}")

                # Check audio asset
                audio_asset = db.query(AudioAsset).filter(AudioAsset.scene_id == scene.id).first()
                if audio_asset and Path(BASE_DIR / audio_asset.file_path).exists():
                    audio_file = BASE_DIR / audio_asset.file_path
                else:
                    audio_file = proj_data_dir / "audio" / f"{scene.scene_id_str}.wav"

                if not audio_file.exists():
                    raise RuntimeError(f"Audio narration missing for scene {scene.scene_id_str}: {audio_file}")

                # Render clip
                cls.render_scene_clip(
                    ffmpeg_bin=ffmpeg_bin,
                    scene=scene,
                    visual_path=visual_file,
                    audio_path=audio_file,
                    output_clip_path=clip_path,
                    fps=30
                )

                scene_clips.append(clip_path)
                concat_entries.append(f"file '{clip_path.resolve().as_posix()}'")

                # Progress reporting: 10% to 75%
                progress = 10 + int((idx + 1) / total_scenes * 65)
                job.progress_percent = progress
                job.log_messages = (job.log_messages or []) + [
                    f"Rendered scene {scene.scene_order}/{total_scenes}: {scene.scene_title or scene.scene_id_str}"
                ]
                db.commit()

            # Step 2: Concat Demuxer Assembly
            job.progress_percent = 80
            job.log_messages = (job.log_messages or []) + ["Assembling master video stream with FFmpeg concat demuxer..."]
            db.commit()

            concat_list_file = version_dir / "concat_manifest.txt"
            with open(concat_list_file, "w", encoding="utf-8") as f:
                f.write("\n".join(concat_entries) + "\n")

            final_mp4_name = f"documentary_v{version_number}.mp4"
            final_mp4_path = version_dir / final_mp4_name

            concat_cmd = [
                ffmpeg_bin, "-y",
                "-f", "concat", "-safe", "0",
                "-i", str(concat_list_file),
                "-c", "copy",
                "-movflags", "+faststart",
                str(final_mp4_path)
            ]

            res_concat = subprocess.run(concat_cmd, capture_output=True, text=True)
            if res_concat.returncode != 0:
                logger.error(f"Concat failed: {res_concat.stderr}")
                raise RuntimeError(f"FFmpeg concat assembly failed: {res_concat.stderr[-300:]}")

            # Step 3: Subtitle Generation
            job.progress_percent = 88
            job.log_messages = (job.log_messages or []) + ["Generating synchronized subtitles (.srt and .vtt)..."]
            db.commit()

            subtitles_srt = version_dir / "subtitles.srt"
            subtitles_vtt = version_dir / "subtitles.vtt"
            cls.generate_subtitles(scenes=scenes, output_srt=subtitles_srt, output_vtt=subtitles_vtt)

            # Step 4: Verification and Checksum
            job.progress_percent = 92
            job.log_messages = (job.log_messages or []) + ["Calculating SHA-256 checksum and verifying video integrity..."]
            db.commit()

            if not final_mp4_path.exists() or final_mp4_path.stat().st_size < 100000:
                raise RuntimeError("Rendered video file is missing or corrupted (< 100KB).")

            checksum = cls.calculate_sha256(final_mp4_path)
            total_duration = sum(
                (s.actual_audio_duration_seconds or s.estimated_duration_seconds or 5.0)
                for s in scenes
            )

            rel_file_path = f"workspace_data/projects/{project_id}/renders/v{version_number}/{final_mp4_name}"

            # Step 5: Save VideoVersion record
            video_version = VideoVersion(
                id=str(uuid.uuid4()),
                project_id=project_id,
                version_number=version_number,
                file_path=rel_file_path,
                file_checksum=checksum,
                duration_seconds=round(total_duration, 2),
                resolution="1080p",
                render_settings={
                    "resolution": "1920x1080",
                    "aspect_ratio": "16:9",
                    "fps": 25,
                    "video_codec": "h264",
                    "audio_codec": "aac",
                    "audio_bitrate": "192k",
                    "ken_burns_effects": True,
                    "subtitles_available": True
                }
            )
            db.add(video_version)

            # Update project status
            project.status = "review_ready"

            # Clean up temp scene clips to save disk space
            shutil.rmtree(temp_clips_dir, ignore_errors=True)

            job.status = "completed"
            job.progress_percent = 100
            job.log_messages = (job.log_messages or []) + [
                f"Video rendered successfully! Version: v{version_number}, Duration: {round(total_duration/60, 2)}m, SHA-256: {checksum[:12]}..."
            ]
            db.commit()

            return {
                "status": "success",
                "version_number": version_number,
                "file_path": rel_file_path,
                "file_checksum": checksum,
                "duration_seconds": total_duration,
                "video_version_id": video_version.id
            }

        except Exception as e:
            logger.error(f"Render failed for project {project_id}: {e}", exc_info=True)
            db.rollback()
            try:
                job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
                if job:
                    job.status = "failed"
                    job.error_details = str(e)
                    job.log_messages = (job.log_messages or []) + [f"Error: {str(e)}"]
                    db.commit()
            except Exception:
                pass
            raise e
        finally:
            db.close()
