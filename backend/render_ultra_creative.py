import os
import sys
import uuid
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import SessionLocal
from app.core.config import BASE_DIR
from app.models.project import Project
from app.models.generation import GenerationJob
from app.models.video import VideoVersion, QualityCheck
from app.services.rendering.service import RenderingService
from app.services.qc.service import QualityCheckService

def run_render():
    db = SessionLocal()
    project_id = "b8c4a056-57a5-4810-8a7e-6879de171dbd"
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        print("Project not found.")
        return
        
    print("==================================================================")
    print("      COMPILING ULTRA-CREATIVE DOCUMENTARY VERSION 3 (FFmpeg)      ")
    print("==================================================================")
    print(f"Project: {project.title} ({project_id})")
    
    visuals_dir = BASE_DIR / "workspace_data" / "projects" / project_id / "visuals"
    all_cuts = list(visuals_dir.glob("*.jpg"))
    print(f"Found {len(all_cuts)} authentic NASA 1080p cuts ready in visuals folder.")
    
    job_id = str(uuid.uuid4())
    job = GenerationJob(
        id=job_id,
        project_id=project_id,
        job_type="rendering",
        status="queued",
        progress_percent=0,
        log_messages=["Rendering Version 3 with 68 dynamic NASA cuts and camera motions..."]
    )
    db.add(job)
    db.commit()
    
    print("\nExecuting RenderingService.render_project (Multi-Cut B-rolls + Film Vignette + Cosmic Soundscape)...")
    res = RenderingService.render_project(project_id=project_id, job_id=job_id)
    
    print("\nRendering Finished Successfully!")
    print(f"  Version: v{res['version_number']}")
    print(f"  Path: {res['file_path']}")
    print(f"  Duration: {res['duration_seconds']:.2f}s")
    print(f"  SHA-256 Checksum: {res['file_checksum']}")
    
    # Run Quality Control
    new_v = db.query(VideoVersion).filter(VideoVersion.id == res['video_version_id']).first()
    qc = QualityCheckService.verify_video(video_version=new_v, db=db)
    passed_cnt = sum(1 for c in qc.check_results.values() if c.get('passed'))
    print(f"  QC Score: {passed_cnt}/{len(qc.check_results)} checks passed ({qc.passed})")
    print("\n>>> VERSION 3 IS READY FOR REVIEW <<<")

if __name__ == "__main__":
    run_render()
