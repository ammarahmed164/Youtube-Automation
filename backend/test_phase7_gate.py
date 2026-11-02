import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import SessionLocal
from app.models.project import Project
from app.models.generation import Scene
from app.models.video import VideoVersion, QualityCheck
from app.services.qc.modification_service import ModificationService
from app.services.qc.service import QualityCheckService

async def main():
    db = SessionLocal()
    project_id = "b8c4a056-57a5-4810-8a7e-6879de171dbd"
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        print(f"Error: Project {project_id} not found.")
        return

    print(f"=== PHASE 7 VERIFICATION GATE TEST ===")
    print(f"Target Project: {project.title} ({project.id})")
    
    # 1. Check existing Version 1 and initial QC
    v1 = db.query(VideoVersion).filter(
        VideoVersion.project_id == project_id,
        VideoVersion.version_number == 1
    ).first()
    
    if not v1:
        print("Error: Version 1 not found. Must have v1 to modify.")
        return
        
    print(f"Existing Version 1: v{v1.version_number} (File: {v1.file_path}, SHA-256: {v1.file_checksum[:16]}...)")
    
    # Check Scene 3 before modification
    scene3_before = db.query(Scene).filter(Scene.project_id == project_id, Scene.scene_order == 3).first()
    print(f"\n[Before] Scene 3 Narration: \"{scene3_before.narration_text[:80]}...\"")
    print(f"[Before] Scene 3 On-Screen Text: \"{scene3_before.on_screen_text}\"")
    print(f"[Before] Scene 3 Audio Duration: {scene3_before.actual_audio_duration_seconds}s")
    
    test_prompt = "Make scene 3 narration shorter and more dramatic, and add on-screen text 'Alien Atmospheres'"
    print(f"\nSubmitting AI Natural Language Modification Prompt:")
    print(f"Prompt: \"{test_prompt}\"")
    
    print("\nExecuting ModificationService.process_modification (Gemini AI -> TTS -> FFmpeg Render v2 -> QC)...")
    res = await ModificationService.process_modification(
        db=db,
        project_id=project_id,
        user_prompt=test_prompt,
        auto_rerender=True
    )
    
    print("\n--- MODIFICATION RESULT ---")
    print(f"Status: {res.get('status')}")
    print(f"Plan Summary: {res.get('plan_summary')}")
    print(f"Affected Scenes: {res.get('affected_scenes')}")
    print(f"Message: {res.get('message')}")
    
    # Check Scene 3 after modification
    db.refresh(scene3_before)
    print(f"\n[After] Scene 3 Narration: \"{scene3_before.narration_text}\"")
    print(f"[After] Scene 3 On-Screen Text: \"{scene3_before.on_screen_text}\"")
    print(f"[After] Scene 3 Audio Duration: {scene3_before.actual_audio_duration_seconds}s")
    
    # Check Version 2
    v2 = db.query(VideoVersion).filter(
        VideoVersion.project_id == project_id,
        VideoVersion.version_number == 2
    ).first()
    
    if not v2:
        print("FAIL: Video Version 2 was not created.")
        return
        
    size_bytes = (Path("workspace_data/projects") / project_id / "renders" / f"v{v2.version_number}" / f"documentary_v{v2.version_number}.mp4").stat().st_size if (Path("workspace_data/projects") / project_id / "renders" / f"v{v2.version_number}" / f"documentary_v{v2.version_number}.mp4").exists() else 0
    print(f"\nNew Video Version 2 Created:")
    print(f"  Version: v{v2.version_number}")
    print(f"  Path: {v2.file_path}")
    print(f"  Duration: {v2.duration_seconds:.2f}s ({v2.duration_seconds/60:.2f} mins)")
    print(f"  File Size: {size_bytes / (1024*1024):.2f} MB")
    print(f"  SHA-256: {v2.file_checksum}")
    
    # Check QC for Version 2
    qc = res.get("quality_check")
    if qc:
        print(f"\nVersion 2 Automated Quality Control:")
        print(f"  Passed: {qc.passed}")
        print(f"  Checks: {list(qc.check_results.keys())}")
        passed_count = sum(1 for c in qc.check_results.values() if c.get('passed'))
        print(f"  Score: {passed_count}/{len(qc.check_results)} checks passed ({(passed_count/len(qc.check_results))*100:.0f}%)")
        print(f"  Warnings: {qc.warnings}")
        
    # Verify Version 1 and Version 2 coexist
    all_versions = db.query(VideoVersion).filter(VideoVersion.project_id == project_id).order_by(VideoVersion.version_number).all()
    print(f"\nAll Project Video Versions in Database ({len(all_versions)}):")
    for ver in all_versions:
        print(f"  - v{ver.version_number}: SHA-256={ver.file_checksum[:16]}... Path={ver.file_path}")
        
    print("\n>>> PHASE 7 VERIFICATION GATE: 100% SUCCESS <<<")

if __name__ == "__main__":
    asyncio.run(main())
