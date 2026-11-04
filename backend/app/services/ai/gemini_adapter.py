import json
import logging
from typing import Dict, Any, List
from google import genai
from google.genai import types
from app.core.config import settings
from app.schemas.script import DocumentaryScriptPlan, ScenePlanItem
from app.schemas.modification import DocumentaryModificationPlan
from app.services.ai.adapter import BaseAIService
from pydantic import BaseModel, Field

class SceneRewriteResult(BaseModel):
    scene_title: str = Field(description="Enhanced scene title")
    purpose: str = Field(description="Narrative objective")
    narration_text: str = Field(description="Polished, powerful voiceover narration in the documentary language")
    visual_description: str = Field(description="Cinematic visual direction for this scene")
    stock_keywords: List[str] = Field(default_factory=list, description="2-4 search keywords")
    on_screen_text: str = Field(default="", description="Key on-screen text or headline")

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

    async def parse_modification_plan(
        self,
        current_scenes_summary: str,
        user_request: str
    ) -> DocumentaryModificationPlan:
        """
        Interprets natural language modification requests and maps them to targeted scene deltas.
        Preserves unaffected scenes to prevent unnecessary re-rendering.
        """
        if not self.is_configured():
            raise ValueError("Gemini API key is not configured.")

        system_instruction = """
You are an award-winning YouTube Documentary Director and Senior Video Editor.
The creator wants to revise or refine their rendered documentary based on natural language instructions.

CRITICAL EDITING PRINCIPLES:
1. TARGETED EDITS: Identify ONLY the scene(s) the creator wants to modify. NEVER change unaffected scenes.
2. PRESERVE PACING: Ensure revised narration sounds punchy, natural, and matches documentary narration speed (~130 words/minute).
3. VISUALS: If the creator asks to change visual/image/footage, update visual_description and stock_keywords accordingly.
4. ON-SCREEN TEXT: If the creator asks for titles, graphics, or stats, provide updated_on_screen_text.
5. Return strictly structured JSON matching DocumentaryModificationPlan.
"""

        user_prompt = f"""
CURRENT DOCUMENTARY SCENES BREAKDOWN:
{current_scenes_summary}

CREATOR'S REVISION REQUEST:
"{user_request}"

Generate the targeted modification plan identifying exactly which scenes to update and what changes to apply.
"""

        num_keys = len(self.keys)
        last_exception = None

        for attempt in range(num_keys):
            key_idx = (GeminiService._current_key_index + attempt) % num_keys
            current_key = self.keys[key_idx]

            try:
                client = self.get_client_for_key(current_key)
                logger.info(f"Calling Gemini modification parser using key {key_idx + 1}/{num_keys}...")

                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=user_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        response_mime_type="application/json",
                        response_schema=DocumentaryModificationPlan,
                        temperature=0.4,
                    ),
                )

                result_json = json.loads(response.text)
                plan = DocumentaryModificationPlan.model_validate(result_json)
                GeminiService._current_key_index = key_idx
                return plan

            except Exception as e:
                error_str = str(e)
                logger.warning(f"Gemini API key {key_idx + 1} modification error: {error_str}")
                last_exception = e
                if attempt < num_keys - 1:
                    continue
                else:
                    break

        raise RuntimeError(
            f"All Gemini API keys failed parsing modification request: {str(last_exception)}"
        )

    async def generate_single_scene(
        self,
        topic: str,
        language: str,
        tone: str,
        scene_number: int,
        existing_scenes_summary: str,
        user_prompt: str = None
    ) -> ScenePlanItem:
        """
        Generates a single cohesive scene matching the documentary's topic, tone, and language.
        Can be guided by optional creator prompt or automatically inferred from surrounding narrative.
        """
        if not self.is_configured():
            raise ValueError("Gemini API key is not configured.")

        system_instruction = f"""
You are an award-winning YouTube Documentary Director and Senior Investigative Researcher.
Your task is to write ONE cohesive, powerful documentary scene for this documentary.

CRITICAL RULES:
1. TRUTHFULNESS: Never invent facts. Keep historical/scientific narrative accurate and engaging.
2. DURATION PACING: Aim for 30-50 seconds (~70-110 words) of spoken narration.
3. LANGUAGE & SCRIPT: The narration MUST be written in {language}.
4. TONE: Maintain a {tone} documentary tone.
5. VISUAL DIRECTION: Provide realistic visual description and 2-4 English stock search keywords.
6. Return strictly structured JSON matching ScenePlanItem.
"""

        prompt = f"""
DOCUMENTARY TOPIC: {topic}
LANGUAGE: {language}
TONE: {tone}
NEW SCENE NUMBER: {scene_number}

PREVIOUS DOCUMENTARY CONTEXT:
{existing_scenes_summary}

CREATOR'S SPECIFIC INSTRUCTION FOR THIS SCENE:
{user_prompt or "Create a compelling new scene that naturally expands and enriches the documentary narrative."}

Generate the scene matching ScenePlanItem schema.
"""

        num_keys = len(self.keys)
        last_exception = None

        for attempt in range(num_keys):
            key_idx = (GeminiService._current_key_index + attempt) % num_keys
            current_key = self.keys[key_idx]

            try:
                client = self.get_client_for_key(current_key)
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        response_mime_type="application/json",
                        response_schema=ScenePlanItem,
                        temperature=0.7,
                    ),
                )
                result_json = json.loads(response.text)
                scene_plan = ScenePlanItem.model_validate(result_json)
                scene_plan.scene_order = scene_number
                scene_plan.scene_id_str = f"scene_{scene_number:02d}"
                GeminiService._current_key_index = key_idx
                return scene_plan
            except Exception as e:
                logger.warning(f"Gemini API key {key_idx + 1} single scene generation error: {e}")
                last_exception = e
                if attempt < num_keys - 1:
                    continue
                else:
                    break

        raise RuntimeError(f"Failed to generate scene with Gemini AI: {str(last_exception)}")

    async def rewrite_scene_narration(
        self,
        current_narration: str,
        topic: str,
        language: str,
        tone: str,
        instructions: str = None
    ) -> SceneRewriteResult:
        """
        Rewrites or enhances an existing scene's voiceover narration and visual guidance with Gemini AI.
        """
        if not self.is_configured():
            raise ValueError("Gemini API key is not configured.")

        system_instruction = f"""
You are a master YouTube Documentary Script Doctor and Visual Director.
Your task is to refine, rewrite, and elevate a specific documentary scene.

CRITICAL RULES:
1. Polish the voiceover narration so it sounds natural, broadcast-grade, and engaging when spoken.
2. The narration MUST be written in {language}.
3. TONE: Maintain a {tone} documentary tone.
4. Keep the length paced for voiceover (~30-55 seconds).
5. Output strictly matching SceneRewriteResult JSON.
"""

        prompt = f"""
DOCUMENTARY TOPIC: {topic}
LANGUAGE: {language}
TONE: {tone}

CURRENT SCENE NARRATION:
"{current_narration}"

CREATOR'S REWRITE REQUEST:
{instructions or "Improve and polish the narration text to make it more cinematic, authoritative, and emotionally engaging while maintaining strict factual accuracy."}

Output refined scene matching SceneRewriteResult.
"""

        num_keys = len(self.keys)
        last_exception = None

        for attempt in range(num_keys):
            key_idx = (GeminiService._current_key_index + attempt) % num_keys
            current_key = self.keys[key_idx]

            try:
                client = self.get_client_for_key(current_key)
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        response_mime_type="application/json",
                        response_schema=SceneRewriteResult,
                        temperature=0.7,
                    ),
                )
                result_json = json.loads(response.text)
                rewrite = SceneRewriteResult.model_validate(result_json)
                GeminiService._current_key_index = key_idx
                return rewrite
            except Exception as e:
                logger.warning(f"Gemini API key {key_idx + 1} scene rewrite error: {e}")
                last_exception = e
                if attempt < num_keys - 1:
                    continue
                else:
                    break

        raise RuntimeError(f"Failed to rewrite scene with Gemini AI: {str(last_exception)}")

    async def plan_scenes(self, script_text: str, target_duration_minutes: int) -> Dict[str, Any]:
        pass
