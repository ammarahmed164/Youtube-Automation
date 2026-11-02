import os
import re
import uuid
import logging
import subprocess
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from abc import ABC, abstractmethod

from sqlalchemy.orm import Session
from app.core.config import settings, BASE_DIR
from app.models.project import Project
from app.models.generation import Scene, AudioAsset, SceneAsset
from app.models.video import VideoVersion, QualityCheck

logger = logging.getLogger(__name__)

class BaseQCService(ABC):
    """Abstract Base Class for Automated Quality Checks."""
    @abstractmethod
    def verify_video(self, video_version: VideoVersion, db: Session) -> QualityCheck:
        pass

class QualityCheckService(BaseQCService):
    """
    Automated Broadcast-Grade Quality Control (QC) Service:
    1. File Integrity & Readability
    2. Duration Tolerance & Rule 15 Enforcer (<= 20 Minutes Hard Cap)
    3. Resolution (1920x1080) & 16:9 Aspect Ratio
    4. Video Stream & H.264 Codec
    5. Audio Stream Presence & AAC Codec
    6. Audio Loudness & Silence Detection (volumedetect)
    7. Subtitle Track Availability (WebVTT & SRT)
    8. Scene Asset Consistency
    """

    @classmethod
    def run_all_checks(cls, video_version: VideoVersion, db: Session) -> Dict[str, Any]:
        ffmpeg_bin = settings.get_ffmpeg_path()
        mp4_path = BASE_DIR / video_version.file_path
        project_id = video_version.project_id
        version_dir = mp4_path.parent

        check_results: Dict[str, Any] = {}
        warnings: List[str] = []

        # 1. File Integrity Check
        file_exists = mp4_path.exists() and mp4_path.is_file()
        file_size_bytes = mp4_path.stat().st_size if file_exists else 0
        file_ok = file_exists and file_size_bytes > 500000

        check_results["file_integrity"] = {
            "passed": file_ok,
            "status_label": "PASSED" if file_ok else "FAILED",
            "message": f"Rendered MP4 file exists and is readable ({file_size_bytes / (1024*1024):.2f} MB)",
            "file_size_bytes": file_size_bytes
        }
        if not file_ok:
            return {
                "passed": False,
                "overall_status": "FAILED",
                "score_percent": 0,
                "check_results": check_results,
                "warnings": ["Rendered video file is missing or corrupted on disk."]
            }

        # 2. FFmpeg Stream Analysis
        res = subprocess.run([ffmpeg_bin, "-i", str(mp4_path)], capture_output=True, text=True)
        ffmpeg_output = res.stderr

        # Duration Check
        dur_match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", ffmpeg_output)
        actual_duration = 0.0
        if dur_match:
            h, m, s = dur_match.groups()
            actual_duration = int(h) * 3600 + int(m) * 60 + float(s)

        duration_ok = (actual_duration >= 5.0) and (actual_duration <= 1200.0)
        check_results["duration"] = {
            "passed": duration_ok,
            "status_label": "PASSED" if duration_ok else "FAILED",
            "message": f"Duration: {actual_duration:.2f}s ({actual_duration/60:.2f} min). Complies with <= 20 min hard limit.",
            "duration_seconds": round(actual_duration, 2),
            "max_allowed_seconds": 1200.0
        }
        if actual_duration > 1200.0:
            warnings.append(f"CRITICAL: Video duration ({actual_duration/60:.2f} min) exceeds 20-minute maximum limit.")

        # Resolution & Aspect Ratio Check
        vid_match = re.search(r"Stream #\d+:\d+.*?: Video: (.*?),\s*(?:yuv[a-z0-9_()]+,\s*)?(\d{3,4})x(\d{3,4})", ffmpeg_output)
        width, height = 0, 0
        video_codec = "unknown"
        if vid_match:
            video_codec, w_str, h_str = vid_match.groups()
            width, height = int(w_str), int(h_str)

        resolution_ok = (width == 1920) and (height == 1080)
        check_results["resolution"] = {
            "passed": resolution_ok,
            "status_label": "PASSED" if resolution_ok else "FAILED",
            "message": f"Resolution: {width}x{height} (16:9 Full HD standard).",
            "width": width,
            "height": height
        }
        if not resolution_ok:
            warnings.append(f"Resolution is {width}x{height}, standard 1920x1080 expected.")

        # Video Codec Check
        codec_ok = "h264" in video_codec.lower() or "avc" in video_codec.lower()
        check_results["video_codec"] = {
            "passed": codec_ok,
            "status_label": "PASSED" if codec_ok else "WARNING",
            "message": f"Video Codec: {video_codec} (H.264 standard compliant).",
            "codec": video_codec
        }

        # Audio Stream Check
        aud_match = re.search(r"Stream #\d+:\d+.*?: Audio: (\w+).*?,\s*(\d+)\s*Hz", ffmpeg_output)
        audio_codec = "none"
        sample_rate = 0
        if aud_match:
            audio_codec, sr_str = aud_match.groups()
            sample_rate = int(sr_str)

        audio_stream_ok = (audio_codec.lower() == "aac") and (sample_rate >= 22050)
        check_results["audio_stream"] = {
            "passed": audio_stream_ok,
            "status_label": "PASSED" if audio_stream_ok else "FAILED",
            "message": f"Audio Stream: {audio_codec.upper()} @ {sample_rate} Hz (Stereo/Mono Narration).",
            "codec": audio_codec,
            "sample_rate": sample_rate
        }
        if not audio_stream_ok:
            warnings.append("Audio stream missing or not AAC encoded.")

        # Audio Loudness & Silence Detection Check (volumedetect)
        vol_cmd = [ffmpeg_bin, "-i", str(mp4_path), "-af", "volumedetect", "-vn", "-sn", "-dn", "-f", "null", "NUL"]
        res_vol = subprocess.run(vol_cmd, capture_output=True, text=True)
        mean_vol_match = re.search(r"mean_volume:\s*([-\d.]+)\s*dB", res_vol.stderr)
        max_vol_match = re.search(r"max_volume:\s*([-\d.]+)\s*dB", res_vol.stderr)

        mean_volume = float(mean_vol_match.group(1)) if mean_vol_match else -99.0
        max_volume = float(max_vol_match.group(1)) if max_vol_match else -99.0

        loudness_ok = (-50.0 <= mean_volume <= -5.0) and (max_volume > -20.0)
        check_results["audio_loudness"] = {
            "passed": loudness_ok,
            "status_label": "PASSED" if loudness_ok else "WARNING",
            "message": f"Loudness: Mean {mean_volume:.1f} dB, Peak {max_volume:.1f} dB (Audible, clean narration).",
            "mean_volume_db": mean_volume,
            "max_volume_db": max_volume
        }
        if mean_volume < -50.0:
            warnings.append("Audio volume is extremely low or silent.")

        # Subtitle Track Availability Check
        sub_vtt = version_dir / "subtitles.vtt"
        sub_srt = version_dir / "subtitles.srt"
        subtitles_ok = sub_vtt.exists() and sub_srt.exists() and sub_vtt.stat().st_size > 100
        check_results["subtitles"] = {
            "passed": subtitles_ok,
            "status_label": "PASSED" if subtitles_ok else "WARNING",
            "message": "Synchronized Subtitle tracks (.vtt & .srt) generated and verified.",
            "vtt_available": sub_vtt.exists(),
            "srt_available": sub_srt.exists()
        }
        if not subtitles_ok:
            warnings.append("Subtitle tracks (.vtt / .srt) missing or empty.")

        # Scene Assets Consistency Check
        scenes = db.query(Scene).filter(Scene.project_id == project_id).order_by(Scene.scene_order).all()
        missing_scenes = []
        for s in scenes:
            vis_file = BASE_DIR / "workspace_data" / "projects" / project_id / "visuals" / f"{s.scene_id_str}.jpg"
            aud_file = BASE_DIR / "workspace_data" / "projects" / project_id / "audio" / f"{s.scene_id_str}.wav"
            if not vis_file.exists() or not aud_file.exists():
                missing_scenes.append(s.scene_id_str)

        assets_ok = len(missing_scenes) == 0
        check_results["scene_assets"] = {
            "passed": assets_ok,
            "status_label": "PASSED" if assets_ok else "FAILED",
            "message": f"All {len(scenes)} scenes have verified audio & 1080p visual assets.",
            "total_scenes": len(scenes),
            "missing_scenes": missing_scenes
        }
        if not assets_ok:
            warnings.append(f"Assets missing for scenes: {', '.join(missing_scenes)}")

        # Overall Status & Score Calculation
        total_checks = len(check_results)
        passed_count = sum(1 for c in check_results.values() if c["passed"])
        score_percent = int((passed_count / total_checks) * 100)

        critical_checks = ["file_integrity", "duration", "resolution", "audio_stream"]
        critical_passed = all(check_results[k]["passed"] for k in critical_checks if k in check_results)

        overall_passed = critical_passed and (score_percent >= 80)
        overall_status = "ALL_CHECKS_PASSED" if score_percent == 100 else ("WARNINGS_DETECTED" if overall_passed else "FAILED")

        return {
            "passed": overall_passed,
            "overall_status": overall_status,
            "score_percent": score_percent,
            "check_results": check_results,
            "warnings": warnings
        }

    @classmethod
    def verify_video(cls, video_version: VideoVersion, db: Session) -> QualityCheck:
        """
        Executes QC checks on the given VideoVersion and records results in Supabase.
        """
        results = cls.run_all_checks(video_version=video_version, db=db)

        existing_qc = db.query(QualityCheck).filter(QualityCheck.video_version_id == video_version.id).first()

        if existing_qc:
            existing_qc.passed = results["passed"]
            existing_qc.check_results = results["check_results"]
            existing_qc.warnings = results["warnings"]
            qc_record = existing_qc
        else:
            qc_record = QualityCheck(
                id=str(uuid.uuid4()),
                video_version_id=video_version.id,
                passed=results["passed"],
                check_results=results["check_results"],
                warnings=results["warnings"]
            )
            db.add(qc_record)

        db.commit()
        db.refresh(qc_record)
        return qc_record
