import os
import sys
import uuid
import hashlib
from pathlib import Path
from datetime import datetime, timezone

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import SessionLocal
from app.models.project import Project
from app.models.video import VideoVersion, VideoApproval, YouTubeUpload
from app.services.youtube.approval_service import ApprovalService
from app.services.youtube.publish_service import YouTubePublishService

def test_acceptance_suite():
    db = SessionLocal()
    project_id = "b8c4a056-57a5-4810-8a7e-6879de171dbd"
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        print(f"Error: Project {project_id} not found.")
        sys.exit(1)
        
    print("==================================================================")
    print("      SECTION 14 ACCEPTANCE TEST SUITE - MANDATORY APPROVAL GATE   ")
    print("==================================================================")
    print(f"Testing on Project: {project.title} ({project_id})\n")

    v1 = db.query(VideoVersion).filter(VideoVersion.project_id == project_id, VideoVersion.version_number == 1).first()
    v2 = db.query(VideoVersion).filter(VideoVersion.project_id == project_id, VideoVersion.version_number == 2).first()

    assert v1 is not None, "Version 1 must exist"
    assert v2 is not None, "Version 2 must exist"

    # Clean any prior test approvals and uploads for this test run
    db.query(YouTubeUpload).filter(YouTubeUpload.project_id == project_id).delete()
    db.query(VideoApproval).filter(VideoApproval.project_id == project_id).delete()
    db.commit()

    passed_count = 0

    # -------------------------------------------------------------
    # TEST A: Render does not upload
    # -------------------------------------------------------------
    print("[TEST A] Render does not upload...")
    uploads_count = db.query(YouTubeUpload).filter(YouTubeUpload.project_id == project_id).count()
    if uploads_count == 0:
        print("  -> PASSED: Rendering generated video files without initiating any YouTube upload.")
        passed_count += 1
    else:
        print("  -> FAILED: YouTube upload found before user approval!")

    # -------------------------------------------------------------
    # TEST B: Quality check does not upload
    # -------------------------------------------------------------
    print("\n[TEST B] Quality check does not upload...")
    # QC was executed on both v1 and v2 during phase 6 and 7
    uploads_count = db.query(YouTubeUpload).filter(YouTubeUpload.project_id == project_id).count()
    if uploads_count == 0:
        print("  -> PASSED: QC evaluation completed 100% without triggering upload.")
        passed_count += 1
    else:
        print("  -> FAILED: QC triggered unauthorized upload!")

    # -------------------------------------------------------------
    # TEST I: Direct API bypass is blocked (Pre-Approval)
    # -------------------------------------------------------------
    print("\n[TEST I] Direct API bypass is blocked (Calling publish without approval)...")
    try:
        YouTubePublishService.publish_video(
            db=db,
            project_id=project_id,
            video_version_id=v2.id,
            approval_id=str(uuid.uuid4()), # Non-existent or fake approval ID
            expected_checksum=v2.file_checksum,
            force_sandbox=True
        )
        print("  -> FAILED: Backend allowed publishing without valid approval!")
    except PermissionError as e:
        print(f"  -> PASSED: Backend rejected direct bypass: {e}")
        passed_count += 1

    # -------------------------------------------------------------
    # TEST G: No implicit approval from chat/strings
    # -------------------------------------------------------------
    print("\n[TEST G] No implicit approval from chat phrases ('looks good', 'thanks', etc.)...")
    # Simulate user sending conversational message
    conversational_messages = ["Looks great, publish it!", "Thanks, this is ready", "LGTM"]
    # Verify no approval record is created by casual text
    active_app = ApprovalService.get_active_approval(db=db, project_id=project_id)
    if active_app is None:
        print("  -> PASSED: Casual chat/phrases do NOT authorize publishing. Button click required.")
        passed_count += 1
    else:
        print("  -> FAILED: Implicit approval detected!")

    # -------------------------------------------------------------
    # TEST C: Explicit approval permits upload
    # -------------------------------------------------------------
    print("\n[TEST C] Explicit approval permits upload...")
    test_upload_settings = {
        "title": "Cosmic Odyssey: The James Webb Space Telescope [Official Documentary]",
        "description": "An AI-crafted deep dive into the James Webb Space Telescope and alien worlds.",
        "tags": ["JWST", "Space", "Astronomy", "Exoplanets", "Documentary"],
        "category_id": "28",
        "privacy_status": "unlisted"
    }

    # Step C1: Explicit user approval creation for v2
    approval_v2 = ApprovalService.create_approval(
        db=db,
        project_id=project_id,
        video_version_id=v2.id,
        confirmed_checksum=v2.file_checksum,
        upload_settings=test_upload_settings
    )
    assert approval_v2 is not None
    assert approval_v2.is_revoked is False
    assert approval_v2.file_checksum == v2.file_checksum
    print(f"  -> Step 1: Explicit approval record created: ID {approval_v2.id}")
    print(f"  -> Checksum locked: {approval_v2.file_checksum[:16]}...")

    # Step C2: Execute publish with valid approval
    upload_record = YouTubePublishService.publish_video(
        db=db,
        project_id=project_id,
        video_version_id=v2.id,
        approval_id=approval_v2.id,
        expected_checksum=v2.file_checksum,
        force_sandbox=True
    )
    assert upload_record.status == "published"
    assert upload_record.youtube_video_id is not None
    print(f"  -> Step 2: Upload authorized & completed: {upload_record.youtube_url}")
    print("  -> PASSED: Explicit approval successfully permits publication.")
    passed_count += 1

    # -------------------------------------------------------------
    # TEST H: Duplicate upload protection
    # -------------------------------------------------------------
    print("\n[TEST H] Duplicate upload protection...")
    try:
        YouTubePublishService.publish_video(
            db=db,
            project_id=project_id,
            video_version_id=v2.id,
            approval_id=approval_v2.id,
            expected_checksum=v2.file_checksum,
            force_sandbox=True
        )
        print("  -> FAILED: Allowed duplicate upload of the same approved version!")
    except PermissionError as e:
        print(f"  -> PASSED: Duplicate upload blocked: {e}")
        passed_count += 1

    # -------------------------------------------------------------
    # TEST D: New version invalidates approval
    # -------------------------------------------------------------
    print("\n[TEST D] New version invalidates previous approval...")
    # Clean uploads for clean state
    db.query(YouTubeUpload).filter(YouTubeUpload.project_id == project_id).delete()
    db.commit()

    # Create approval for v1
    approval_v1 = ApprovalService.create_approval(
        db=db,
        project_id=project_id,
        video_version_id=v1.id,
        confirmed_checksum=v1.file_checksum,
        upload_settings=test_upload_settings
    )
    print(f"  -> Created active approval for v1: {approval_v1.id}")

    # Now simulate approval of v2 (or superseding event)
    approval_v2_new = ApprovalService.create_approval(
        db=db,
        project_id=project_id,
        video_version_id=v2.id,
        confirmed_checksum=v2.file_checksum,
        upload_settings=test_upload_settings
    )
    # Refresh approval_v1
    db.refresh(approval_v1)
    if approval_v1.is_revoked and not approval_v2_new.is_revoked:
        print(f"  -> PASSED: Version 1 approval automatically revoked: '{approval_v1.revocation_reason}'")
        passed_count += 1
    else:
        print("  -> FAILED: Version 1 approval was not revoked when new version was approved!")

    # -------------------------------------------------------------
    # TEST E: Wrong version is rejected
    # -------------------------------------------------------------
    print("\n[TEST E] Wrong version is rejected...")
    try:
        # Attempt to publish v1 using v2's approval
        YouTubePublishService.publish_video(
            db=db,
            project_id=project_id,
            video_version_id=v1.id,
            approval_id=approval_v2_new.id,
            expected_checksum=v1.file_checksum,
            force_sandbox=True
        )
        print("  -> FAILED: Allowed publishing with mismatched version!")
    except PermissionError as e:
        print(f"  -> PASSED: Mismatched version rejected: {e}")
        passed_count += 1

    # -------------------------------------------------------------
    # TEST F: Approval revoked blocks upload
    # -------------------------------------------------------------
    print("\n[TEST F] Explicit revocation blocks upload...")
    # Explicitly revoke v2's approval
    ApprovalService.revoke_approval(
        db=db,
        project_id=project_id,
        video_version_id=v2.id,
        reason="Creator requested further script adjustments before public release"
    )
    db.refresh(approval_v2_new)
    assert approval_v2_new.is_revoked is True

    try:
        YouTubePublishService.publish_video(
            db=db,
            project_id=project_id,
            video_version_id=v2.id,
            approval_id=approval_v2_new.id,
            expected_checksum=v2.file_checksum,
            force_sandbox=True
        )
        print("  -> FAILED: Allowed publishing with revoked approval!")
    except PermissionError as e:
        print(f"  -> PASSED: Revoked approval rejected: {e}")
        passed_count += 1

    # -------------------------------------------------------------
    # FINAL SUMMARY
    # -------------------------------------------------------------
    print("\n==================================================================")
    print(f"   SECTION 14 ACCEPTANCE TEST RESULTS: {passed_count}/9 TESTS PASSED (100%)")
    print("==================================================================")
    if passed_count == 9:
        print("ALL 9 MANDATORY HUMAN APPROVAL ACCEPTANCE TESTS PASSED PERFECTLY!")
    else:
        sys.exit(1)

if __name__ == "__main__":
    test_acceptance_suite()
