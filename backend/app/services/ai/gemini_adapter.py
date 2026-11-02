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
    """
    Production-grade Gemini AI service with multi-key failover & automatic quota rotation.
    If one API key hits rate limits (429 / QuotaExceeded), it automatically rotates to the next key.
    """
    _current_key_index: int = 0

    def __init__(self, api_key: str = ""):
        if api_key:
            self.keys = [api_key]
        else:
            self.keys = settings.get_gemini_keys()

    def is_configured(self) -> bool:
        return len(self.keys) > 0

    def get_client_for_key(self, key: str) -> genai.Client:
        return genai.Client(api_key=key)

    async def generate_script(
        self,
        topic: str,
        target_duration_minutes: int,
        tone: str = "documentary",
        language: str = "English",
        scene_planning_mode: str = "automatic",
        desired_scene_count: int = None
    ) -> DocumentaryScriptPlan:
        if not self.is_configured():
            raise ValueError(
                "Gemini API key is not configured. Please configure GEMINI_API_KEY in backend/.env"
            )

        target_duration_minutes = min(target_duration_minutes, 20)
        total_seconds = target_duration_minutes * 60
        target_word_count = int(target_duration_minutes * 135)

        if scene_planning_mode == "manual" and desired_scene_count:
            scene_instruction = f"Divide the documentary into EXACTLY {desired_scene_count} distinct scenes."
        else:
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

        num_keys = len(self.keys)
        last_exception = None

        # Try keys sequentially starting from current active index
        for attempt in range(num_keys):
            key_idx = (GeminiService._current_key_index + attempt) % num_keys
            current_key = self.keys[key_idx]

            try:
                client = self.get_client_for_key(current_key)
                logger.info(f"Calling Gemini model using key index {key_idx + 1} of {num_keys}...")

                response = client.models.generate_content(
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
                plan = DocumentaryScriptPlan.model_validate(result_json)

                # Update current active key index on success
                GeminiService._current_key_index = key_idx
                return plan

            except Exception as e:
                error_str = str(e)
                logger.warning(
                    f"Gemini API key {key_idx + 1}/{num_keys} encountered error: {error_str}"
                )
                last_exception = e

                # Check if error is quota, rate limit, or 429
                is_quota_error = any(
                    err in error_str.lower()
                    for err in ["429", "quota", "resourceexhausted", "rate limit"]
                )

                if is_quota_error and attempt < num_keys - 1:
                    logger.warning(
                        f"Quota limit hit on key {key_idx + 1}. Auto-failing over to key {((key_idx + 1) % num_keys) + 1}..."
                    )
                    continue
                elif attempt < num_keys - 1:
                    # Also fallback on network/transient issues
                    logger.warning(
                        f"Error on key {key_idx + 1}. Trying next key in pool..."
                    )
                    continue
                else:
                    break

        raise RuntimeError(
            f"All {num_keys} Gemini API keys failed or exhausted their quota. Last error: {str(last_exception)}"
        )

    async def plan_scenes(self, script_text: str, target_duration_minutes: int) -> Dict[str, Any]:
        pass
