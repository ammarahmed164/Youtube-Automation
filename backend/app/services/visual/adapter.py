from abc import ABC, abstractmethod
from typing import List, Dict, Any

class BaseVisualService(ABC):
    """Abstract Base Class for visual assets acquisition (Stock footage, AI images, templates)."""
    
    @abstractmethod
    async def search_stock_footage(self, query: str, duration_needed_seconds: float) -> List[Dict[str, Any]]:
        """Search stock footage with licensing/attribution metadata."""
        pass

