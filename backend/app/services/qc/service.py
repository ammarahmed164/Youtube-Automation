from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, Any

class BaseQCService(ABC):
    """Abstract Base Class for Automated Quality Checks."""
    
    @abstractmethod
    async def verify_video(self, video_path: Path, expected_duration_seconds: float) -> Dict[str, Any]:
        """Verify video readability, audio presence, gaps, and duration tolerance."""
        pass

