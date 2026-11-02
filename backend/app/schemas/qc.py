from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

class QualityCheckDetail(BaseModel):
    check_name: str
    passed: bool
    status_label: str # "PASSED", "WARNING", "FAILED"
    message: str
    details: Optional[Dict[str, Any]] = None

class QualityCheckResponse(BaseModel):
    id: str
    video_version_id: str
    passed: bool
    overall_status: str # "ALL_CHECKS_PASSED", "WARNINGS_DETECTED", "FAILED"
    score_percent: int # 0 to 100
    check_results: Dict[str, Any]
    warnings: List[str] = []
    created_at: datetime

    model_config = {"from_attributes": True}

