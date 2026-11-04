from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from app.models.project import Project, ProjectSetting, ProjectActivity
from app.schemas.project import ProjectCreate, ProjectUpdate

class ProjectService:
    @staticmethod
    def create_project(db: Session, project_in: ProjectCreate) -> Project:
        # Create Project
        project = Project(
            title=project_in.title,
            topic=project_in.topic,
            description=project_in.description,
            status="draft"
        )
        db.add(project)
        db.flush() # assign project.id

        # Create Associated Settings
        s = project_in.settings
        setting = ProjectSetting(
            project_id=project.id,
            target_duration_minutes=s.target_duration_minutes,
            language=s.language,
            tone=s.tone,
            audience_level=s.audience_level,
            narration_preset=s.narration_preset,
            scene_planning_mode=s.scene_planning_mode,
            desired_scene_count=s.desired_scene_count,
            aspect_ratio=s.aspect_ratio,
            resolution=s.resolution,
            visual_strategy=s.visual_strategy
        )
        db.add(setting)

        # Record activity
        activity = ProjectActivity(
            project_id=project.id,
            action_type="project_created",
            actor="user",
            details={"title": project.title, "duration_minutes": s.target_duration_minutes}
        )
        db.add(activity)

        db.commit()
        db.refresh(project)
        return project

    @staticmethod
    def get_projects(db: Session, skip: int = 0, limit: int = 100) -> List[Project]:
        return (
            db.query(Project)
            .options(joinedload(Project.settings))
            .order_by(Project.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def get_project_by_id(db: Session, project_id: str) -> Optional[Project]:
        return (
            db.query(Project)
            .options(joinedload(Project.settings))
            .filter(Project.id == project_id)
            .first()
        )

    @staticmethod
    def update_project(db: Session, project_id: str, update_in: ProjectUpdate) -> Optional[Project]:
        project = (
            db.query(Project)
            .options(joinedload(Project.settings))
            .filter(Project.id == project_id)
            .first()
        )
        if not project:
            return None

        update_data = update_in.model_dump(exclude_unset=True)
        settings_data = update_data.pop("settings", None)

        for field, value in update_data.items():
            setattr(project, field, value)

        if settings_data:
            if not project.settings:
                new_setting = ProjectSetting(project_id=project.id, **settings_data)
                db.add(new_setting)
                project.settings = new_setting
            else:
                for s_field, s_val in settings_data.items():
                    setattr(project.settings, s_field, s_val)

        activity_details = {**update_data}
        if settings_data:
            activity_details["settings"] = settings_data

        activity = ProjectActivity(
            project_id=project.id,
            action_type="project_updated",
            actor="user",
            details=activity_details
        )
        db.add(activity)

        db.commit()
        db.refresh(project)
        return project

    @staticmethod
    def delete_project(db: Session, project_id: str) -> bool:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return False
        db.delete(project)
        db.commit()
        return True

