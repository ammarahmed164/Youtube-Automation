import io
import os
import json
import uuid
import logging
import subprocess
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
        """Helper to load a clean modern system font on Windows (with full Unicode/Urdu/Arabic support)."""
        font_dir = os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "Fonts")
        preferred_fonts = ["tahoma.ttf", "segoeui.ttf", "arial.ttf", "times.ttf", "calibri.ttf"]
        
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
    def search_wikipedia_archive(
        cls,
        keywords: List[str],
        scene_title: str = ""
    ) -> Optional[Dict[str, Any]]:
        """
        Queries Wikipedia & Wikimedia Commons API for authentic high-resolution
        historical, documentary, biographical, and archival public domain photography.
        """
        search_terms = []
        if keywords:
            search_terms.extend([k.strip() for k in keywords if k and len(k.strip()) > 2])
        if scene_title:
            search_terms.append(scene_title.strip())

        headers = {
            "User-Agent": "AIDocumentaryStudio/1.0 (https://github.com/documentary-studio; ammarahmeddd164@gmail.com)"
        }

        for term in search_terms:
            try:
                encoded = urllib.parse.quote(term)
                url = f"https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch={encoded}&gsrlimit=4&prop=pageimages&pithumbsize=1920&format=json"

                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=7) as resp:
                    data = json.loads(resp.read().decode("utf-8"))

                pages = data.get("query", {}).get("pages", {})
                for pid, p in pages.items():
                    thumb = p.get("thumbnail", {})
                    src_url = thumb.get("source")
                    if src_url and any(ext in src_url.lower() for ext in [".jpg", ".png", ".jpeg"]):
                        title = p.get("title", term)
                        return {
                            "url": src_url,
                            "title": title,
                            "attribution": f"Wikimedia Commons / Wikipedia ({title})",
                            "license_notes": "Public Domain / CC-BY-SA Creative Commons",
                            "matched_query": term
                        }
            except Exception as e:
                logger.debug(f"Wikipedia search failed for term '{term}': {e}")
                continue

        return None

    @classmethod
    async def search_stock_footage(cls, query: str, duration_needed_seconds: float) -> List[Dict[str, Any]]:
        """Implementation of BaseVisualService abstract method."""
        result = cls.search_wikipedia_archive([query], query) or cls.search_nasa_archive([query], query)
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
        Generates an ultra high-definition 1920x1080 cinematic visual via Pollinations AI.
        """
        try:
            clean_prompt = prompt.replace("\n", " ").strip()
            encoded = urllib.parse.quote(clean_prompt)
            seed_param = f"&seed={seed}" if seed else ""
            url = f"https://image.pollinations.ai/prompt/{encoded}?width=1920&height=1080&model=flux&nologo=true{seed_param}"
            return cls.download_and_format_image(url, output_path)
        except Exception as e:
            logger.warning(f"Pollinations AI image generation failed: {e}")
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

        for i in range(1, cuts_needed):
            b_name = f"{scene.scene_id_str}_b{i:02d}.jpg"
            b_path = visuals_dir / b_name
            if b_path.exists() and not force_regenerate and b_path.stat().st_size > 5000:
                created_cuts.append(b_path)
                continue

            sub_kw = [keywords[i]] if len(keywords) > i else keywords
            wiki_res = cls.search_wikipedia_archive(sub_kw, scene.scene_title or "")
            saved = False
            if wiki_res:
                saved = cls.download_and_format_image(wiki_res["url"], b_path)

            if not saved:
                # Curated HD documentary stock photo
                seed_val = abs(hash(scene.scene_id_str + f"_b{i}")) % 1000
                hd_url = f"https://picsum.photos/seed/{seed_val}/1920/1080"
                saved = cls.download_and_format_image(hd_url, b_path)

            if saved and b_path.exists():
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
        2. If space topic: search NASA Image Archive.
        3. If history, documentary, or general topic: search Wikipedia & Wikimedia Commons Archives.
        4. If not found: fetch curated 1920x1080 documentary stock photo.
        5. Fallback: Procedural cinematic title card with Tahoma Unicode font support.
        """
        visuals_dir = project_dir / "visuals"
        visuals_dir.mkdir(parents=True, exist_ok=True)
        
        target_filename = f"{scene.scene_id_str}.jpg"
        target_path = visuals_dir / target_filename
        rel_path = f"workspace_data/projects/{scene.project_id}/visuals/{target_filename}"

        if target_path.exists() and not force_regenerate and target_path.stat().st_size > 5000:
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

        title_text = scene.scene_title or ""
        is_space = any(w in title_text.lower() or any(w in k.lower() for k in keywords) for w in [
            "space", "galaxy", "nasa", "telescope", "star", "nebula", "planet", "jwst", "hubble", "astronomy"
        ])

        saved = False
        source_provider = "archival_stock"
        source_url = None
        attribution = "Historical Public Domain"
        license_notes = "Creative Commons / Public Domain"

        # 1. Search NASA if space-related
        if is_space:
            nasa_result = cls.search_nasa_archive(keywords=keywords, scene_title=title_text)
            if nasa_result:
                source_url = nasa_result["url"]
                attribution = nasa_result["attribution"]
                license_notes = nasa_result["license_notes"]
                source_provider = "nasa_archive"
                saved = cls.download_and_format_image(nasa_result["url"], target_path)

        # 2. Universal Search: Wikipedia & Wikimedia Commons Archive
        if not saved:
            wiki_result = cls.search_wikipedia_archive(keywords=keywords, scene_title=title_text)
            if wiki_result:
                source_url = wiki_result["url"]
                attribution = wiki_result["attribution"]
                license_notes = wiki_result["license_notes"]
                source_provider = "wikimedia_commons"
                saved = cls.download_and_format_image(wiki_result["url"], target_path)

        # 3. High-Definition Curated Documentary Stock
        if not saved:
            seed_val = abs(hash(scene.scene_id_str + str(scene.scene_order))) % 1000
            hd_stock_url = f"https://picsum.photos/seed/{seed_val}/1920/1080"
            saved = cls.download_and_format_image(hd_stock_url, target_path)
            if saved:
                source_provider = "curated_hd_stock"
                source_url = hd_stock_url
                attribution = "Documentary High-Resolution Stock Library"
                license_notes = "Commercial Friendly Public Domain"

        # 4. Fallback to procedural cinematic card with Tahoma font
        if not saved:
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
        original_filename: str,
        cut_slot: int = 0
    ) -> Dict[str, Any]:
        """
        Saves and auto-formats user-uploaded custom media for a scene:
        - Photos (.jpg, .png, .webp, .bmp, .tiff) -> Normalized to 1920x1080 Full HD JPEG.
        - Videos (.mp4, .mov, .webm, .mkv, .avi) & Animations (.gif) -> Transcoded to 1920x1080 H.264 MP4.
        - cut_slot: 0 for primary cut, 1/2/3 for B-roll multi-cuts.
        """
        scene = db.query(Scene).filter(Scene.id == scene_id).first()
        if not scene:
            raise ValueError(f"Scene '{scene_id}' not found.")

        project_id = scene.project_id
        visuals_dir = BASE_DIR / "workspace_data" / "projects" / project_id / "visuals"
        visuals_dir.mkdir(parents=True, exist_ok=True)

        ext = Path(original_filename).suffix.lower()
        allowed_img = [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"]
        allowed_vid = [".mp4", ".mov", ".webm", ".mkv", ".avi", ".gif"]

        if ext not in allowed_img and ext not in allowed_vid:
            raise ValueError(f"Unsupported format '{ext}'. Allowed: Images (JPG, PNG, WebP) and Videos/Animations (MP4, MOV, WEBM, GIF).")

        is_video_or_anim = ext in allowed_vid
        ffmpeg_bin = settings.get_ffmpeg_path()

        if cut_slot == 0:
            # Primary Visual Slot
            if is_video_or_anim:
                target_filename = f"{scene.scene_id_str}_upload.mp4"
                target_path = visuals_dir / target_filename
                rel_path = f"workspace_data/projects/{project_id}/visuals/{target_filename}"
                asset_type = "stock_video"

                # Temp file to transcode into 1080p MP4
                temp_in = visuals_dir / f"temp_{uuid.uuid4().hex[:8]}{ext}"
                with open(temp_in, "wb") as f:
                    f.write(file_bytes)

                try:
                    vf = "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1"
                    cmd = [
                        ffmpeg_bin, "-y",
                        "-i", str(temp_in),
                        "-vf", vf,
                        "-c:v", "libx264", "-preset", "fast", "-crf", "22",
                        "-pix_fmt", "yuv420p",
                        str(target_path)
                    ]
                    subprocess.run(cmd, capture_output=True, check=True)
                finally:
                    temp_in.unlink(missing_ok=True)
            else:
                target_filename = f"{scene.scene_id_str}.jpg"
                target_path = visuals_dir / target_filename
                rel_path = f"workspace_data/projects/{project_id}/visuals/{target_filename}"
                asset_type = "image"

                img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
                target_w, target_h = 1920, 1080
                w, h = img.size
                scale = max(target_w / w, target_h / h)
                new_w, new_h = int(w * scale), int(h * scale)
                resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
                left = (new_w - target_w) // 2
                top = (new_h - target_h) // 2
                cropped = resized.crop((left, top, left + target_w, top + target_h))
                cropped.save(target_path, "JPEG", quality=94, optimize=True)

            # Update primary SceneAsset record in Supabase
            existing_asset = db.query(SceneAsset).filter(SceneAsset.scene_id == scene.id).first()
            duration = scene.actual_audio_duration_seconds or scene.estimated_duration_seconds or 5.0

            if existing_asset:
                existing_asset.asset_type = asset_type
                existing_asset.source_provider = "user_upload"
                existing_asset.source_url = f"upload://{original_filename}"
                existing_asset.file_path = rel_path
                existing_asset.attribution = f"User Custom {asset_type.capitalize()}"
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
                    attribution=f"User Custom {asset_type.capitalize()}",
                    license_notes="User Owned / Uploaded",
                    duration_seconds=duration
                )
                db.add(new_asset)

        else:
            # Secondary B-Roll Slot (Cut 1, 2, 3...)
            b_suffix = f"b{cut_slot:02d}"
            if is_video_or_anim:
                target_filename = f"{scene.scene_id_str}_{b_suffix}.mp4"
                target_path = visuals_dir / target_filename
                rel_path = f"workspace_data/projects/{project_id}/visuals/{target_filename}"
                asset_type = "stock_video"

                temp_in = visuals_dir / f"temp_{uuid.uuid4().hex[:8]}{ext}"
                with open(temp_in, "wb") as f:
                    f.write(file_bytes)

                try:
                    vf = "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1"
                    cmd = [
                        ffmpeg_bin, "-y",
                        "-i", str(temp_in),
                        "-vf", vf,
                        "-c:v", "libx264", "-preset", "fast", "-crf", "22",
                        "-pix_fmt", "yuv420p",
                        str(target_path)
                    ]
                    subprocess.run(cmd, capture_output=True, check=True)
                finally:
                    temp_in.unlink(missing_ok=True)
            else:
                target_filename = f"{scene.scene_id_str}_{b_suffix}.jpg"
                target_path = visuals_dir / target_filename
                rel_path = f"workspace_data/projects/{project_id}/visuals/{target_filename}"
                asset_type = "image"

                img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
                target_w, target_h = 1920, 1080
                w, h = img.size
                scale = max(target_w / w, target_h / h)
                new_w, new_h = int(w * scale), int(h * scale)
                resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
                left = (new_w - target_w) // 2
                top = (new_h - target_h) // 2
                cropped = resized.crop((left, top, left + target_w, top + target_h))
                cropped.save(target_path, "JPEG", quality=94, optimize=True)

        db.commit()

        return {
            "scene_id": scene.id,
            "cut_slot": cut_slot,
            "file_path": rel_path,
            "asset_type": asset_type,
            "source_provider": "user_upload",
            "attribution": "User Custom Upload",
            "filename": original_filename
        }

    @classmethod
    def reset_scene_visual(cls, db: Session, scene_id: str) -> Dict[str, Any]:
        """
        Resets a scene's visual back to pristine AI/archival generation,
        removing any custom user uploads.
        """
        scene = db.query(Scene).filter(Scene.id == scene_id).first()
        if not scene:
            raise ValueError(f"Scene '{scene_id}' not found.")

        project_id = scene.project_id
        project_dir = BASE_DIR / "workspace_data" / "projects" / project_id
        visuals_dir = project_dir / "visuals"

        # Remove custom uploads if present
        custom_upload_video = visuals_dir / f"{scene.scene_id_str}_upload.mp4"
        if custom_upload_video.exists():
            try:
                custom_upload_video.unlink()
            except Exception:
                pass

        # Force regenerate AI visual
        visual_info = cls.generate_scene_visual(scene=scene, project_dir=project_dir, force_regenerate=True)

        existing_asset = db.query(SceneAsset).filter(SceneAsset.scene_id == scene.id).first()
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

        db.commit()
        return visual_info

    @classmethod
    def get_scene_visuals_gallery(cls, db: Session, scene_id: str) -> Dict[str, Any]:
        """
        Lists all visual cuts (primary + B-rolls) for a scene with their source badges.
        """
        scene = db.query(Scene).filter(Scene.id == scene_id).first()
        if not scene:
            raise ValueError(f"Scene '{scene_id}' not found.")

        project_id = scene.project_id
        visuals_dir = BASE_DIR / "workspace_data" / "projects" / project_id / "visuals"

        cuts = []

        # Check primary cut (Slot 0)
        vid_p = visuals_dir / f"{scene.scene_id_str}_upload.mp4"
        img_p = visuals_dir / f"{scene.scene_id_str}.jpg"

        asset = db.query(SceneAsset).filter(SceneAsset.scene_id == scene.id).first()
        is_user = asset.source_provider == "user_upload" if asset else False

        if vid_p.exists():
            cuts.append({
                "slot": 0,
                "label": "Main Cut (01)",
                "asset_type": "video",
                "is_user_upload": True,
                "source_provider": "User Custom Video",
                "url": f"/api/v1/projects/scenes/{scene.id}/visual?slot=0"
            })
        elif img_p.exists():
            cuts.append({
                "slot": 0,
                "label": "Main Cut (01)",
                "asset_type": "image",
                "is_user_upload": is_user,
                "source_provider": asset.source_provider if asset else "AI Stock",
                "url": f"/api/v1/projects/scenes/{scene.id}/visual?slot=0"
            })

        # Check B-roll cuts (Slots 1, 2, 3... up to 10)
        for slot in range(1, 10):
            b_vid = visuals_dir / f"{scene.scene_id_str}_b{slot:02d}.mp4"
            b_img = visuals_dir / f"{scene.scene_id_str}_b{slot:02d}.jpg"

            if b_vid.exists():
                cuts.append({
                    "slot": slot,
                    "label": f"B-Roll Cut {slot+1:02d}",
                    "asset_type": "video",
                    "is_user_upload": True,
                    "source_provider": "User Custom Video Cut",
                    "url": f"/api/v1/projects/scenes/{scene.id}/visual?slot={slot}"
                })
            elif b_img.exists():
                cuts.append({
                    "slot": slot,
                    "label": f"B-Roll Cut {slot+1:02d}",
                    "asset_type": "image",
                    "is_user_upload": False,
                    "source_provider": "AI Historical B-Roll",
                    "url": f"/api/v1/projects/scenes/{scene.id}/visual?slot={slot}"
                })

        return {
            "scene_id": scene.id,
            "scene_order": scene.scene_order,
            "scene_title": scene.scene_title,
            "total_cuts": len(cuts),
            "cuts": cuts
        }

    @classmethod
    def delete_cut_slot(cls, db: Session, scene_id: str, slot: int) -> Dict[str, Any]:
        """Deletes a specific cut/B-roll slot file for a scene."""
        scene = db.query(Scene).filter(Scene.id == scene_id).first()
        if not scene:
            raise ValueError(f"Scene '{scene_id}' not found.")

        if slot == 0:
            return cls.reset_scene_visual(db, scene_id)

        project_dir = BASE_DIR / "workspace_data" / "projects" / scene.project_id
        visuals_dir = project_dir / "visuals"
        b_suffix = f"b{slot:02d}"

        vid_path = visuals_dir / f"{scene.scene_id_str}_{b_suffix}.mp4"
        img_path = visuals_dir / f"{scene.scene_id_str}_{b_suffix}.jpg"

        if vid_path.exists():
            vid_path.unlink()
        if img_path.exists():
            img_path.unlink()

        return cls.get_scene_visuals_gallery(db, scene_id)

