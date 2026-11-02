from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.script import ScriptResponse, ScriptUpdateInput
from app.services.script_service import ScriptService

router = APIRouter()

@router.post("/{project_id}/generate-script", response_model=ScriptResponse, status_code=status.HTTP_201_CREATED)
async def generate_script(project_id: str, db: Session = Depends(get_db)):
    """
    Trigger Gemini to research, write documentary script, and plan structured scenes.
    Saves to Supabase and advances status to 'script_review'.
    """
    try:
        revision = await ScriptService.generate_project_script(db=db, project_id=project_id)
        return revision
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

@router.get("/{project_id}/script", response_model=ScriptResponse)
def get_script(project_id: str, db: Session = Depends(get_db)):
    """Get the latest generated script revision and scene breakdown."""
    revision = ScriptService.get_latest_script(db=db, project_id=project_id)
    if not revision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No script found for project '{project_id}'. Please generate a script first."
        )
    return revision

@router.patch("/{project_id}/script", response_model=ScriptResponse)
def update_script(project_id: str, update_in: ScriptUpdateInput, db: Session = Depends(get_db)):
    """Manually edit or polish the documentary script text."""
    revision = ScriptService.update_script(db=db, project_id=project_id, update_in=update_in)
    if not revision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No script found for project '{project_id}' to update."
        )
    return revision

