from typing import Optional
from sqlalchemy.orm import Session, selectinload
from app.models.project import Project, ProjectActivity
from app.models.generation import ScriptRevision, Scene
from app.schemas.script import DocumentaryScriptPlan, ScriptUpdateInput
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

