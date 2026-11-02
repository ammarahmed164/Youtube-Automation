from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, Any

class BaseTTSService(ABC):
    """Abstract Base Class for Text-to-Speech generation."""
    
    @abstractmethod
    async def synthesize_scene(self, scene_id: str, text: str, voice_preset: str, output_path: Path) -> Dict[str, Any]:
        """Synthesize scene narration and return measured audio duration."""
        pass

