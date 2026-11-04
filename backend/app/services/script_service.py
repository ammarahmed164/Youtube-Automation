from typing import Optional
from sqlalchemy.orm import Session, selectinload
from app.core.config import BASE_DIR
from app.models.project import Project, ProjectActivity
from app.models.generation import ScriptRevision, Scene, SceneAsset, AudioAsset
from app.schemas.script import (
    DocumentaryScriptPlan,
    ScriptUpdateInput,
    SceneUpdateInput,
    SceneCreateInput,
    SceneAiRewriteInput,
)
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

    @staticmethod
    async def create_scene(db: Session, project_id: str, scene_in: SceneCreateInput) -> Scene:
        """
        Creates a new scene in the documentary.
        Supports both AI generation (Gemini) and manual script input.
        Automatically re-sequences scene numbers and updates the full script.
        """
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError(f"Project '{project_id}' not found.")

        latest_rev = (
            db.query(ScriptRevision)
            .filter(ScriptRevision.project_id == project_id)
            .order_by(ScriptRevision.revision_number.desc())
            .first()
        )
        if not latest_rev:
            raise ValueError(f"Project '{project_id}' has no script revision yet. Generate a script first.")

        existing_scenes = (
            db.query(Scene)
            .filter(Scene.script_revision_id == latest_rev.id)
            .order_by(Scene.scene_order)
            .all()
        )

        if scene_in.insert_after_order is not None:
            target_order = scene_in.insert_after_order + 1
            for s in existing_scenes:
                if s.scene_order >= target_order:
                    s.scene_order += 1
        else:
            target_order = len(existing_scenes) + 1

        lang = project.settings.language if project.settings else "English"
        tone = project.settings.tone if project.settings else "documentary"

        if scene_in.generate_with_ai:
            ai_service = GeminiService()
            summary = "\n".join(
                f"Scene {s.scene_order}: {s.scene_title or ''} - {s.narration_text[:100]}..."
                for s in existing_scenes
            )
            plan_item = await ai_service.generate_single_scene(
                topic=project.topic,
                language=lang,
                tone=tone,
                scene_number=target_order,
                existing_scenes_summary=summary,
                user_prompt=scene_in.ai_prompt
            )
            title = scene_in.scene_title or plan_item.scene_title
            purpose = scene_in.purpose or plan_item.purpose
            narration = plan_item.narration_text
            visual_desc = scene_in.visual_description or plan_item.visual_description
            vis_type = scene_in.preferred_visual_type or plan_item.preferred_visual_type
            keywords = scene_in.stock_keywords or plan_item.stock_keywords
            on_screen = scene_in.on_screen_text or plan_item.on_screen_text
            transition = scene_in.transition_preference or plan_item.transition_preference
            est_duration = plan_item.estimated_duration_seconds
        else:
            if not scene_in.narration_text or not scene_in.narration_text.strip():
                raise ValueError("Narration text is required when creating a scene manually.")
            narration = scene_in.narration_text.strip()
            title = scene_in.scene_title or f"Scene {target_order}"
            purpose = scene_in.purpose or "Advance narrative"
            visual_desc = scene_in.visual_description or f"Cinematic visual representing: {narration[:80]}"
            vis_type = scene_in.preferred_visual_type or "stock_footage"
            keywords = scene_in.stock_keywords or [w.strip() for w in title.split()[:3]]
            on_screen = scene_in.on_screen_text
            transition = scene_in.transition_preference or "fade"
            est_duration = max(3.0, round(len(narration.split()) / 2.5, 1))

        new_scene = Scene(
            project_id=project_id,
            script_revision_id=latest_rev.id,
            scene_order=target_order,
            scene_id_str=f"scene_{target_order:02d}",
            scene_title=title,
            purpose=purpose,
            narration_text=narration,
            estimated_duration_seconds=est_duration,
            visual_description=visual_desc,
            preferred_visual_type=vis_type,
            stock_keywords=keywords,
            on_screen_text=on_screen,
            transition_preference=transition
        )
        db.add(new_scene)
        db.flush()

        # Re-sequence all scenes cleanly
        all_scenes = (
            db.query(Scene)
            .filter(Scene.script_revision_id == latest_rev.id)
            .order_by(Scene.scene_order)
            .all()
        )
        for idx, s in enumerate(all_scenes, start=1):
            s.scene_order = idx
            s.scene_id_str = f"scene_{idx:02d}"

        # Re-sync continuous full_script
        latest_rev.full_script = "\n\n".join(s.narration_text for s in all_scenes)

        activity = ProjectActivity(
            project_id=project_id,
            action_type="scene_created",
            actor="user",
            details={
                "scene_id": new_scene.id,
                "scene_order": new_scene.scene_order,
                "generated_with_ai": scene_in.generate_with_ai
            }
        )
        db.add(activity)
        db.commit()
        db.refresh(new_scene)
        return new_scene

    @staticmethod
    async def ai_rewrite_scene(db: Session, scene_id: str, rewrite_in: SceneAiRewriteInput) -> Scene:
        """
        Rewrites or enhances an individual scene's script and visual direction with Gemini AI.
        """
        scene = db.query(Scene).filter(Scene.id == scene_id).first()
        if not scene:
            raise ValueError(f"Scene '{scene_id}' not found.")

        project = db.query(Project).filter(Project.id == scene.project_id).first()
        lang = project.settings.language if project and project.settings else "English"
        tone = project.settings.tone if project and project.settings else "documentary"

        ai_service = GeminiService()
        rewritten = await ai_service.rewrite_scene_narration(
            current_narration=scene.narration_text,
            topic=project.topic if project else "Documentary",
            language=lang,
            tone=tone,
            instructions=rewrite_in.instructions
        )

        scene.narration_text = rewritten.narration_text
        if rewritten.scene_title:
            scene.scene_title = rewritten.scene_title
        if rewritten.visual_description:
            scene.visual_description = rewritten.visual_description
        if rewritten.stock_keywords:
            scene.stock_keywords = rewritten.stock_keywords
        if rewritten.on_screen_text:
            scene.on_screen_text = rewritten.on_screen_text

        # Re-calculate estimated duration & reset audio duration so it can be re-voiced
        word_count = len(scene.narration_text.split())
        scene.estimated_duration_seconds = max(3.0, round(word_count / 2.5, 1))
        scene.actual_audio_duration_seconds = None

        all_scenes = (
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
            latest_rev.full_script = "\n\n".join(s.narration_text for s in all_scenes)

        activity = ProjectActivity(
            project_id=scene.project_id,
            action_type="scene_ai_rewritten",
            actor="user",
            details={"scene_id": scene.id, "scene_order": scene.scene_order}
        )
        db.add(activity)
        db.commit()
        db.refresh(scene)
        return scene


