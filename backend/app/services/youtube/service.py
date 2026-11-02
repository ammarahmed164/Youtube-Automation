from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseYouTubeService(ABC):
    """Abstract Base Class for YouTube OAuth and publishing."""
    
    @abstractmethod
    async def validate_approval_and_upload(self, approval_id: str, version_id: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Validate explicit user approval gatekeeper before triggering upload job."""
        pass

