from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseAIService(ABC):
    """Abstract Base Class for AI script, research, and scene planning providers."""
    
    @abstractmethod
    async def generate_script(self, topic: str, target_duration_minutes: int, tone: str) -> Dict[str, Any]:
        """Generate structured documentary script."""
        pass

    @abstractmethod
    async def plan_scenes(self, script_text: str, target_duration_minutes: int) -> Dict[str, Any]:
        """Break down script into structured scenes."""
        pass

