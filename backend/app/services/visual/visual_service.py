import io
import os
import json
import uuid
import logging
import urllib.request
import urllib.parse
from pathlib import Path
from typing import List, Dict, Any, Optional

from PIL import Image, ImageDraw, ImageFont
from sqlalchemy.orm import Session

from app.core.config import settings, BASE_DIR
from app.models.generation import Scene, SceneAsset
from app.services.visual.adapter import BaseVisualService

logger = logging.getLogger(__name__)

class VisualService(BaseVisualService):
    """
    Multi-source Visual Asset Engine:
    1. Primary: NASA Open Image Archive API (Free, high-definition, public domain)
    2. Fallback: Procedural Cinematic Documentary Canvas (1920x1080 Pillow typography cards)
    3. User Custom Upload: Direct custom image/video integration
    """

    @classmethod
    def _get_font(cls, size: int) -> ImageFont.ImageFont:
        """Helper to load a clean modern system font on Windows or default to Pillow font."""
        font_dir = os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "Fonts")
        preferred_fonts = ["segoeui.ttf", "arial.ttf", "calibri.ttf"]
        
        for fname in preferred_fonts:
            fpath = os.path.join(font_dir, fname)
            if os.path.exists(fpath):
                try:
                    return ImageFont.truetype(fpath, size)
                except Exception:
                    continue
        return ImageFont.load_default()

    @classmethod
    def download_and_format_image(cls, url: str, output_path: Path) -> bool:
        """
        Downloads an image from URL, resizes and center-crops it to exactly 1920x1080 (16:9 full HD).
        """
        try:
            if url.startswith("http://"):
                url = "https://" + url[7:]
                
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AIYouTubeStudio/1.0"}
            )
            with urllib.request.urlopen(req, timeout=12) as response:
                img_data = response.read()

            img = Image.open(io.BytesIO(img_data)).convert("RGB")
            
            target_w, target_h = 1920, 1080
            w, h = img.size
            if w <= 0 or h <= 0:
                return False

            scale = max(target_w / w, target_h / h)
            new_w, new_h = int(w * scale), int(h * scale)
            resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

            left = (new_w - target_w) // 2
            top = (new_h - target_h) // 2
            cropped = resized.crop((left, top, left + target_w, top + target_h))

            output_path.parent.mkdir(parents=True, exist_ok=True)
            cropped.save(output_path, "JPEG", quality=92, optimize=True)
            return True
        except Exception as e:
            logger.warning(f"Failed to download/format image from {url}: {e}")
            return False

    @classmethod
    def generate_procedural_canvas(
        cls,
        scene_title: str,
        scene_order: int,
        output_path: Path,
        visual_description: Optional[str] = None
    ) -> bool:
        """
        Creates a high-res 1920x1080 dark cinematic documentary title card.
        Guarantees that every single scene has a pristine HD visual asset.
        """
        try:
            img = Image.new("RGB", (1920, 1080), color=(10, 15, 30))
            draw = ImageDraw.Draw(img)

            # Draw vertical atmospheric cosmic gradient
            for y in range(1080):
                factor = y / 1080.0
                r = int(6 + 10 * factor)
                g = int(9 + 15 * factor)
                b = int(20 + 26 * factor)
                draw.line([(0, y), (1920, y)], fill=(r, g, b))

            # Cinematic frame borders
            draw.rectangle([(60, 60), (1860, 1020)], outline=(35, 55, 95), width=2)
            draw.rectangle([(80, 80), (1840, 1000)], outline=(18, 32, 60), width=1)

            # High-tech corner accents
            bracket_len = 50
            accent_color = (80, 140, 240)
            # Top-left
            draw.line([(50, 50), (50 + bracket_len, 50)], fill=accent_color, width=4)
            draw.line([(50, 50), (50, 50 + bracket_len)], fill=accent_color, width=4)
            # Top-right
            draw.line([(1870, 50), (1870 - bracket_len, 50)], fill=accent_color, width=4)
            draw.line([(1870, 50), (1870, 50 + bracket_len)], fill=accent_color, width=4)
            # Bottom-left
            draw.line([(50, 1030), (50 + bracket_len, 1030)], fill=accent_color, width=4)
            draw.line([(50, 1030), (50, 1030 - bracket_len)], fill=accent_color, width=4)
            # Bottom-right
            draw.line([(1870, 1030), (1870 - bracket_len, 1030)], fill=accent_color, width=4)
            draw.line([(1870, 1030), (1870, 1030 - bracket_len)], fill=accent_color, width=4)

            # Fonts
            font_tag = cls._get_font(26)
            font_title = cls._get_font(52)
            font_desc = cls._get_font(28)
            font_footer = cls._get_font(22)

            # Header tag
            tag_text = f"DOCUMENTARY CHAPTER // SCENE {scene_order:02d}"
            draw.text((120, 120), tag_text, fill=(120, 170, 255), font=font_tag)

            # Scene Title
            clean_title = (scene_title or f"Scene {scene_order}").strip()
            if len(clean_title) > 65:
                clean_title = clean_title[:62] + "..."
            draw.text((120, 460), clean_title, fill=(245, 248, 255), font=font_title)

            # Visual direction / context summary
            if visual_description:
                desc_line = visual_description.strip()
                if len(desc_line) > 95:
                    desc_line = desc_line[:92] + "..."
                draw.text((120, 560), desc_line, fill=(140, 165, 200), font=font_desc)

            # Footer signature
            footer_text = "AI DOCUMENTARY STUDIO  |  HIGH RESOLUTION VISUAL ENGINE"
            draw.text((120, 940), footer_text, fill=(80, 105, 150), font=font_footer)

            output_path.parent.mkdir(parents=True, exist_ok=True)
            img.save(output_path, "JPEG", quality=95)
            return True
        except Exception as e:
            logger.error(f"Failed to generate procedural canvas: {e}")
            return False

    @classmethod
    def search_nasa_archive(
        cls,
        keywords: List[str],
        scene_title: str
    ) -> Optional[Dict[str, Any]]:
        """
        Queries NASA Image and Video Library for public domain high-resolution imagery.
        Tries multiple keywords and fallback queries.
        """
        search_terms = []
        if keywords:
            search_terms.extend([k.strip() for k in keywords if k and len(k.strip()) > 2])
        if scene_title:
            search_terms.append(scene_title.strip())
        
        # General space / science fallbacks if queries are exhausted
        search_terms.extend(["James Webb Telescope", "Hubble Deep Field", "Nebula", "Galaxy Stars"])

        for term in search_terms:
            try:
                encoded_query = urllib.parse.quote(term)
                url = f"https://images-api.nasa.gov/search?q={encoded_query}&media_type=image"
                req = urllib.request.Request(
                    url,
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AIYouTubeStudio/1.0"}
                )
                with urllib.request.urlopen(req, timeout=6) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                
                items = data.get("collection", {}).get("items", [])
                if not items:
                    continue

                for item in items[:4]:
                    links = item.get("links", [])
                    item_data = item.get("data", [{}])[0]
                    
                    if not links:
                        continue
                    
                    raw_href = links[0].get("href", "")
                    if not raw_href:
                        continue

                    # NASA thumbnail is ~thumb.jpg; prefer ~medium.jpg or ~orig.jpg for high clarity
                    high_res_href = raw_href.replace("~thumb.jpg", "~medium.jpg")
                    
                    title = item_data.get("title", term)
                    nasa_center = item_data.get("center", "NASA")
                    photographer = item_data.get("photographer", "")
                    attribution = f"NASA / {nasa_center}" + (f" ({photographer})" if photographer else "")

                    return {
                        "url": high_res_href,
                        "fallback_url": raw_href,
                        "title": title,
                        "attribution": attribution,
                        "license_notes": "NASA Public Domain / Open Media",
                        "matched_query": term
                    }
            except Exception as e:
                logger.debug(f"NASA search failed for term '{term}': {e}")
                continue

        return None

    @classmethod
    async def search_stock_footage(cls, query: str, duration_needed_seconds: float) -> List[Dict[str, Any]]:
        """Implementation of BaseVisualService abstract method."""
        result = cls.search_nasa_archive([query], query)
        if result:
            return [result]
        return []

    @classmethod
    def download_pollinations_image(
        cls,
        prompt: str,
        output_path: Path,
        seed: Optional[int] = None
    ) -> bool:
        """
        Generates an ultra high-definition 1920x1080 cinematic visual via Pollinations AI (Flux model).
        100% Free, photorealistic, with no API key requirement.
        """
        try:
            clean_prompt = prompt.replace("\n", " ").strip()
            encoded = urllib.parse.quote(clean_prompt)
            seed_param = f"&seed={seed}" if seed else ""
            url = f"https://image.pollinations.ai/prompt/{encoded}?width=1920&height=1080&model=flux&nologo=true{seed_param}"
            return cls.download_and_format_image(url, output_path)
        except Exception as e:
            logger.warning(f"Pollinations AI image generation failed for prompt '{prompt[:40]}...': {e}")
            return False

    @classmethod
    def generate_scene_b_rolls(
        cls,
        scene: Scene,
        project_dir: Path,
        force_regenerate: bool = False
    ) -> List[Path]:
        """
        Generates 2 to 3 dynamic B-roll visual cuts per scene for rapid documentary pacing (every 4-6s).
        Saves cuts as scene_XX_b01.jpg, scene_XX_b02.jpg, etc.
        """
        visuals_dir = project_dir / "visuals"
        visuals_dir.mkdir(parents=True, exist_ok=True)
        
        duration = scene.actual_audio_duration_seconds or scene.estimated_duration_seconds or 20.0
        cuts_needed = max(2, min(4, int(duration // 5.5)))

        keywords = scene.stock_keywords or []
        if isinstance(keywords, str):
            keywords = [k.strip() for k in keywords.split(",") if k.strip()]

        created_cuts = []
        b_roll_prompts = [
            f"{keywords[0] if keywords else scene.scene_title}, cinematic space documentary, photorealistic 8k, Hubble deep field, vivid colors, IMAX 70mm, volumetric atmospheric light",
            f"{keywords[1] if len(keywords) > 1 else 'cosmic exploration'}, {scene.scene_title}, celestial mechanics, dramatic cinematic lighting, 8k photography, highly detailed wallpaper",
            f"breathtaking cosmic perspective, deep space nebula starfield, {scene.scene_title}, photorealistic 8k wallpaper, award winning national geographic astronomy cinematography"
        ]

        for i in range(1, cuts_needed):
            b_name = f"{scene.scene_id_str}_b{i:02d}.jpg"
            b_path = visuals_dir / b_name
            if b_path.exists() and not force_regenerate and b_path.stat().st_size > 5000:
                created_cuts.append(b_path)
                continue

            prompt = b_roll_prompts[(i - 1) % len(b_roll_prompts)]
            seed = scene.scene_order * 100 + i * 17
            ok = cls.download_pollinations_image(prompt, b_path, seed=seed)
            if ok and b_path.exists():
                created_cuts.append(b_path)

        return created_cuts

    @classmethod
    def generate_scene_visual(
        cls,
        scene: Scene,
        project_dir: Path,
        force_regenerate: bool = False
    ) -> Dict[str, Any]:
        """
        Acquires or synthesizes a 1920x1080 visual for a single scene:
        1. If already exists and not force_regenerate, reuse.
        2. Try NASA Image Search.
        3. Try Photorealistic AI Generation via Pollinations (FLUX).
        4. If failed, generate rich procedural documentary card.
        """
        visuals_dir = project_dir / "visuals"
        visuals_dir.mkdir(parents=True, exist_ok=True)
        
        target_filename = f"{scene.scene_id_str}.jpg"
        target_path = visuals_dir / target_filename
        rel_path = f"workspace_data/projects/{scene.project_id}/visuals/{target_filename}"

        if target_path.exists() and not force_regenerate and target_path.stat().st_size > 5000:
            # Also ensure B-rolls exist
            cls.generate_scene_b_rolls(scene=scene, project_dir=project_dir, force_regenerate=force_regenerate)
            return {
                "scene_id": scene.id,
                "file_path": rel_path,
                "asset_type": "image",
                "source_provider": "cached_asset",
                "attribution": "Existing Project Asset",
                "license_notes": "Project Workspace Asset"
            }

        keywords = scene.stock_keywords or []
        if isinstance(keywords, str):
            keywords = [k.strip() for k in keywords.split(",") if k.strip()]

        nasa_result = cls.search_nasa_archive(keywords=keywords, scene_title=scene.scene_title or "")
        
        saved = False
        source_provider = "nasa_archive"
        source_url = None
        attribution = "NASA Public Domain"
        license_notes = "NASA Guidelines / Public Domain"

        if nasa_result:
            source_url = nasa_result["url"]
            attribution = nasa_result["attribution"]
            license_notes = nasa_result["license_notes"]
            saved = cls.download_and_format_image(nasa_result["url"], target_path)
            
            # If high-res URL failed, try fallback thumbnail URL
            if not saved and nasa_result.get("fallback_url"):
                saved = cls.download_and_format_image(nasa_result["fallback_url"], target_path)

        if not saved:
            # Try Photorealistic AI Generation via Pollinations (FLUX / cinematic)
            cinematic_prompt = f"{scene.scene_title or ''}, {scene.visual_description or 'deep space astronomy'}, cinematic documentary 8k, photorealistic photography, IMAX 70mm, volumetric lighting"
            seed = scene.scene_order * 79
            saved = cls.download_pollinations_image(cinematic_prompt, target_path, seed=seed)
            if saved:
                source_provider = "ai_photorealistic_flux"
                source_url = "https://image.pollinations.ai"
                attribution = "AI Generated Visual Engine (Photorealistic FLUX)"
                license_notes = "Commercial Friendly Public Domain"

        if not saved:
            # Fallback to procedural cinematic card
            source_provider = "procedural_canvas"
            source_url = "studio://procedural-canvas"
            attribution = "AI Documentary Studio Engine"
            license_notes = "Original Documentary Template"
            saved = cls.generate_procedural_canvas(
                scene_title=scene.scene_title or f"Scene {scene.scene_order}",
                scene_order=scene.scene_order,
                output_path=target_path,
                visual_description=scene.visual_description
            )

        if not saved:
            raise RuntimeError(f"Failed to generate visual for scene '{scene.scene_id_str}'")

        # Generate multi-cut B-roll visuals for fast pacing
        cls.generate_scene_b_rolls(scene=scene, project_dir=project_dir, force_regenerate=force_regenerate)

        return {
            "scene_id": scene.id,
            "file_path": rel_path,
            "asset_type": "image",
            "source_provider": source_provider,
            "source_url": source_url,
            "attribution": attribution,
            "license_notes": license_notes
        }

    @classmethod
    def generate_project_visuals(
        cls,
        db: Session,
        project_id: str,
        force_regenerate: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Generates 1920x1080 visual assets for all scenes in the project,
        saves records to Supabase scene_assets table.
        """
        scenes = (
            db.query(Scene)
            .filter(Scene.project_id == project_id)
            .order_by(Scene.scene_order)
            .all()
        )
        if not scenes:
            raise ValueError(f"No scenes found for project '{project_id}'. Please generate script first.")

        project_dir = BASE_DIR / "workspace_data" / "projects" / project_id
        project_dir.mkdir(parents=True, exist_ok=True)

        results = []
        for scene in scenes:
            visual_info = cls.generate_scene_visual(
                scene=scene,
                project_dir=project_dir,
                force_regenerate=force_regenerate
            )

            # Update or create SceneAsset in Supabase
            existing_asset = (
                db.query(SceneAsset)
                .filter(SceneAsset.scene_id == scene.id)
                .first()
            )

            duration = scene.actual_audio_duration_seconds or scene.estimated_duration_seconds or 5.0

            if existing_asset:
                existing_asset.asset_type = visual_info["asset_type"]
                existing_asset.source_provider = visual_info["source_provider"]
                existing_asset.source_url = visual_info.get("source_url")
                existing_asset.file_path = visual_info["file_path"]
                existing_asset.attribution = visual_info["attribution"]
                existing_asset.license_notes = visual_info["license_notes"]
                existing_asset.duration_seconds = duration
            else:
                new_asset = SceneAsset(
                    id=str(uuid.uuid4()),
                    scene_id=scene.id,
                    asset_type=visual_info["asset_type"],
                    source_provider=visual_info["source_provider"],
                    source_url=visual_info.get("source_url"),
                    file_path=visual_info["file_path"],
                    attribution=visual_info["attribution"],
                    license_notes=visual_info["license_notes"],
                    duration_seconds=duration
                )
                db.add(new_asset)

            results.append(visual_info)

        db.commit()
        return results

    @classmethod
    def save_uploaded_asset(
        cls,
        db: Session,
        scene_id: str,
        file_bytes: bytes,
        original_filename: str
    ) -> Dict[str, Any]:
        """
        Saves a custom user-uploaded asset for a scene.
        If image, auto-resizes to 1920x1080 (16:9).
        """
        scene = db.query(Scene).filter(Scene.id == scene_id).first()
        if not scene:
            raise ValueError(f"Scene '{scene_id}' not found.")

        project_id = scene.project_id
        visuals_dir = BASE_DIR / "workspace_data" / "projects" / project_id / "visuals"
        visuals_dir.mkdir(parents=True, exist_ok=True)

        ext = Path(original_filename).suffix.lower()
        if ext not in [".jpg", ".jpeg", ".png", ".webp", ".mp4"]:
            raise ValueError("Unsupported format. Allowed: .jpg, .jpeg, .png, .webp, .mp4")

        is_video = ext == ".mp4"
        target_filename = f"{scene.scene_id_str}_upload{ext}"
        target_path = visuals_dir / target_filename
        rel_path = f"workspace_data/projects/{project_id}/visuals/{target_filename}"

        if is_video:
            with open(target_path, "wb") as f:
                f.write(file_bytes)
            asset_type = "stock_video"
        else:
            # Process image to 1920x1080
            img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
            target_w, target_h = 1920, 1080
            w, h = img.size
            scale = max(target_w / w, target_h / h)
            new_w, new_h = int(w * scale), int(h * scale)
            resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            left = (new_w - target_w) // 2
            top = (new_h - target_h) // 2
            cropped = resized.crop((left, top, left + target_w, top + target_h))
            
            target_path = visuals_dir / f"{scene.scene_id_str}.jpg"
            rel_path = f"workspace_data/projects/{project_id}/visuals/{scene.scene_id_str}.jpg"
            cropped.save(target_path, "JPEG", quality=92, optimize=True)
            asset_type = "image"

        # Update Supabase
        existing_asset = db.query(SceneAsset).filter(SceneAsset.scene_id == scene.id).first()
        duration = scene.actual_audio_duration_seconds or scene.estimated_duration_seconds or 5.0

        if existing_asset:
            existing_asset.asset_type = asset_type
            existing_asset.source_provider = "user_upload"
            existing_asset.source_url = f"upload://{original_filename}"
            existing_asset.file_path = rel_path
            existing_asset.attribution = "User Custom Upload"
            existing_asset.license_notes = "User Owned / Uploaded"
            existing_asset.duration_seconds = duration
        else:
            new_asset = SceneAsset(
                id=str(uuid.uuid4()),
                scene_id=scene.id,
                asset_type=asset_type,
                source_provider="user_upload",
                source_url=f"upload://{original_filename}",
                file_path=rel_path,
                attribution="User Custom Upload",
                license_notes="User Owned / Uploaded",
                duration_seconds=duration
            )
            db.add(new_asset)

        db.commit()

        return {
            "scene_id": scene.id,
            "file_path": rel_path,
            "asset_type": asset_type,
            "source_provider": "user_upload",
            "attribution": "User Custom Upload",
            "filename": original_filename
        }

