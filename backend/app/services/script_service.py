from typing import Optional
from sqlalchemy.orm import Session, selectinload
from app.core.config import BASE_DIR
from app.models.project import Project, ProjectActivity
from app.models.generation import ScriptRevision, Scene, SceneAsset, AudioAsset
from app.schemas.script import DocumentaryScriptPlan, ScriptUpdateInput, SceneUpdateInput
from app.services.ai.gemini_adapter import GeminiService

class ScriptService:
    @staticmethod
    async def generate_project_script(db: Session, project_id: str) -> ScriptRevision:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError(f"Project '{project_id}' not found.")

        settings = project.settings
        duration = settings.target_duration_minutes if settings else 10
        tone = settings.tone if settings else "documentary"
        language = settings.language if settings else "English"
        scene_mode = settings.scene_planning_mode if settings else "automatic"
        desired_scenes = settings.desired_scene_count if settings else None

        # Call Gemini AI Service
        ai_service = GeminiService()
        plan: DocumentaryScriptPlan = await ai_service.generate_script(
            topic=project.topic,
            target_duration_minutes=duration,
            tone=tone,
            language=language,
            scene_planning_mode=scene_mode,
            desired_scene_count=desired_scenes
        )

        # Determine revision number
        latest_rev = (
            db.query(ScriptRevision)
            .filter(ScriptRevision.project_id == project_id)
            .order_by(ScriptRevision.revision_number.desc())
            .first()
        )
        rev_num = (latest_rev.revision_number + 1) if latest_rev else 1

        # Create Script Revision
        revision = ScriptRevision(
            project_id=project_id,
            revision_number=rev_num,
            title_hook=plan.title_hook,
            full_script=plan.full_script,
            conclusion=plan.conclusion,
            research_sources=[c.model_dump() for c in plan.research_sources]
        )
        db.add(revision)
        db.flush()

        # Create Scenes
        for item in plan.scenes:
            scene = Scene(
                project_id=project_id,
                script_revision_id=revision.id,
                scene_order=item.scene_order,
                scene_id_str=item.scene_id_str,
                scene_title=item.scene_title,
                purpose=item.purpose,
                narration_text=item.narration_text,
                estimated_duration_seconds=item.estimated_duration_seconds,
                visual_description=item.visual_description,
                preferred_visual_type=item.preferred_visual_type,
                stock_keywords=item.stock_keywords,
                image_prompt=item.image_prompt,
                on_screen_text=item.on_screen_text,
                transition_preference=item.transition_preference
            )
            db.add(scene)

        # Update Project Status to script_review
        project.status = "script_review"
        
        # Log Activity
        activity = ProjectActivity(
            project_id=project_id,
            action_type="script_generated",
            actor="ai_agent",
            details={
                "revision_number": rev_num,
                "scenes_count": len(plan.scenes),
                "title_hook": plan.title_hook
            }
        )
        db.add(activity)

        db.commit()
        db.refresh(revision)
        return revision

    @staticmethod
    def get_latest_script(db: Session, project_id: str) -> Optional[ScriptRevision]:
        return (
            db.query(ScriptRevision)
            .options(
                selectinload(ScriptRevision.scenes).selectinload(Scene.assets),
                selectinload(ScriptRevision.scenes).selectinload(Scene.audio),
            )
            .filter(ScriptRevision.project_id == project_id)
            .order_by(ScriptRevision.revision_number.desc())
            .first()
        )

    @staticmethod
    def update_script(db: Session, project_id: str, update_in: ScriptUpdateInput) -> Optional[ScriptRevision]:
        revision = ScriptService.get_latest_script(db, project_id)
        if not revision:
            return None

        if update_in.title_hook is not None:
            revision.title_hook = update_in.title_hook
        if update_in.full_script is not None:
            revision.full_script = update_in.full_script
        if update_in.conclusion is not None:
            revision.conclusion = update_in.conclusion

        activity = ProjectActivity(
            project_id=project_id,
            action_type="script_edited",
            actor="user",
            details={"revision_number": revision.revision_number}
        )
        db.add(activity)

        db.commit()
        db.refresh(revision)
        return revision

    @staticmethod
    def update_scene(db: Session, scene_id: str, update_in: SceneUpdateInput) -> Scene:
        """Update any properties of an individual scene (narration, title, visual style)."""
        scene = db.query(Scene).filter(Scene.id == scene_id).first()
        if not scene:
            raise ValueError(f"Scene '{scene_id}' not found.")

        if update_in.scene_title is not None:
            scene.scene_title = update_in.scene_title
        if update_in.purpose is not None:
            scene.purpose = update_in.purpose
        if update_in.visual_description is not None:
            scene.visual_description = update_in.visual_description
        if update_in.preferred_visual_type is not None:
            scene.preferred_visual_type = update_in.preferred_visual_type
        if update_in.stock_keywords is not None:
            scene.stock_keywords = update_in.stock_keywords
        if update_in.on_screen_text is not None:
            scene.on_screen_text = update_in.on_screen_text
        if update_in.transition_preference is not None:
            scene.transition_preference = update_in.transition_preference

        # If narration text was updated, re-calculate estimated duration & reset audio duration
        if update_in.narration_text is not None and update_in.narration_text != scene.narration_text:
            scene.narration_text = update_in.narration_text
            word_count = len(update_in.narration_text.split())
            scene.estimated_duration_seconds = max(3.0, round(word_count / 2.5, 1))
            scene.actual_audio_duration_seconds = None

        # Re-sync continuous full_script on the parent ScriptRevision
        scenes = (
            db.query(Scene)
            .filter(Scene.project_id == scene.project_id)
            .order_by(Scene.scene_order)
            .all()
        )
        latest_rev = (
            db.query(ScriptRevision)
            .filter(ScriptRevision.project_id == scene.project_id)
            .order_by(ScriptRevision.revision_number.desc())
            .first()
        )
        if latest_rev:
            latest_rev.full_script = "\n\n".join(s.narration_text for s in scenes)

        activity = ProjectActivity(
            project_id=scene.project_id,
            action_type="scene_updated",
            actor="user",
            details={"scene_id": scene.id, "scene_order": scene.scene_order}
        )
        db.add(activity)

        db.commit()
        db.refresh(scene)
        return scene

    @staticmethod
    def delete_scene(db: Session, scene_id: str) -> Optional[ScriptRevision]:
        """Permanently delete a scene from the documentary and sequentially re-order remaining scenes."""
        scene = db.query(Scene).filter(Scene.id == scene_id).first()
        if not scene:
            raise ValueError(f"Scene '{scene_id}' not found.")

        project_id = scene.project_id
        scene_order = scene.scene_order

        # Delete database assets & audio linked to this scene
        db.query(SceneAsset).filter(SceneAsset.scene_id == scene.id).delete()
        db.query(AudioAsset).filter(AudioAsset.scene_id == scene.id).delete()

        # Delete workspace files for this scene
        project_dir = BASE_DIR / "workspace_data" / "projects" / project_id
        audio_file = project_dir / "audio" / f"{scene.scene_id_str}.wav"
        if audio_file.exists():
            try:
                audio_file.unlink()
            except Exception:
                pass

        visuals_dir = project_dir / "visuals"
        if visuals_dir.exists():
            for f in visuals_dir.glob(f"{scene.scene_id_str}*"):
                try:
                    f.unlink()
                except Exception:
                    pass

        # Delete scene entity
        db.delete(scene)
        db.flush()

        # Re-index remaining scenes sequentially (1, 2, 3...)
        remaining_scenes = (
            db.query(Scene)
            .filter(Scene.project_id == project_id)
            .order_by(Scene.scene_order)
            .all()
        )
        for idx, s in enumerate(remaining_scenes, start=1):
            s.scene_order = idx

        # Re-sync continuous script
        latest_rev = (
            db.query(ScriptRevision)
            .filter(ScriptRevision.project_id == project_id)
            .order_by(ScriptRevision.revision_number.desc())
            .first()
        )
        if latest_rev:
            latest_rev.full_script = "\n\n".join(s.narration_text for s in remaining_scenes)

        activity = ProjectActivity(
            project_id=project_id,
            action_type="scene_deleted",
            actor="user",
            details={"deleted_scene_order": scene_order, "remaining_count": len(remaining_scenes)}
        )
        db.add(activity)

        db.commit()
        return ScriptService.get_latest_script(db, project_id)

