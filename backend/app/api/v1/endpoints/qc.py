from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.project import Project
from app.models.video import VideoVersion, QualityCheck
from app.schemas.qc import QualityCheckResponse
from app.schemas.modification import ModificationRequest, ModificationResponse
from app.schemas.video import VideoVersionResponse
from app.services.qc.service import QualityCheckService
from app.services.qc.modification_service import ModificationService

router = APIRouter()

@router.post("/{project_id}/quality-check", response_model=QualityCheckResponse, status_code=status.HTTP_200_OK)
def run_project_quality_check(
    project_id: str,
    version: Optional[int] = Query(None, description="Specific video version, defaults to latest"),
    db: Session = Depends(get_db)
):
    """
    Run automated broadcast-grade Quality Control (QC) checks on a rendered documentary video:
    File integrity, duration tolerance (<= 20 min rule), 1080p resolution, audio loudness, subtitle sync.
    """
    query = db.query(VideoVersion).filter(VideoVersion.project_id == project_id)
    if version:
        video_rec = query.filter(VideoVersion.version_number == version).first()
    else:
        video_rec = query.order_by(VideoVersion.version_number.desc()).first()

    if not video_rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No rendered video version found for project '{project_id}'. Please render video first."
        )

    qc_record = QualityCheckService.verify_video(video_version=video_rec, db=db)
    
    # Calculate score percentage
    total_checks = len(qc_record.check_results)
    passed_count = sum(1 for c in qc_record.check_results.values() if c.get("passed"))
    score = int((passed_count / total_checks) * 100) if total_checks > 0 else 0
    overall_status = "ALL_CHECKS_PASSED" if score == 100 else ("WARNINGS_DETECTED" if qc_record.passed else "FAILED")

    return QualityCheckResponse(
        id=qc_record.id,
        video_version_id=qc_record.video_version_id,
        passed=qc_record.passed,
        overall_status=overall_status,
        score_percent=score,
        check_results=qc_record.check_results,
        warnings=qc_record.warnings or [],
        created_at=qc_record.created_at
    )

@router.get("/{project_id}/quality-check", response_model=QualityCheckResponse)
def get_project_quality_check(
    project_id: str,
    version: Optional[int] = Query(None, description="Specific video version, defaults to latest"),
    db: Session = Depends(get_db)
):
    """Retrieve existing Quality Control (QC) results for the project."""
    query = db.query(VideoVersion).filter(VideoVersion.project_id == project_id)
    if version:
        video_rec = query.filter(VideoVersion.version_number == version).first()
    else:
        video_rec = query.order_by(VideoVersion.version_number.desc()).first()

    if not video_rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No rendered video version found.")

    qc_record = db.query(QualityCheck).filter(QualityCheck.video_version_id == video_rec.id).first()
    if not qc_record:
        # If not already checked, run it now automatically
        qc_record = QualityCheckService.verify_video(video_version=video_rec, db=db)

    total_checks = len(qc_record.check_results)
    passed_count = sum(1 for c in qc_record.check_results.values() if c.get("passed"))
    score = int((passed_count / total_checks) * 100) if total_checks > 0 else 0
    overall_status = "ALL_CHECKS_PASSED" if score == 100 else ("WARNINGS_DETECTED" if qc_record.passed else "FAILED")

    return QualityCheckResponse(
        id=qc_record.id,
        video_version_id=qc_record.video_version_id,
        passed=qc_record.passed,
        overall_status=overall_status,
        score_percent=score,
        check_results=qc_record.check_results,
        warnings=qc_record.warnings or [],
        created_at=qc_record.created_at
    )

@router.post("/{project_id}/modify", response_model=ModificationResponse, status_code=status.HTTP_200_OK)
async def modify_documentary(
    project_id: str,
    request: ModificationRequest,
    db: Session = Depends(get_db)
):
    """
    AI Natural Language Modification Workflow:
    Takes creator's prompt in natural language, identifies targeted affected scenes,
    re-synthesizes narration/visuals, renders new video version (v2),
    invalidates old approvals, and re-executes quality checks.
    """
    try:
        result = await ModificationService.process_modification(
            db=db,
            project_id=project_id,
            user_prompt=request.prompt,
            auto_rerender=request.auto_rerender
        )

        new_vid_resp = None
        if result.get("new_video_version"):
            new_vid_resp = VideoVersionResponse.model_validate(result["new_video_version"])

        qc_resp = None
        qc_rec = result.get("quality_check")
        if qc_rec:
            total_checks = len(qc_rec.check_results)
            passed_count = sum(1 for c in qc_rec.check_results.values() if c.get("passed"))
            score = int((passed_count / total_checks) * 100) if total_checks > 0 else 0
            overall_status = "ALL_CHECKS_PASSED" if score == 100 else ("WARNINGS_DETECTED" if qc_rec.passed else "FAILED")

            qc_resp = QualityCheckResponse(
                id=qc_rec.id,
                video_version_id=qc_rec.video_version_id,
                passed=qc_rec.passed,
                overall_status=overall_status,
                score_percent=score,
                check_results=qc_rec.check_results,
                warnings=qc_rec.warnings or [],
                created_at=qc_rec.created_at
            )

        return ModificationResponse(
            status="success",
            project_id=project_id,
            plan_summary=result["plan_summary"],
            affected_scenes=result["affected_scenes"],
            re_rendered=result["re_rendered"],
            new_video_version=new_vid_resp,
            quality_check=qc_resp,
            message=result["message"]
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

