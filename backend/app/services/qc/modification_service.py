import os
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.core.config import settings, BASE_DIR
from app.models.project import Project, ProjectActivity
from app.models.generation import Scene, AudioAsset, SceneAsset, GenerationJob
from app.models.video import VideoVersion, VideoApproval, QualityCheck
from app.schemas.modification import DocumentaryModificationPlan
from app.services.ai.gemini_adapter import GeminiService
from app.services.tts.piper_service import PiperTTSService
from app.services.visual.visual_service import VisualService
from app.services.rendering.service import RenderingService
from app.services.qc.service import QualityCheckService

logger = logging.getLogger(__name__)

class ModificationService:
    """
    AI Natural Language Modification Workflow:
    1. Interprets creator's revision request using Gemini AI
    2. Identifies targeted affected scenes (preserves unaffected scenes)
    3. Re-synthesizes Piper TTS audio and re-acquires visuals ONLY for modified scenes
    4. Re-renders new video version (v2, v3...) with FFmpeg
    5. Invalidates any previous VideoApproval records (Mandatory Rule 14)
    6. Automatically executes automated Quality Checks on the new version
    """

    @classmethod
    async def process_modification(
        cls,
        db: Session,
        project_id: str,
        user_prompt: str,
        auto_rerender: bool = True
    ) -> Dict[str, Any]:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError(f"Project '{project_id}' not found.")

        scenes = (
            db.query(Scene)
            .filter(Scene.project_id == project_id)
            .order_by(Scene.scene_order)
            .all()
        )
        if not scenes:
            raise ValueError("No scenes found for this project.")

        # Build current scenes breakdown summary for Gemini
        summary_lines = []
        for s in scenes:
            summary_lines.append(
                f"[Scene {s.scene_order} - {s.scene_id_str}] Title: '{s.scene_title}'\n"
                f"   Narration: \"{s.narration_text}\"\n"
                f"   Visual Direction: \"{s.visual_description}\"\n"
                f"   Keywords: {s.stock_keywords}\n"
                f"   On-Screen Text: \"{s.on_screen_text or ''}\"\n"
            )
        scenes_summary_str = "\n".join(summary_lines)

        # Call Gemini to parse targeted modifications
        ai_service = GeminiService()
        plan: DocumentaryModificationPlan = await ai_service.parse_modification_plan(
            current_scenes_summary=scenes_summary_str,
            user_request=user_prompt
        )

        project_dir = BASE_DIR / "workspace_data" / "projects" / project_id
        tts_service = PiperTTSService()
        voice_preset = project.settings.narration_preset if project.settings else "deep_male_cinematic"

        affected_orders = set(plan.affected_scene_orders)
        modified_scenes_count = 0

        # Apply targeted changes scene by scene
        for delta in plan.scene_modifications:
            scene = next((s for s in scenes if s.scene_order == delta.scene_order), None)
            if not scene:
                continue

            modified_scenes_count += 1
            narration_changed = False
            visual_changed = False

            if delta.updated_scene_title:
                scene.scene_title = delta.updated_scene_title

            if delta.updated_on_screen_text is not None:
                scene.on_screen_text = delta.updated_on_screen_text

            if delta.updated_narration_text and delta.updated_narration_text.strip() != scene.narration_text.strip():
                scene.narration_text = delta.updated_narration_text.strip()
                narration_changed = True

            if delta.updated_visual_description or delta.updated_stock_keywords:
                if delta.updated_visual_description:
                    scene.visual_description = delta.updated_visual_description
                if delta.updated_stock_keywords:
                    scene.stock_keywords = delta.updated_stock_keywords
                visual_changed = True

            # Re-synthesize audio if narration was updated
            if narration_changed:
                target_audio_file = project_dir / "audio" / f"{scene.scene_id_str}.wav"
                tts_result = await tts_service.synthesize_scene(
                    scene_id=scene.id,
                    text=scene.narration_text,
                    voice_preset=voice_preset,
                    output_path=target_audio_file
                )
                scene.actual_audio_duration_seconds = tts_result["duration_seconds"]

                # Update AudioAsset in Supabase
                audio_asset = db.query(AudioAsset).filter(AudioAsset.scene_id == scene.id).first()
                if audio_asset:
                    audio_asset.duration_seconds = tts_result["duration_seconds"]

            # Re-acquire visual if visual direction/keywords were updated
            if visual_changed:
                VisualService.generate_scene_visual(
                    scene=scene,
                    project_dir=project_dir,
                    force_regenerate=True
                )

        db.commit()

        # Log project activity
        activity = ProjectActivity(
            id=str(uuid.uuid4()),
            project_id=project_id,
            action_type="ai_modification",
            actor="ai_agent",
            details={
                "prompt": user_prompt,
                "affected_scenes": list(affected_orders),
                "plan_summary": plan.plan_summary
            }
        )
        db.add(activity)
        db.commit()

        new_version_record = None
        qc_record = None

        # Re-render new video version if requested
        if auto_rerender:
            render_job_id = str(uuid.uuid4())
            render_job = GenerationJob(
                id=render_job_id,
                project_id=project_id,
                job_type="rendering",
                status="queued",
                progress_percent=0,
                log_messages=[f"Starting revision render based on user request: {plan.plan_summary}"]
            )
            db.add(render_job)
            db.commit()

            # Execute rendering pipeline
            render_result = RenderingService.render_project(project_id=project_id, job_id=render_job_id)

            # Invalidate any previous VideoApproval records (Mandatory Rule 14!)
            db.query(VideoApproval).filter(
                VideoApproval.project_id == project_id,
                VideoApproval.is_revoked == False
            ).update({
                "is_revoked": True,
                "revoked_at": datetime.now(timezone.utc),
                "revocation_reason": f"Superseded by Video Version v{render_result['version_number']}"
            })
            db.commit()

            # Retrieve new VideoVersion
            new_version_record = (
                db.query(VideoVersion)
                .filter(VideoVersion.project_id == project_id)
                .order_by(VideoVersion.version_number.desc())
                .first()
            )

            # Automatically run Quality Control on new version
            if new_version_record:
                qc_record = QualityCheckService.verify_video(video_version=new_version_record, db=db)

        return {
            "status": "success",
            "project_id": project_id,
            "plan_summary": plan.plan_summary,
            "affected_scenes": list(affected_orders),
            "re_rendered": auto_rerender,
            "new_video_version": new_version_record,
            "quality_check": qc_record,
            "message": f"Successfully applied targeted modifications to {modified_scenes_count} scenes."
        }
