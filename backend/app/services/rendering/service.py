from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, Any

class BaseRenderingService(ABC):
    """Abstract Base Class for FFmpeg video compilation."""
    
    @abstractmethod
    async def render_video(self, project_id: str, manifest: Dict[str, Any], output_path: Path) -> Dict[str, Any]:
        """Render complete 1080p MP4 with transitions, music ducking, and subtitles."""
        pass

