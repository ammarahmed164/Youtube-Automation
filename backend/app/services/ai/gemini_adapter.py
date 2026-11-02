import json
import logging
from typing import Dict, Any, List
from google import genai
from google.genai import types
from app.core.config import settings
from app.schemas.script import DocumentaryScriptPlan
from app.services.ai.adapter import BaseAIService

logger = logging.getLogger(__name__)

class GeminiService(BaseAIService):
    def __init__(self, api_key: str = ""):
        self.api_key = api_key or settings.GEMINI_API_KEY
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None

    def is_configured(self) -> bool:
        return bool(self.api_key and self.client)

    async def generate_script(
        self,
        topic: str,
        target_duration_minutes: int,
        tone: str = "documentary",
        language: str = "English",
        scene_planning_mode: str = "automatic",
        desired_scene_count: int = None
    ) -> DocumentaryScriptPlan:
        """
        Generate structured documentary script and scene plan using Gemini 2.5 Flash.
        """
        if not self.is_configured():
            raise ValueError(
                "Gemini API key is not configured. Please configure GEMINI_API_KEY in backend/.env"
            )

        # Duration budgeting
        # Narration speed ~130-140 words per minute
        target_duration_minutes = min(target_duration_minutes, 20)
        total_seconds = target_duration_minutes * 60
        target_word_count = int(target_duration_minutes * 135)
        
        if scene_planning_mode == "manual" and desired_scene_count:
            scene_instruction = f"Divide the documentary into EXACTLY {desired_scene_count} distinct scenes."
        else:
            # Auto: ~30-60 seconds per scene
            estimated_scenes = max(4, min(24, int(total_seconds / 45)))
            scene_instruction = f"Divide the documentary into approximately {estimated_scenes} cohesive cinematic scenes (average 30-50 seconds per scene)."

        system_instruction = f"""
You are an award-winning YouTube Documentary Director and Senior Investigative Researcher.
Your task is to write a deeply engaging, professional documentary script and scene breakdown.

CRITICAL RULES:
1. TRUTHFULNESS: Never invent facts. Clearly distinguish verified historical/scientific facts, uncertain hypotheses, and narrative storytelling in the research_sources field.
2. DURATION PACING: The user requested a {target_duration_minutes}-minute documentary (approx {target_word_count} words total). Ensure the scenes' estimated durations closely sum up to ~{total_seconds} seconds.
3. VISUAL DIRECTION: Every scene must have vivid, actionable visual directions, realistic stock footage search keywords, or AI image prompts.
4. TONE & LANGUAGE: Write in a {tone} tone in {language}.
5. {scene_instruction}
"""

        user_prompt = f"""
Create a full documentary plan for:
TOPIC: {topic}
TARGET DURATION: {target_duration_minutes} Minutes (~{total_seconds} seconds)
LANGUAGE: {language}
TONE: {tone}

Output the result strictly matching the structured schema.
"""

        try:
            # Call Gemini model using official SDK with structured JSON output schema
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    response_schema=DocumentaryScriptPlan,
                    temperature=0.7,
                ),
            )

            result_json = json.loads(response.text)
            return DocumentaryScriptPlan.model_validate(result_json)

        except Exception as e:
            logger.error(f"Gemini script generation failed: {e}")
            raise RuntimeError(f"Gemini API generation error: {str(e)}")

    async def plan_scenes(self, script_text: str, target_duration_minutes: int) -> Dict[str, Any]:
        """Ad-hoc scene re-planning."""
        pass

